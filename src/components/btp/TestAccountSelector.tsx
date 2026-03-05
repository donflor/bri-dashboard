'use client';

import { BTP_TEST_ACCOUNTS, type BtpTestAccount } from '@/types/btp';

interface Props {
  selected: string;
  onSelect: (accountId: string) => void;
  className?: string;
}

export default function TestAccountSelector({ selected, onSelect, className = '' }: Props) {
  const current = BTP_TEST_ACCOUNTS.find(a => a.id === selected) || BTP_TEST_ACCOUNTS[0];

  return (
    <div className={`relative ${className}`}>
      <label className="block text-xs font-medium text-gray-400 mb-1">Test Account</label>
      <select
        value={selected}
        onChange={(e) => onSelect(e.target.value)}
        className="w-full rounded-lg bg-gray-800 border border-gray-700 text-white text-sm
          px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent
          appearance-none cursor-pointer"
      >
        {BTP_TEST_ACCOUNTS.map((account) => (
          <option key={account.id} value={account.id}>
            {account.name} — {account.phone}
          </option>
        ))}
      </select>
      <div className="pointer-events-none absolute right-3 top-[calc(50%+4px)] text-gray-400">
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </div>
    </div>
  );
}
