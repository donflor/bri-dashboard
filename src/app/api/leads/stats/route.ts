import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const scoreMin = searchParams.get('scoreMin');
  const scoreMax = searchParams.get('scoreMax');
  const industry = searchParams.get('industry');
  const temperature = searchParams.get('temperature');
  const search = searchParams.get('search');
  const dateFrom = searchParams.get('dateFrom');
  const dateTo = searchParams.get('dateTo');

  try {
    const { count: totalLeads } = await supabase
      .from('crm_leads')
      .select('*', { count: 'exact', head: true });

    const todayStart = new Date();
    todayStart.setUTCHours(0, 0, 0, 0);
    const { count: todayLeads } = await supabase
      .from('crm_leads')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', todayStart.toISOString());

    const now = new Date();
    const dayOfWeek = now.getUTCDay();
    const mondayOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    const weekStart = new Date(now);
    weekStart.setUTCDate(now.getUTCDate() - mondayOffset);
    weekStart.setUTCHours(0, 0, 0, 0);
    const { count: weekLeads } = await supabase
      .from('crm_leads')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', weekStart.toISOString());

    const monthStart = new Date(now.getUTCFullYear(), now.getUTCMonth(), 1);
    const { count: monthLeads } = await supabase
      .from('crm_leads')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', monthStart.toISOString());

    const { data: allLeadsForStats } = await supabase
      .from('crm_leads')
      .select('lead_score, temperature, industry');

    const scoreDistribution: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    const temperatureBreakdown: Record<string, number> = { hot: 0, warm: 0, cold: 0 };
    const industryDistribution: Record<string, number> = {};

    if (allLeadsForStats) {
      for (const lead of allLeadsForStats) {
        const score = lead.lead_score ?? 0;
        if (score >= 1 && score <= 5) {
          scoreDistribution[score] = (scoreDistribution[score] || 0) + 1;
        }
        const temp = (lead.temperature || 'cold').toLowerCase();
        if (temp in temperatureBreakdown) {
          temperatureBreakdown[temp]++;
        } else {
          temperatureBreakdown.cold++;
        }
        if (lead.industry) {
          industryDistribution[lead.industry] = (industryDistribution[lead.industry] || 0) + 1;
        }
      }
    }

    let recentQuery = supabase
      .from('crm_leads')
      .select('id, company, industry, lead_score, temperature, email, first_name, last_name, created_at')
      .order('created_at', { ascending: false })
      .limit(50);

    if (scoreMin) recentQuery = recentQuery.gte('lead_score', parseInt(scoreMin));
    if (scoreMax) recentQuery = recentQuery.lte('lead_score', parseInt(scoreMax));
    if (industry) recentQuery = recentQuery.eq('industry', industry);
    if (temperature) recentQuery = recentQuery.eq('temperature', temperature);
    if (search) recentQuery = recentQuery.or(`company.ilike.%${search}%,email.ilike.%${search}%`);
    if (dateFrom) recentQuery = recentQuery.gte('created_at', dateFrom);
    if (dateTo) recentQuery = recentQuery.lte('created_at', dateTo);

    const { data: recentLeads } = await recentQuery;

    const industries = Object.keys(industryDistribution).sort();

    return NextResponse.json({
      totalLeads: totalLeads || 0,
      todayLeads: todayLeads || 0,
      weekLeads: weekLeads || 0,
      monthLeads: monthLeads || 0,
      scoreDistribution,
      temperatureBreakdown,
      industryDistribution,
      industries,
      recentLeads: recentLeads || [],
    });
  } catch (error) {
    console.error('Lead stats error:', error);
    return NextResponse.json({ error: 'Failed to fetch lead stats' }, { status: 500 });
  }
}
