import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();

  // Build update object from allowed fields
  const allowed = ['title', 'description', 'status', 'priority', 'assigned_agent', 'position', 'board_id'];
  const update: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in body) update[key] = body[key];
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
  }

  // Get current task for activity logging
  const { data: current } = await supabase
    .from('bmc_tasks')
    .select('title, status')
    .eq('id', id)
    .single();

  const { data, error } = await supabase
    .from('bmc_tasks')
    .update(update)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Log status changes
  if (update.status && current && update.status !== current.status) {
    const actionType = update.status === 'done' ? 'task_completed' : 'task_moved';
    await supabase.from('bmc_activity_log').insert({
      agent_id: data.assigned_agent || 'system',
      action_type: actionType,
      description: `Task "${current.title}" moved: ${current.status} → ${update.status}`,
      metadata: { task_id: id, from: current.status, to: update.status },
    });
  }

  return NextResponse.json({ task: data });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const { error } = await supabase
    .from('bmc_tasks')
    .delete()
    .eq('id', id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
