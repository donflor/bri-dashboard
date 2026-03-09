'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts';
import { formatDistanceToNow, format } from 'date-fns';
import clsx from 'clsx';

// ── Types ──

interface LeadStats {
  totalLeads: number;
  todayLeads: number;
  weekLeads: number;
  monthLeads: number;
  scoreDistribution: Record<number, number>;
  temperatureBreakdown: Record<string, number>;
  industryDistribution: Record<string, number>;
  industries: string[];
  recentLeads: Lead[];
}

interface Lead {
  id: string;
  company: string | null;
  industry: string | null;
  lead_score: number | null;
  temperature: string | null;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  created_at: string;
}

interface LgmReport {
  timestamp: string | null;
  stats: {
    found: number;
    scraped: number;
    crm: number;
    instantly: number;
    dupes: number;
    errors: number;
    byCategory: Record<string, number>;
    byScore: Record<string, number>;
    byMetro: Record<string, number>;
  };
  target: number;
  elapsed: number;
  mode: string;
}

// ── Constants ──

const DAILY_TARGET = 2000;
const TEMP_COLORS: Record<string, string> = {
  hot: '#ef4444',
  warm: '#f59e0b',
  cold: '#3b82f6',
};
const TEMP_BG: Record<string, string> = {
  hot: 'bg-red-500/20 text-red-400',
  warm: 'bg-yellow-500/20 text-yellow-400',
  cold: 'bg-blue-500/20 text-blue-400',
};
const PIE_COLORS = [
  '#3b82f6', '#8b5cf6', '#ef4444', '#f59e0b', '#10b981',
  '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#6366f1',
  '#14b8a6', '#e11d48',
];

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://ewsahqwtupghisvbekvf.supabase.co';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// ── Helpers ──

function tempBadge(temp: string | null) {
  const t = (temp || 'cold').toLowerCase();
  return (
    <span className={clsx('px-2 py-0.5 rounded-full text-[10px] font-bold uppercase', TEMP_BG[t] || TEMP_BG.cold)}>
      {t}
    </span>
  );
}

function scoreBadge(score: number | null) {
  const s = score ?? 0;
  const color = s >= 4 ? 'text-green-400' : s >= 3 ? 'text-yellow-400' : 'text-[var(--text-muted)]';
  return <span className={clsx('font-bold text-sm', color)}>{'★'.repeat(s)}{'☆'.repeat(Math.max(0, 5 - s))}</span>;
}

// ── Scheduled Runs ──

function getNextScheduledRun(): Date {
  const now = new Date();
  const runs = [10, 16]; // UTC hours
  for (const h of runs) {
    const candidate = new Date(now);
    candidate.setUTCHours(h, 0, 0, 0);
    if (candidate > now) return candidate;
  }
  // Next day 10:00 UTC
  const tomorrow = new Date(now);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  tomorrow.setUTCHours(10, 0, 0, 0);
  return tomorrow;
}

// ── Component ──

