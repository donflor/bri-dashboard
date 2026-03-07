'use client';

import { useState, useEffect, useCallback } from 'react';
import type { BtpEmail } from '@/types/btp';

interface Props {
  testAccountId: string;
}

export default function EmailFeedPanel({ testAccountId }: Props) {
  const [emails, setEmails] = useState<BtpEmail[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [composing, setComposing] = useState(false);
  const [composeSubject, setComposeSubject] = useState('');
  const [composeBody, setComposeBody] = useState('');
  const [sending, setSending] = useState(false);

  const fetchEmails = useCallback(async () => {
    try {
      const res = await fetch(`/api/btp/emails?testAccountId=${testAccountId}`, {
        headers: { 'X-BTP-Mode': 'sandbox' },
      });
      if (res.ok) {
        const data = await res.json();
        setEmails(data.data || []);
      }
    } catch (err) {
      console.error('Failed to fetch emails:', err);
    } finally {
      setLoading(false);
    }
  }, [testAccountId]);

  useEffect(() => {
    fetchEmails();
    const interval = setInterval(fetchEmails, 3000);
    return () => clearInterval(interval);
  }, [fetchEmails]);

  const handleSend = async () => {
    if (!composeSubject.trim() || !composeBody.trim() || sending) return;
    setSending(true);
    try {
      const res = await fetch('/api/btp/emails', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-BTP-Mode': 'sandbox' },
        body: JSON.stringify({ testAccountId, subject: composeSubject, body: composeBody }),
      });
      if (res.ok) {
        setComposeSubject('');
        setComposeBody('');
        setComposing(false);
        await fetchEmails();
      }
    } catch (err) {
      console.error('Failed to send email:', err);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="rounded-xl bg-gray-900/80 border border-gray-800 flex flex-col h-full">
      <div className="px-4 py-3 border-b border-gray-800 flex items-center gap-2">
        <svg className="h-4 w-4 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
        <h3 className="text-sm font-semibold text-white">Email Feed</h3>
        <button
          onClick={() => setComposing(!composing)}
          className="ml-auto text-xs bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1 rounded-md transition-colors"
        >
          {composing ? 'Cancel' : '+ Compose'}
        </button>
      </div>

      {/* Compose */}
      {composing && (
        <div className="p-3 border-b border-gray-800 space-y-2">
          <input
            type="text"
            value={composeSubject}
            onChange={(e) => setComposeSubject(e.target.value)}
            placeholder="Subject..."
            className="w-full rounded-lg bg-gray-800 border border-gray-700 text-white text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <textarea
            value={composeBody}
            onChange={(e) => setComposeBody(e.target.value)}
            placeholder="Email body..."
            rows={3}
            className="w-full rounded-lg bg-gray-800 border border-gray-700 text-white text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
          />
          <button
            onClick={handleSend}
            disabled={!composeSubject.trim() || !composeBody.trim() || sending}
            className="w-full rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-700 disabled:cursor-not-allowed text-white text-sm font-medium py-2 transition-colors"
          >
            {sending ? 'Sending...' : 'Send Test Email'}
          </button>
        </div>
      )}

      {/* Email List */}
      <div className="flex-1 overflow-y-auto min-h-[200px] max-h-[300px]">
        {loading ? (
          <div className="flex items-center justify-center h-full p-8">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-400" />
          </div>
        ) : emails.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-500 text-sm p-8">
            No emails yet. Send a test email above.
          </div>
        ) : (
          <div className="divide-y divide-gray-800">
            {emails.map((email) => (
              <button
                key={email.id}
                onClick={() => setExpanded(expanded === email.id ? null : email.id)}
                className="w-full text-left px-4 py-3 hover:bg-gray-800/50 transition-colors"
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className={`inline-block h-2 w-2 rounded-full ${email.direction === 'inbound' ? 'bg-emerald-400' : 'bg-blue-400'}`} />
                  <span className="text-xs text-gray-400">{email.direction === 'inbound' ? email.from_email : `→ ${email.to_email}`}</span>
                  <span className="ml-auto text-[10px] text-gray-600">{new Date(email.created_at).toLocaleString()}</span>
                </div>
                <p className="text-sm font-medium text-white truncate">{email.subject}</p>
                {expanded === email.id && (
                  <div className="mt-2 text-xs text-gray-300 whitespace-pre-wrap bg-gray-950 rounded-lg p-3">
                    {email.body}
                  </div>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
