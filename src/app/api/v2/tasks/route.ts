import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET() {
  const { data, error } = await supabase
    .from('bmc_tasks')
    .select('*')
    .order('position', { ascending: true })
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ tasks: data || [] });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { title, description, status, priority, assigned_agent, board_id } = body;

  if (!title?.trim()) {
    return NextResponse.json({ error: 'Title is required' }, { status: 400 });
  }

  // Input length limits
  if (title.length > 500) {
    return NextResponse.json({ error: 'Title too long (max 500 chars)' }, { status: 400 });
  }
  if (description && description.length > 5000) {
    return NextResponse.json({ error: 'Description too long (max 5000 chars)' }, { status: 400 });
  }

  // Get max position for the target column
  const { data: maxPos } = await supabase
    .from('bmc_tasks')
    .select('position')
    .eq('status', status || 'inbox')
    .order('position', { ascending: false })
    .limit(1)
    .single();

  const position = (maxPos?.position || 0) + 1;

  const { data, error } = await supabase
    .from('bmc_tasks')
    .insert({
      title: title.trim(),
      description: description || null,
      status: status || 'inbox',
      priority: priority || 'none',
      assigned_agent: assigned_agent || null,
      board_id: board_id || 'default',
      position,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Log activity
  await supabase.from('bmc_activity_log').insert({
    agent_id: assigned_agent || 'system',
    action_type: 'task_created',
    description: `Task created: ${title.trim()}`,
    metadata: { task_id: data.id, status: data.status },
  });

  return NextResponse.json({ task: data }, { status: 201 });
}
