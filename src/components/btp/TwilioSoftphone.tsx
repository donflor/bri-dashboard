'use client';

import { useState, useCallback } from 'react';

interface Props {
  testAccountId: string;
}

type CallStatus = 'idle' | 'connecting' | 'connected' | 'error';

const DIAL_KEYS = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  ['*', '0', '#'],
];

export default function TwilioSoftphone({ testAccountId }: Props) {
  const [number, setNumber] = useState('');
  const [callStatus, setCallStatus] = useState<CallStatus>('idle');
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeaker, setIsSpeaker] = useState(false);
  const [callDuration, setCallDuration] = useState(0);

  const handleDial = useCallback((key: string) => {
    setNumber(prev => prev + key);
  }, []);

  const handleBackspace = useCallback(() => {
    setNumber(prev => prev.slice(0, -1));
  }, []);

  const handleCall = useCallback(async () => {
    if (!number || callStatus === 'connecting') return;

    setCallStatus('connecting');
    try {
      const res = await fetch('/api/btp/twilio-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-BTP-Mode': 'sandbox' },
        body: JSON.stringify({ testAccountId }),
      });

      if (!res.ok) throw new Error('Failed to get token');

      // In production, initialize Twilio Device with the token
      // For now, simulate connection
      setTimeout(() => setCallStatus('connected'), 1500);

      // Start duration counter
      const interval = setInterval(() => {
        setCallDuration(d => d + 1);
      }, 1000);

      // Store interval for cleanup
      (window as any).__btpCallInterval = interval;
    } catch {
      setCallStatus('error');
      setTimeout(() => setCallStatus('idle'), 3000);
    }
  }, [number, callStatus, testAccountId]);

  const handleHangup = useCallback(() => {
    clearInterval((window as any).__btpCallInterval);
    setCallStatus('idle');
    setCallDuration(0);
    setIsMuted(false);
  }, []);

  const formatDuration = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
  };

  const statusColors: Record<CallStatus, string> = {
    idle: 'text-gray-400',
    connecting: 'text-amber-400 animate-pulse',
    connected: 'text-emerald-400',
    error: 'text-red-400',
  };

  return (
    <div className="rounded-xl bg-gray-900/80 border border-gray-800 p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-white flex items-center gap-2">
          <svg className="h-4 w-4 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
          </svg>
          Softphone (WebRTC)
        </h3>
        <span className={`text-xs font-medium ${statusColors[callStatus]}`}>
          {callStatus === 'idle' && '● Ready'}
          {callStatus === 'connecting' && '● Connecting...'}
          {callStatus === 'connected' && `● ${formatDuration(callDuration)}`}
          {callStatus === 'error' && '● Error'}
        </span>
      </div>

      {/* Number Display */}
      <div className="relative mb-3">
        <input
          type="text"
          value={number}
          onChange={(e) => setNumber(e.target.value.replace(/[^0-9+*#]/g, ''))}
          placeholder="+1 (555) 000-0000"
          className="w-full rounded-lg bg-gray-950 border border-gray-700 text-white text-xl text-center
            font-mono px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        {number && (
          <button
            onClick={handleBackspace}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white transition-colors"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2M3 12l6.414-6.414a2 2 0 011.414-.586H19a2 2 0 012 2v10a2 2 0 01-2 2h-8.172a2 2 0 01-1.414-.586L3 12z" />
            </svg>
          </button>
        )}
      </div>

      {/* Dial Pad */}
      <div className="grid grid-cols-3 gap-2 mb-3">
        {DIAL_KEYS.flat().map((key) => (
          <button
            key={key}
            onClick={() => handleDial(key)}
            disabled={callStatus === 'connected'}
            className="rounded-lg bg-gray-800 hover:bg-gray-700 active:bg-gray-600 
              text-white text-lg font-medium py-3 transition-all duration-100
              disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {key}
          </button>
        ))}
      </div>

      {/* Call Controls */}
      <div className="flex items-center gap-2">
        {callStatus === 'idle' || callStatus === 'error' ? (
          <button
            onClick={handleCall}
            disabled={!number}
            className="flex-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:bg-gray-700
              disabled:cursor-not-allowed text-white font-medium py-3 transition-colors
              flex items-center justify-center gap-2"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
            </svg>
            Call
          </button>
        ) : (
          <>
            <button
              onClick={() => setIsMuted(!isMuted)}
              className={`rounded-lg px-4 py-3 transition-colors ${
                isMuted ? 'bg-red-600 text-white' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
              }`}
              title={isMuted ? 'Unmute' : 'Mute'}
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                {isMuted ? (
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                )}
              </svg>
            </button>
            <button
              onClick={handleHangup}
              className="flex-1 rounded-lg bg-red-600 hover:bg-red-500 text-white font-medium py-3
                transition-colors flex items-center justify-center gap-2"
            >
              <svg className="h-5 w-5 rotate-[135deg]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
              </svg>
              Hang Up
            </button>
            <button
              onClick={() => setIsSpeaker(!isSpeaker)}
              className={`rounded-lg px-4 py-3 transition-colors ${
                isSpeaker ? 'bg-indigo-600 text-white' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
              }`}
              title={isSpeaker ? 'Speaker Off' : 'Speaker On'}
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
              </svg>
            </button>
          </>
        )}
      </div>
    </div>
  );
}
