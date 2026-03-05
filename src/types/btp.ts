// BTP (BizRnr Test Platform) Type Definitions

export type Environment = 'production' | 'sandbox';
export type UserRole = 'admin' | 'viewer';

export interface BtpTestAccount {
  id: string;
  name: string;
  phone: string;
  email: string;
}

export const BTP_TEST_ACCOUNTS: BtpTestAccount[] = [
  { id: 'btp_tester_1', name: 'Test User Alpha', phone: '+15550101', email: 'tester1@btp.bizrnr.test' },
  { id: 'btp_tester_2', name: 'Test User Beta', phone: '+15550102', email: 'tester2@btp.bizrnr.test' },
  { id: 'btp_tester_3', name: 'Test User Gamma', phone: '+15550103', email: 'tester3@btp.bizrnr.test' },
  { id: 'btp_tester_4', name: 'Test User Delta', phone: '+15550104', email: 'tester4@btp.bizrnr.test' },
  { id: 'btp_tester_5', name: 'Test User Epsilon', phone: '+15550105', email: 'tester5@btp.bizrnr.test' },
];

export type BtpScenario =
  | 'magic-demo'
  | 'enterprise-escalation'
  | 'winback-sms'
  | 'winback-call'
  | 'inbound-call'
  | 'sms-reply'
  | 'email-reply';

export type BtpSessionStatus = 'pending' | 'running' | 'success' | 'failed' | 'cancelled';

export interface BtpSession {
  id: string;
  test_account_id: string;
  scenario: BtpScenario;
  status: BtpSessionStatus;
  started_at: string;
  ended_at: string | null;
  metadata: Record<string, unknown>;
}

export interface BtpEmail {
  id: string;
  test_account_id: string;
  direction: 'inbound' | 'outbound';
  from_email: string;
  to_email: string;
  subject: string;
  body: string;
  created_at: string;
}

export interface BtpSmsMessage {
  id: string;
  test_account_id: string;
  direction: 'inbound' | 'outbound';
  from_number: string;
  to_number: string;
  body: string;
  twilio_sid: string | null;
  created_at: string;
}

export interface BtpCallLog {
  id: string;
  test_account_id: string;
  direction: 'inbound' | 'outbound';
  from_number: string;
  to_number: string;
  duration_seconds: number;
  recording_url: string | null;
  twilio_sid: string | null;
  created_at: string;
}

export interface BtpTriggerResult {
  success: boolean;
  sessionId?: string;
  scenario?: BtpScenario;
  status?: BtpSessionStatus;
  error?: string;
}
