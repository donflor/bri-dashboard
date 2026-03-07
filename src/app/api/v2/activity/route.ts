import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const limit = parseInt(searchParams.get('limit') || '50', 10);
  const agent = searchParams.get('agent');
  const type = searchParams.get('type');
  const sourceType = searchParams.get('source_type');

  let query = supabase
    .from('bmc_activity_log')
    .select('id, agent_id, action_type, description, metadata, created_at, source_type, source_channel, source_user, request_id, response_time_ms, severity')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (agent && agent !== 'all') query = query.eq('agent_id', agent);
  if (type && type !== 'all') query = query.eq('action_type', type);
  if (sourceType && sourceType !== 'all') query = query.eq('source_type', sourceType);

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ activities: data || [] });
}
