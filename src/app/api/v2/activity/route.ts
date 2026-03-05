import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const limit = parseInt(searchParams.get('limit') || '50', 10);
  const agent = searchParams.get('agent');
  const type = searchParams.get('type');

  let query = supabase
    .from('bmc_activity_log')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (agent && agent !== 'all') query = query.eq('agent_id', agent);
  if (type && type !== 'all') query = query.eq('action_type', type);

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ activities: data || [] });
}
