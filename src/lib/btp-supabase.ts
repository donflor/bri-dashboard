import { createClient } from '@supabase/supabase-js';
import type { BtpSession, BtpEmail, BtpSmsMessage, BtpCallLog, BtpScenario } from '@/types/btp';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Service-role client for BTP operations (bypasses RLS)
function getBtpClient() {
  return createClient(supabaseUrl, supabaseServiceKey);
}

// ── Sessions ──────────────────────────────────────────────

export async function createBtpSession(
  testAccountId: string,
  scenario: BtpScenario,
  metadata: Record<string, unknown> = {}
): Promise<BtpSession> {
  const client = getBtpClient();
  const { data, error } = await client
    .from('btp_sessions')
    .insert({
      test_account_id: testAccountId,
      scenario,
      status: 'pending',
      started_at: new Date().toISOString(),
      metadata,
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to create BTP session: ${error.message}`);
  return data as BtpSession;
}

export async function updateBtpSession(
  sessionId: string,
  updates: Partial<Pick<BtpSession, 'status' | 'ended_at' | 'metadata'>>
): Promise<BtpSession> {
  const client = getBtpClient();
  const { data, error } = await client
    .from('btp_sessions')
    .update(updates)
    .eq('id', sessionId)
    .select()
    .single();

  if (error) throw new Error(`Failed to update BTP session: ${error.message}`);
  return data as BtpSession;
}

export async function getBtpSessions(limit = 50): Promise<BtpSession[]> {
  const client = getBtpClient();
  const { data, error } = await client
    .from('btp_sessions')
    .select('*')
    .order('started_at', { ascending: false })
    .limit(limit);

  if (error) throw new Error(`Failed to fetch BTP sessions: ${error.message}`);
  return (data || []) as BtpSession[];
}

// ── SMS ───────────────────────────────────────────────────

export async function createBtpSms(msg: Omit<BtpSmsMessage, 'id' | 'created_at'>): Promise<BtpSmsMessage> {
  const client = getBtpClient();
  const { data, error } = await client
    .from('btp_sms_messages')
    .insert(msg)
    .select()
    .single();

  if (error) throw new Error(`Failed to create BTP SMS: ${error.message}`);
  return data as BtpSmsMessage;
}

export async function getBtpSmsMessages(testAccountId?: string, limit = 100): Promise<BtpSmsMessage[]> {
  const client = getBtpClient();
  let query = client
    .from('btp_sms_messages')
    .select('*')
    .order('created_at', { ascending: true })
    .limit(limit);

  if (testAccountId) {
    query = query.eq('test_account_id', testAccountId);
  }

  const { data, error } = await query;
  if (error) throw new Error(`Failed to fetch BTP SMS: ${error.message}`);
  return (data || []) as BtpSmsMessage[];
}

// ── Emails ────────────────────────────────────────────────

export async function createBtpEmail(email: Omit<BtpEmail, 'id' | 'created_at'>): Promise<BtpEmail> {
  const client = getBtpClient();
  const { data, error } = await client
    .from('btp_emails')
    .insert(email)
    .select()
    .single();

  if (error) throw new Error(`Failed to create BTP email: ${error.message}`);
  return data as BtpEmail;
}

export async function getBtpEmails(testAccountId?: string, limit = 100): Promise<BtpEmail[]> {
  const client = getBtpClient();
  let query = client
    .from('btp_emails')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (testAccountId) {
    query = query.eq('test_account_id', testAccountId);
  }

  const { data, error } = await query;
  if (error) throw new Error(`Failed to fetch BTP emails: ${error.message}`);
  return (data || []) as BtpEmail[];
}

// ── Call Logs ─────────────────────────────────────────────

export async function createBtpCallLog(log: Omit<BtpCallLog, 'id' | 'created_at'>): Promise<BtpCallLog> {
  const client = getBtpClient();
  const { data, error } = await client
    .from('btp_call_logs')
    .insert(log)
    .select()
    .single();

  if (error) throw new Error(`Failed to create BTP call log: ${error.message}`);
  return data as BtpCallLog;
}

export async function getBtpCallLogs(testAccountId?: string, limit = 50): Promise<BtpCallLog[]> {
  const client = getBtpClient();
  let query = client
    .from('btp_call_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (testAccountId) {
    query = query.eq('test_account_id', testAccountId);
  }

  const { data, error } = await query;
  if (error) throw new Error(`Failed to fetch BTP call logs: ${error.message}`);
  return (data || []) as BtpCallLog[];
}
