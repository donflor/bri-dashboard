'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import type { BtpSmsMessage } from '@/types/btp';

interface Props {
  testAccountId: string;
}

export default function SMSChatPanel({ testAccountId }: Props) {
  const [messages, setMessages] = useState<BtpSmsMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  const fetchMessages = useCallback(async () => {
    try {
      const res = await fetch(`/api/btp/sms?testAccountId=${testAccountId}`, {
        headers: { 'X-BTP-Mode': 'sandbox' },
      });
      if (res.ok) {
        const data = await res.json();
        setMessages(data.data || []);
      }
    } catch (err) {
      console.error('Failed to fetch SMS:', err);
    } finally {
      setLoading(false);
    }
  }, [testAccountId]);

  useEffect(() => {
    fetchMessages();
    const interval = setInterval(fetchMessages, 5000);
    return () => clearInterval(interval);
  }, [fetchMessages]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || sending) return;
    setSending(true);
    try {
      const res = await fetch('/api/btp/sms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-BTP-Mode': 'sandbox' },
        body: JSON.stringify({ testAccountId, body: input.trim() }),
      });
      if (res.ok) {
        setInput('');
        await fetchMessages();
      }
    } catch (err) {
      console.error('Failed to send SMS:', err);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="rounded-xl bg-gray-900/80 border border-gray-800 flex flex-col h-full">
      <div className="px-4 py-3 border-b border-gray-800 flex items-center gap-2">
        <svg className="h-4 w-4 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
        <h3 className="text-sm font-semibold text-white">SMS Chat</h3>
        <span className="ml-auto text-xs text-gray-500">{messages.length} messages</span>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3 min-h-[200px] max-h-[300px]">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-400" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-500 text-sm">
            No messages yet. Send a test SMS below.
          </div>
        ) : (
          messages.map((msg) => (
            <div key={msg.id} className={`flex ${msg.direction === 'outbound' ? 'justify-end' : 'justify-start'}`}>
              <div className={`
                max-w-[80%] rounded-2xl px-4 py-2 text-sm
                ${msg.direction === 'outbound'
                  ? 'bg-indigo-600 text-white rounded-br-md'
                  : 'bg-gray-800 text-gray-200 rounded-bl-md'
                }
              `}>
                <p>{msg.body}</p>
                <p className={`text-[10px] mt-1 ${msg.direction === 'outbound' ? 'text-indigo-200' : 'text-gray-500'}`}>
                  {new Date(msg.created_at).toLocaleTimeString()}
                </p>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Input */}
      <div className="p-3 border-t border-gray-800 flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          placeholder="Type a message..."
          className="flex-1 rounded-lg bg-gray-800 border border-gray-700 text-white text-sm
            px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        <button
          onClick={handleSend}
          disabled={!input.trim() || sending}
          className="rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-700
            disabled:cursor-not-allowed text-white px-4 py-2 transition-colors"
        >
          {sending ? (
            <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
          ) : (
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          )}
        </button>
      </div>
    </div>
  );
}
