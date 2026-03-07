import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      agent_id,
      action_type,
      description,
      metadata,
      source_type,
      source_channel,
      source_user,
      request_id,
      response_time_ms,
      severity,
    } = body;

    if (!agent_id || !action_type || !description) {
      return NextResponse.json(
        { error: 'agent_id, action_type, and description are required' },
        { status: 400 }
      );
    }

    const { data, error } = await supabase.rpc('log_bmc_activity', {
      p_agent_id: agent_id,
      p_action_type: action_type,
      p_description: description,
      p_metadata: metadata || {},
      p_source_type: source_type || null,
      p_source_channel: source_channel || null,
      p_source_user: source_user || null,
      p_request_id: request_id || null,
      p_response_time_ms: response_time_ms || null,
      p_severity: severity || 'info',
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, id: data });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Invalid request body' },
      { status: 400 }
    );
  }
}
