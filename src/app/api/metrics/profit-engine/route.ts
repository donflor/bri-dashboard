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
      .eq('action_type', 'profit_engine_sync')
      .order('created_at', { ascending: false })
      .limit(1);

    if (activityError || !activityData || activityData.length === 0) {
      return NextResponse.json(EMPTY_RESPONSE);
    }

    const latest = activityData[0];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const meta = latest.metadata as any;

    if (!meta || !meta.current) {
      return NextResponse.json(EMPTY_RESPONSE);
    }

    return NextResponse.json({
      current: meta.current,
      trend: meta.trend || [],
      breakdown: meta.breakdown || { twilio: 0, elevenlabs: 0, llm: 0, infra: 0 },
      lastUpdated: latest.created_at || new Date().toISOString(),
    });
  } catch (err) {
    console.error('Profit engine API error:', err);
    return NextResponse.json(EMPTY_RESPONSE);
  }
}
