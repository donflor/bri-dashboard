'use client';

import { useState, useEffect } from 'react';
import { signOut } from 'next-auth/react';
import clsx from 'clsx';

export type SidebarTab =
  | 'overview' | 'profit' | 'approvals'
  | 'manage' | 'tasks' | 'activity'
  | 'infra' | 'logs' | 'sandbox';

interface NavItem {
  id: SidebarTab;
  label: string;
  icon: string;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

const NAV_SECTIONS: NavSection[] = [
  {
    title: 'EXECUTIVE',
    items: [
      { id: 'overview', label: 'Overview', icon: '📊' },
      { id: 'profit', label: 'Profit Engine', icon: '💰' },
      { id: 'approvals', label: 'Approvals', icon: '✅' },
    ],
  },
  {
    title: 'OPERATIONS',
    items: [
      { id: 'manage', label: 'Agent Fleet', icon: '🤖' },
      { id: 'tasks', label: 'Tasks', icon: '📝' },
      { id: 'activity', label: 'Activity', icon: '📋' },
    ],
  },
  {
    title: 'ENGINEERING',
    items: [
      { id: 'infra', label: 'Infra', icon: '🖥️' },
      { id: 'logs', label: 'Logs', icon: '📡' },
      { id: 'sandbox', label: 'BTP Sandbox', icon: '🧪' },
    ],
  },
];

interface SidebarProps {
  activeTab: SidebarTab;
  onTabChange: (tab: SidebarTab) => void;
  userEmail?: string | null;
  userName?: string | null;
}

export function Sidebar({ activeTab, onTabChange, userEmail, userName }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  // Auto-collapse on medium screens
  useEffect(() => {
    const mql = window.matchMedia('(max-width: 1023px)');
    const handler = (e: MediaQueryListEvent | MediaQueryList) => {
      if (e.matches) setCollapsed(true);
      else setCollapsed(false);
    };
    handler(mql);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, []);

  // Close mobile drawer on tab change
  const handleTabClick = (tab: SidebarTab) => {
    onTabChange(tab);
    setMobileOpen(false);
  };

  const initials = (userName || userEmail || 'U').slice(0, 2).toUpperCase();

  const sidebarContent = (
    <div className="flex flex-col h-full">
      {/* Logo / Brand */}
      <div className="flex items-center gap-3 px-4 py-4 border-b border-[var(--border)]">
        <span className="text-2xl">🦾</span>
        {!collapsed && (
          <div className="min-w-0">
            <h1 className="text-sm font-bold truncate">Bri Mission Control</h1>
            <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider">BMC</p>
          </div>
        )}
        {/* Collapse toggle — hidden on mobile */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="hidden lg:flex ml-auto p-1 rounded hover:bg-[var(--bg-hover)] text-[var(--text-muted)]"
          title={collapsed ? 'Expand' : 'Collapse'}
        >
          <svg className={clsx('w-4 h-4 transition-transform', collapsed && 'rotate-180')} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
          </svg>
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-4">
        {NAV_SECTIONS.map((section) => (
          <div key={section.title}>
            {!collapsed && (
              <p className="px-3 mb-1.5 text-[10px] font-semibold tracking-widest text-[var(--text-muted)] uppercase">
                {section.title}
              </p>
            )}
            <div className="space-y-0.5">
              {section.items.map((item) => {
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => handleTabClick(item.id)}
                    title={collapsed ? item.label : undefined}
                    className={clsx(
                      'w-full flex items-center gap-3 rounded-lg text-sm font-medium transition-all',
                      collapsed ? 'justify-center px-2 py-2.5' : 'px-3 py-2',
                      isActive
                        ? 'bg-[var(--accent)]/15 text-[var(--accent)] border-l-3 border-[var(--accent)]'
                        : 'text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] border-l-3 border-transparent'
                    )}
                  >
                    <span className="text-base flex-shrink-0">{item.icon}</span>
                    {!collapsed && <span className="truncate">{item.label}</span>}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* User section at bottom */}
      <div className="border-t border-[var(--border)] p-3">
        <div className={clsx('flex items-center', collapsed ? 'justify-center' : 'gap-3')}>
          <div className="w-8 h-8 rounded-full bg-[var(--accent)] flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
            {initials}
          </div>
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium truncate">{userName || 'User'}</p>
              <p className="text-[10px] text-[var(--text-muted)] truncate">{userEmail}</p>
            </div>
          )}
          <button
            onClick={() => signOut()}
            title="Sign out"
            className={clsx(
              'p-1.5 rounded-lg hover:bg-[var(--bg-hover)] text-[var(--text-muted)] hover:text-red-400 transition-colors',
              collapsed && 'mt-2'
            )}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile hamburger button */}
      <button
        onClick={() => setMobileOpen(true)}
        className="fixed top-3 left-3 z-50 p-2 rounded-lg bg-[var(--bg-card)] border border-[var(--border)] md:hidden"
        aria-label="Open menu"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 md:hidden" onClick={() => setMobileOpen(false)}>
          <div className="absolute inset-0 bg-black/60" />
          <div
            className="absolute inset-y-0 left-0 w-64 bg-[var(--bg-card)] border-r border-[var(--border)] animate-slide-in"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Override collapsed for mobile drawer */}
            <div className="flex flex-col h-full">
              <div className="flex items-center gap-3 px-4 py-4 border-b border-[var(--border)]">
                <span className="text-2xl">🦾</span>
                <div className="min-w-0 flex-1">
                  <h1 className="text-sm font-bold truncate">Bri Mission Control</h1>
                  <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider">BMC</p>
                </div>
                <button onClick={() => setMobileOpen(false)} className="p-1 rounded hover:bg-[var(--bg-hover)]">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-4">
                {NAV_SECTIONS.map((section) => (
                  <div key={section.title}>
                    <p className="px-3 mb-1.5 text-[10px] font-semibold tracking-widest text-[var(--text-muted)] uppercase">
                      {section.title}
                    </p>
                    <div className="space-y-0.5">
                      {section.items.map((item) => {
                        const isActive = activeTab === item.id;
                        return (
                          <button
                            key={item.id}
                            onClick={() => handleTabClick(item.id)}
                            className={clsx(
                              'w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all',
                              isActive
                                ? 'bg-[var(--accent)]/15 text-[var(--accent)] border-l-3 border-[var(--accent)]'
                                : 'text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] border-l-3 border-transparent'
                            )}
                          >
                            <span className="text-base">{item.icon}</span>
                            <span>{item.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </nav>
              <div className="border-t border-[var(--border)] p-3">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-[var(--accent)] flex items-center justify-center text-white text-xs font-bold">
                    {initials}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate">{userName || 'User'}</p>
                    <p className="text-[10px] text-[var(--text-muted)] truncate">{userEmail}</p>
                  </div>
                  <button onClick={() => signOut()} title="Sign out" className="p-1.5 rounded-lg hover:bg-[var(--bg-hover)] text-[var(--text-muted)] hover:text-red-400">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Desktop sidebar */}
      <aside
        className={clsx(
          'hidden md:flex flex-col flex-shrink-0 bg-[var(--bg-card)] border-r border-[var(--border)] h-screen sticky top-0 transition-all duration-200',
          collapsed ? 'w-16' : 'w-60'
        )}
      >
        {sidebarContent}
      </aside>
    </>
  );
}
