import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const { status, reviewer } = body;

  if (!status || !reviewer) {
    return NextResponse.json({ error: 'Status and reviewer are required' }, { status: 400 });
  }

  // Get current
  const { data: current } = await supabase
    .from('bmc_approvals')
    .select('*')
    .eq('id', id)
    .single();

  const { data, error } = await supabase
    .from('bmc_approvals')
    .update({ 
      status, 
      reviewer, 
      reviewed_at: new Date().toISOString() 
    })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Log
  if (current) {
    const actionType = status === 'approved' ? 'approval_approved' : 'approval_rejected';
    await supabase.from('bmc_activity_log').insert({
      agent_id: reviewer,
      action_type: actionType,
      description: `Approval ${status} by ${reviewer}: ${current.action_description}`,
      metadata: { approval_id: id, status, original_agent: current.requesting_agent },
    });
  }

  return NextResponse.json({ approval: data });
}
