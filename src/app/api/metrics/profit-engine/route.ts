import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';

interface ProfitEngineRow {
  date: string;
  stripe_mrr: number;
  stripe_subscribers: number;
  twilio_cost: number;
  elevenlabs_cost: number;
  llm_cost: number;
  infra_cost: number;
  total_api_burn: number;
  net_margin: number;
  margin_percent: number;
  created_at: string;
}

const EMPTY_RESPONSE = {
  current: {
    mrr: 0,
    totalBurn: 0,
    netMargin: 0,
    marginPercent: 0,
    subscribers: 0,
  },
  trend: [] as { date: string; revenue: number; costs: number }[],
  breakdown: {
    twilio: 0,
    elevenlabs: 0,
    llm: 0,
    infra: 0,
  },
  lastUpdated: new Date().toISOString(),
};

export async function GET() {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Primary: Try dedicated profit_engine_metrics table
    const { data, error } = await supabase
      .from('profit_engine_metrics')
      .select('*')
      .order('date', { ascending: false })
      .limit(30);

    if (!error && data && data.length > 0) {
      const rows = data as ProfitEngineRow[];
      const latest = rows[0];

      const trend = [...rows].reverse().map((row) => ({
        date: row.date,
        revenue: Number(row.stripe_mrr),
        costs: Number(row.total_api_burn),
      }));

      return NextResponse.json({
        current: {
          mrr: Number(latest.stripe_mrr),
          totalBurn: Number(latest.total_api_burn),
          netMargin: Number(latest.net_margin),
          marginPercent: Number(latest.margin_percent),
          subscribers: Number(latest.stripe_subscribers),
        },
        trend,
        breakdown: {
          twilio: Number(latest.twilio_cost),
          elevenlabs: Number(latest.elevenlabs_cost),
          llm: Number(latest.llm_cost),
          infra: Number(latest.infra_cost),
        },
        lastUpdated: latest.created_at || new Date().toISOString(),
      });
    }

    // Fallback: Read from bmc_activity_log (always exists)
    const { data: activityData, error: activityError } = await supabase
      .from('bmc_activity_log')
      .select('metadata, created_at')
      .eq('action_type', 'profit_sync')
      .order('created_at', { ascending: false })
      .limit(1);

    if (activityError || !activityData || activityData.length === 0) {
      return NextResponse.json(EMPTY_RESPONSE);
    }

    // Get latest entry for current metrics
    const latestEntry = activityData[0];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const meta = latestEntry.metadata as any;

    if (!meta) {
      return NextResponse.json(EMPTY_RESPONSE);
    }

    // Build current metrics from the flat metadata structure
    const current = {
      mrr: Number(meta.stripe_mrr || 0),
      totalBurn: Number(meta.total_api_burn || 0),
      netMargin: Number(meta.net_margin || 0),
      marginPercent: Number(meta.margin_percent || 0),
      subscribers: Number(meta.stripe_subscribers || 0),
    };

    const breakdown = {
      twilio: Number(meta.twilio_cost || 0),
      elevenlabs: Number(meta.elevenlabs_cost || 0),
      llm: Number(meta.llm_cost || 0),
      infra: Number(meta.infra_cost || 0),
    };

    // Build trend from historical entries
    const { data: trendData } = await supabase
      .from('bmc_activity_log')
      .select('metadata, created_at')
      .eq('action_type', 'profit_sync')
      .order('created_at', { ascending: true })
      .limit(30);

    const seen: Record<string, boolean> = {};
    const trend = (trendData || [])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .filter((e: any) => e.metadata)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((e: any) => {
        const m = e.metadata;
        const date = m.date || e.created_at?.split('T')[0];
        return {
          date,
          revenue: Number(m.stripe_mrr || 0),
          costs: Number(m.total_api_burn || 0),
        };
      })
      .filter((t: { date: string }) => {
        if (seen[t.date]) return false;
        seen[t.date] = true;
        return true;
      });

    return NextResponse.json({
      current,
      trend,
      breakdown,
      lastUpdated: latestEntry.created_at || new Date().toISOString(),
    });
  } catch (err) {
    console.error('Profit engine API error:', err);
    return NextResponse.json(EMPTY_RESPONSE);
  }
}
