import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET() {
  const { data, error } = await supabase
    .from('bmc_approvals')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ approvals: data || [] });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { requesting_agent, action_type, action_description, risk_level, metadata } = body;

  if (!requesting_agent || !action_type || !action_description) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('bmc_approvals')
    .insert({
      requesting_agent,
      action_type,
      action_description,
      risk_level: risk_level || 'medium',
      metadata: metadata || {},
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Log activity
  await supabase.from('bmc_activity_log').insert({
    agent_id: requesting_agent,
    action_type: 'approval_requested',
    description: `Approval requested: ${action_description}`,
    metadata: { approval_id: data.id, risk_level, action_type },
  });

  return NextResponse.json({ approval: data }, { status: 201 });
}