export function LeadGenerationPanel() {
  const [stats, setStats] = useState<LeadStats | null>(null);
  const [lgmReport, setLgmReport] = useState<LgmReport | null>(null);
  const [liveFeed, setLiveFeed] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [filterScore, setFilterScore] = useState('');
  const [filterIndustry, setFilterIndustry] = useState('');
  const [filterTemp, setFilterTemp] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const feedRef = useRef<HTMLDivElement>(null);

  // Fetch stats
  const fetchStats = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (searchQuery) params.set('search', searchQuery);
      if (filterScore) {
        params.set('scoreMin', filterScore);
        params.set('scoreMax', filterScore);
      }
      if (filterIndustry) params.set('industry', filterIndustry);
      if (filterTemp) params.set('temperature', filterTemp);
      if (dateFrom) params.set('dateFrom', new Date(dateFrom).toISOString());
      if (dateTo) params.set('dateTo', new Date(dateTo + 'T23:59:59').toISOString());

      const res = await fetch(`/api/leads/stats?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch stats');
      const data = await res.json();
      setStats(data);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [searchQuery, filterScore, filterIndustry, filterTemp, dateFrom, dateTo]);

  // Fetch LGM report
  const fetchLgmReport = useCallback(async () => {
    try {
      const res = await fetch('/api/leads/lgm-report');
      const data = await res.json();
      setLgmReport(data);
    } catch {
      // silent
    }
  }, []);

  // Initial load + polling
  useEffect(() => {
    fetchStats();
    fetchLgmReport();
    const interval = setInterval(() => {
      fetchStats();
      fetchLgmReport();
    }, 30000);
    return () => clearInterval(interval);
  }, [fetchStats, fetchLgmReport]);

  // Supabase realtime subscription
  useEffect(() => {
    if (!SUPABASE_ANON_KEY) return;

    const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    const channel = client
      .channel('crm-leads-realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'crm_leads' },
        (payload) => {
          const newLead = payload.new as Lead;
          setLiveFeed((prev) => [newLead, ...prev].slice(0, 100));
          // Also update total count
          setStats((prev) => prev ? { ...prev, totalLeads: prev.totalLeads + 1, todayLeads: prev.todayLeads + 1 } : prev);
        }
      )
      .subscribe();

    return () => {
      client.removeChannel(channel);
    };
  }, []);

  // Chart data
  const scoreChartData = stats
    ? Object.entries(stats.scoreDistribution).map(([score, count]) => ({
        score: `Score ${score}`,
        count,
      }))
    : [];

  const tempChartData = stats
    ? Object.entries(stats.temperatureBreakdown).map(([temp, count]) => ({
        name: temp.charAt(0).toUpperCase() + temp.slice(1),
        value: count,
        color: TEMP_COLORS[temp] || '#6b7280',
      }))
    : [];

  const industryChartData = stats
    ? Object.entries(stats.industryDistribution)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([name, value]) => ({ name: name.replace(/_/g, ' '), value }))
    : [];

  const nextRun = getNextScheduledRun();
  const dailyProgress = stats ? Math.min((stats.todayLeads / DAILY_TARGET) * 100, 100) : 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin w-8 h-8 border-2 border-[var(--accent)] border-t-transparent rounded-full" />
      </div>
    );
  }

  if (error && !stats) {
    return (
      <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-6 text-center">
        <p className="text-red-400 font-medium">⚠️ {error}</p>
        <button onClick={fetchStats} className="mt-3 px-4 py-2 bg-red-500/20 hover:bg-red-500/30 rounded-lg text-sm text-red-300 transition-colors">
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <span className="text-2xl">📊</span> Lead Generation Manager
          </h2>
          <p className="text-sm text-[var(--text-muted)] mt-1">
            Real-time lead pipeline monitoring & LGM performance
          </p>
        </div>
        <button
          onClick={() => { fetchStats(); fetchLgmReport(); }}
          className="p-2 rounded-xl bg-[var(--bg-card)] hover:bg-[var(--bg-card-hover)] border border-[var(--border-color)] transition-colors"
          title="Refresh"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Leads', value: stats?.totalLeads.toLocaleString() || '0', icon: '🎯', color: 'text-blue-400' },
          { label: 'Today', value: stats?.todayLeads.toLocaleString() || '0', icon: '📈', color: 'text-green-400' },
          { label: 'This Week', value: stats?.weekLeads.toLocaleString() || '0', icon: '📅', color: 'text-purple-400' },
          { label: 'This Month', value: stats?.monthLeads.toLocaleString() || '0', icon: '🗓️', color: 'text-yellow-400' },
        ].map((kpi) => (
          <div key={kpi.label} className="bg-[var(--bg-card)] rounded-2xl p-4 border border-[var(--border-color)]">
            <div className="flex items-center gap-2 mb-2">
              <span>{kpi.icon}</span>
              <span className="text-xs text-[var(--text-muted)] uppercase tracking-wider">{kpi.label}</span>
            </div>
            <p className={clsx('text-2xl font-bold', kpi.color)}>{kpi.value}</p>
          </div>
        ))}
      </div>

      {/* LGM Run Status + Daily Progress */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Daily Target Progress */}
        <div className="bg-[var(--bg-card)] rounded-2xl p-5 border border-[var(--border-color)]">
          <h3 className="text-sm font-semibold text-[var(--text-secondary)] mb-3 flex items-center gap-2">
            🎯 Daily Target Progress
          </h3>
          <div className="flex items-end gap-3 mb-3">
            <span className="text-3xl font-bold">{stats?.todayLeads.toLocaleString()}</span>
            <span className="text-[var(--text-muted)] text-sm mb-1">/ {DAILY_TARGET.toLocaleString()} target</span>
          </div>
          <div className="w-full h-4 bg-[var(--bg-hover)] rounded-full overflow-hidden">
            <div
              className={clsx(
                'h-full rounded-full transition-all duration-700',
                dailyProgress >= 100 ? 'bg-green-500' : dailyProgress >= 50 ? 'bg-blue-500' : 'bg-yellow-500'
              )}
              style={{ width: `${dailyProgress}%` }}
            />
          </div>
          <p className="text-xs text-[var(--text-muted)] mt-2">{dailyProgress.toFixed(1)}% of daily target</p>
        </div>

        {/* LGM Run Status */}
        <div className="bg-[var(--bg-card)] rounded-2xl p-5 border border-[var(--border-color)]">
          <h3 className="text-sm font-semibold text-[var(--text-secondary)] mb-3 flex items-center gap-2">
            ⚡ LGM Run Status
          </h3>
          {lgmReport?.timestamp ? (
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-[var(--text-muted)]">Last Run</span>
                <span className="font-medium">
                  {formatDistanceToNow(new Date(lgmReport.timestamp), { addSuffix: true })}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--text-muted)]">Next Scheduled</span>
                <span className="font-medium">{format(nextRun, 'HH:mm')} UTC</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--text-muted)]">Leads Found</span>
                <span className="font-medium text-green-400">{lgmReport.stats.found.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--text-muted)]">Added to CRM</span>
                <span className="font-medium text-blue-400">{lgmReport.stats.crm.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--text-muted)]">Dupes Skipped</span>
                <span className="font-medium text-[var(--text-muted)]">{lgmReport.stats.dupes.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--text-muted)]">Elapsed</span>
                <span className="font-medium">{(lgmReport.elapsed / 60).toFixed(1)} min</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--text-muted)]">Mode</span>
                <span className={clsx('font-medium uppercase text-xs', lgmReport.mode === 'live' ? 'text-green-400' : 'text-yellow-400')}>
                  {lgmReport.mode}
                </span>
              </div>
            </div>
          ) : (
            <p className="text-[var(--text-muted)] text-sm">No report data available</p>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="bg-[var(--bg-card)] rounded-2xl p-4 border border-[var(--border-color)]">
        <h3 className="text-sm font-semibold text-[var(--text-secondary)] mb-3">🔍 Filters</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <input
            type="text"
            placeholder="Search company/email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="px-3 py-2 rounded-lg bg-[var(--bg-hover)] border border-[var(--border-color)] text-sm focus:outline-none focus:border-[var(--accent)]"
          />
          <select
            value={filterScore}
            onChange={(e) => setFilterScore(e.target.value)}
            className="px-3 py-2 rounded-lg bg-[var(--bg-hover)] border border-[var(--border-color)] text-sm focus:outline-none focus:border-[var(--accent)]"
          >
            <option value="">All Scores</option>
            {[1, 2, 3, 4, 5].map((s) => (
              <option key={s} value={s}>Score {s}</option>
            ))}
          </select>
          <select
            value={filterIndustry}
            onChange={(e) => setFilterIndustry(e.target.value)}
            className="px-3 py-2 rounded-lg bg-[var(--bg-hover)] border border-[var(--border-color)] text-sm focus:outline-none focus:border-[var(--accent)]"
          >
            <option value="">All Industries</option>
            {(stats?.industries || []).map((ind) => (
              <option key={ind} value={ind}>{ind.replace(/_/g, ' ')}</option>
            ))}
          </select>
          <select
            value={filterTemp}
            onChange={(e) => setFilterTemp(e.target.value)}
            className="px-3 py-2 rounded-lg bg-[var(--bg-hover)] border border-[var(--border-color)] text-sm focus:outline-none focus:border-[var(--accent)]"
          >
            <option value="">All Temps</option>
            <option value="hot">🔥 Hot</option>
            <option value="warm">🌡️ Warm</option>
            <option value="cold">❄️ Cold</option>
          </select>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="px-3 py-2 rounded-lg bg-[var(--bg-hover)] border border-[var(--border-color)] text-sm focus:outline-none focus:border-[var(--accent)]"
            placeholder="From"
          />
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="px-3 py-2 rounded-lg bg-[var(--bg-hover)] border border-[var(--border-color)] text-sm focus:outline-none focus:border-[var(--accent)]"
            placeholder="To"
          />
        </div>
        {(searchQuery || filterScore || filterIndustry || filterTemp || dateFrom || dateTo) && (
          <button
            onClick={() => { setSearchQuery(''); setFilterScore(''); setFilterIndustry(''); setFilterTemp(''); setDateFrom(''); setDateTo(''); }}
            className="mt-2 text-xs text-[var(--accent)] hover:underline"
          >
            Clear all filters
          </button>
        )}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Score Distribution */}
        <div className="bg-[var(--bg-card)] rounded-2xl p-5 border border-[var(--border-color)]">
          <h3 className="text-sm font-semibold text-[var(--text-secondary)] mb-4">📊 Score Distribution</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={scoreChartData}>
              <XAxis dataKey="score" tick={{ fontSize: 12, fill: 'var(--text-muted)' }} />
              <YAxis tick={{ fontSize: 12, fill: 'var(--text-muted)' }} />
              <Tooltip
                contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '8px' }}
                labelStyle={{ color: 'var(--text-primary)' }}
              />
              <Bar dataKey="count" fill="#3b82f6" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Temperature Breakdown */}
        <div className="bg-[var(--bg-card)] rounded-2xl p-5 border border-[var(--border-color)]">
          <h3 className="text-sm font-semibold text-[var(--text-secondary)] mb-4">🌡️ Temperature</h3>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie
                data={tempChartData}
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={80}
                paddingAngle={4}
                dataKey="value"
                label={({ name, percent }) => `${name || ''} ${((percent ?? 0) * 100).toFixed(0)}%`}
              >
                {tempChartData.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Industry Distribution */}
        <div className="bg-[var(--bg-card)] rounded-2xl p-5 border border-[var(--border-color)]">
          <h3 className="text-sm font-semibold text-[var(--text-secondary)] mb-4">🏢 Top Industries</h3>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie
                data={industryChartData}
                cx="50%"
                cy="50%"
                outerRadius={80}
                dataKey="value"
                label={({ name, percent }) => (percent ?? 0) > 0.05 ? `${(name || '').slice(0, 12)}` : ''}
              >
                {industryChartData.map((_, i) => (
                  <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
              <Legend
                layout="vertical"
                align="right"
                verticalAlign="middle"
                wrapperStyle={{ fontSize: '10px' }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Live Feed + Recent Leads */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Live Feed */}
        <div className="bg-[var(--bg-card)] rounded-2xl p-5 border border-[var(--border-color)]">
          <h3 className="text-sm font-semibold text-[var(--text-secondary)] mb-3 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            Live Feed
            <span className="text-[10px] text-[var(--text-muted)] font-normal ml-auto">
              {liveFeed.length > 0 ? `${liveFeed.length} new` : 'Waiting for leads...'}
            </span>
          </h3>
          <div ref={feedRef} className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
            {liveFeed.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-[var(--text-muted)] text-sm">🔄 Listening for new leads...</p>
                <p className="text-[var(--text-muted)] text-xs mt-1">New leads will appear here in real-time</p>
              </div>
            ) : (
              liveFeed.map((lead) => (
                <div key={lead.id} className="flex items-start gap-3 p-2.5 rounded-lg bg-[var(--bg-hover)] border border-[var(--border-color)]/50 animate-fade-in">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium truncate">{lead.company || 'Unknown'}</p>
                      {tempBadge(lead.temperature)}
                    </div>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-xs text-[var(--text-muted)]">{lead.industry?.replace(/_/g, ' ') || '-'}</span>
                      {scoreBadge(lead.lead_score)}
                    </div>
                  </div>
                  <span className="text-[10px] text-[var(--text-muted)] whitespace-nowrap">
                    {formatDistanceToNow(new Date(lead.created_at), { addSuffix: true })}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Recent Leads Table */}
        <div className="bg-[var(--bg-card)] rounded-2xl p-5 border border-[var(--border-color)]">
          <h3 className="text-sm font-semibold text-[var(--text-secondary)] mb-3">📋 Recent Leads</h3>
          <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-[var(--bg-card)]">
                <tr className="text-[var(--text-muted)] text-xs border-b border-[var(--border-color)]">
                  <th className="text-left py-2 pr-2">Company</th>
                  <th className="text-left py-2 pr-2">Industry</th>
                  <th className="text-center py-2 pr-2">Score</th>
                  <th className="text-center py-2 pr-2">Temp</th>
                  <th className="text-right py-2">Added</th>
                </tr>
              </thead>
              <tbody>
                {(stats?.recentLeads || []).map((lead) => (
                  <tr key={lead.id} className="border-b border-[var(--border-color)]/30 hover:bg-[var(--bg-hover)] transition-colors">
                    <td className="py-2 pr-2">
                      <p className="font-medium truncate max-w-[150px]">{lead.company || '-'}</p>
                      <p className="text-[10px] text-[var(--text-muted)] truncate max-w-[150px]">{lead.email}</p>
                    </td>
                    <td className="py-2 pr-2 text-xs text-[var(--text-muted)]">
                      {lead.industry?.replace(/_/g, ' ') || '-'}
                    </td>
                    <td className="py-2 pr-2 text-center">{scoreBadge(lead.lead_score)}</td>
                    <td className="py-2 pr-2 text-center">{tempBadge(lead.temperature)}</td>
                    <td className="py-2 text-right text-[10px] text-[var(--text-muted)] whitespace-nowrap">
                      {formatDistanceToNow(new Date(lead.created_at), { addSuffix: true })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {(!stats?.recentLeads || stats.recentLeads.length === 0) && (
              <p className="text-center text-[var(--text-muted)] text-sm py-8">No leads match current filters</p>
            )}
          </div>
        </div>
      </div>

      {/* LGM Report — Category & Metro Breakdown */}
      {lgmReport?.stats?.byCategory && Object.keys(lgmReport.stats.byCategory).length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-[var(--bg-card)] rounded-2xl p-5 border border-[var(--border-color)]">
            <h3 className="text-sm font-semibold text-[var(--text-secondary)] mb-3">📂 Last Run — By Category</h3>
            <div className="space-y-1.5 max-h-[300px] overflow-y-auto">
              {Object.entries(lgmReport.stats.byCategory)
                .sort((a, b) => b[1] - a[1])
                .map(([cat, count]) => (
                  <div key={cat} className="flex items-center justify-between text-sm">
                    <span className="text-[var(--text-secondary)] capitalize">{cat.replace(/_/g, ' ')}</span>
                    <span className="font-medium text-[var(--accent)]">{count}</span>
                  </div>
                ))}
            </div>
          </div>
          <div className="bg-[var(--bg-card)] rounded-2xl p-5 border border-[var(--border-color)]">
            <h3 className="text-sm font-semibold text-[var(--text-secondary)] mb-3">🗺️ Last Run — By Metro</h3>
            <div className="space-y-1.5 max-h-[300px] overflow-y-auto">
              {Object.entries(lgmReport.stats.byMetro)
                .sort((a, b) => b[1] - a[1])
                .map(([metro, count]) => (
                  <div key={metro} className="flex items-center justify-between text-sm">
                    <span className="text-[var(--text-secondary)]">{metro}</span>
                    <span className="font-medium text-[var(--accent)]">{count}</span>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
