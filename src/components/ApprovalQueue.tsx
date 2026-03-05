'use client';

import { useState, useEffect, useCallback } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { Badge } from './ui/Badge';

interface BMCApproval {
  id: string;
  requesting_agent: string;
  action_type: string;
  action_description: string;
  risk_level: 'low' | 'medium' | 'high' | 'critical';
  status: 'pending' | 'approved' | 'rejected';
  reviewer?: string;
  reviewed_at?: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

const RISK_VARIANTS = {
  low: 'success' as const,
  medium: 'warning' as const,
  high: 'danger' as const,
  critical: 'danger' as const,
};

const ACTION_ICONS: Record<string, string> = {
  architecture_change: '🏗️',
  outbound_sales: '📞',
  deployment: '🚀',
  data_migration: '🗄️',
  configuration: '⚙️',
  other: '📋',
};

const AGENT_EMOJIS: Record<string, string> = {
  product_engineer: '🔧', ux_architect: '🎨', qa_lead: '🧪',
  closer: '💰', daba: '🗄️', seesee: '🖥️', it_ops: '⚙️',
  router_agent: '🔀', ceo_bri: '👑',
};

const API_BASE = '/api/v2';

type FilterTab = 'pending' | 'resolved' | 'all';

export function ApprovalQueue() {
  const [approvals, setApprovals] = useState<BMCApproval[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterTab>('pending');
  const [processing, setProcessing] = useState<string | null>(null);

  const fetchApprovals = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/approvals`);
      if (res.ok) {
        const data = await res.json();
        setApprovals(data.approvals || []);
      }
    } catch (err) {
      console.error('Failed to fetch approvals:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchApprovals();
    const es = new EventSource('/api/stream');
    es.addEventListener('approval_update', () => fetchApprovals());
    return () => es.close();
  }, [fetchApprovals]);

  const handleAction = async (id: string, action: 'approved' | 'rejected') => {
    setProcessing(id);
    try {
      await fetch(`${API_BASE}/approvals/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: action, reviewer: 'KP' }),
      });
      fetchApprovals();
    } catch (err) {
      console.error(`Failed to ${action} approval:`, err);
    } finally {
      setProcessing(null);
    }
  };

  const filtered = approvals.filter(a => {
    if (filter === 'pending') return a.status === 'pending';
    if (filter === 'resolved') return a.status !== 'pending';
    return true;
  });

  const pendingCount = approvals.filter(a => a.status === 'pending').length;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--accent)]" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold text-[var(--text-secondary)]">Action Approvals</h2>
          {pendingCount > 0 && (
            <span className="px-2.5 py-1 bg-red-500/20 text-red-400 rounded-full text-xs font-bold animate-pulse">
              {pendingCount} pending
            </span>
          )}
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 bg-[var(--bg-card)] rounded-xl p-1 border border-[var(--border-color)]">
        {([
          { id: 'pending' as FilterTab, label: `Pending (${pendingCount})`, icon: '⏳' },
          { id: 'resolved' as FilterTab, label: 'Resolved', icon: '✅' },
          { id: 'all' as FilterTab, label: 'All', icon: '📋' },
        ]).map(tab => (
          <button
            key={tab.id}
            onClick={() => setFilter(tab.id)}
            className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
              filter === tab.id
                ? 'bg-[var(--accent)] text-white'
                : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
            }`}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* Approval Cards */}
      <div className="space-y-3">
        {filtered.length === 0 ? (
          <div className="text-center py-12 text-[var(--text-muted)]">
            <div className="text-4xl mb-2">{filter === 'pending' ? '🎉' : '📋'}</div>
            <div className="text-sm">
              {filter === 'pending' ? 'No pending approvals — all clear!' : 'No approvals found'}
            </div>
          </div>
        ) : (
          filtered.map((approval) => (
            <div
              key={approval.id}
              className={`bg-[var(--bg-card)] rounded-2xl p-4 border transition-all ${
                approval.status === 'pending'
                  ? 'border-yellow-500/30 hover:border-yellow-500/50'
                  : approval.status === 'approved'
                  ? 'border-green-500/20'
                  : 'border-red-500/20'
              }`}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-xl">{ACTION_ICONS[approval.action_type] || '📋'}</span>
                  <div>
                    <div className="text-sm font-medium text-[var(--text-primary)]">
                      {approval.action_type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                    </div>
                    <div className="text-xs text-[var(--text-muted)]">
                      {AGENT_EMOJIS[approval.requesting_agent] || '🤖'} {approval.requesting_agent}
                      {' · '}
                      {formatDistanceToNow(new Date(approval.created_at), { addSuffix: true })}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={RISK_VARIANTS[approval.risk_level]}>
                    {approval.risk_level === 'critical' ? '🔴' : ''} {approval.risk_level}
                  </Badge>
                  {approval.status !== 'pending' && (
                    <Badge variant={approval.status === 'approved' ? 'success' : 'danger'}>
                      {approval.status}
                    </Badge>
                  )}
                </div>
              </div>

              <div className="text-sm text-[var(--text-secondary)] mb-3 bg-[var(--bg-primary)] rounded-lg p-3">
                {approval.action_description}
              </div>

              {approval.status === 'pending' && (
                <div className="flex items-center gap-2 justify-end">
                  <button
                    onClick={() => handleAction(approval.id, 'rejected')}
                    disabled={processing === approval.id}
                    className="px-4 py-2 text-sm font-medium text-red-400 border border-red-500/30 rounded-lg hover:bg-red-500/10 transition-colors disabled:opacity-50"
                  >
                    ✕ Reject
                  </button>
                  <button
                    onClick={() => handleAction(approval.id, 'approved')}
                    disabled={processing === approval.id}
                    className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-500 transition-colors disabled:opacity-50"
                  >
                    ✓ Approve
                  </button>
                </div>
              )}

              {approval.status !== 'pending' && approval.reviewer && (
                <div className="text-xs text-[var(--text-muted)] text-right">
                  {approval.status === 'approved' ? '✅' : '❌'} by {approval.reviewer}
                  {approval.reviewed_at && ` · ${formatDistanceToNow(new Date(approval.reviewed_at), { addSuffix: true })}`}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
