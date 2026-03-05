'use client';

import { useState, useEffect, useCallback } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { Badge } from './ui/Badge';
import { Dialog } from './ui/Dialog';

// Types
interface BMCTask {
  id: string;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: 'none' | 'low' | 'medium' | 'high';
  assigned_agent?: string;
  board_id: string;
  position: number;
  created_at: string;
  updated_at: string;
}

type TaskStatus = 'inbox' | 'up_next' | 'in_progress' | 'in_review' | 'done';

const COLUMNS: { id: TaskStatus; label: string; icon: string; color: string }[] = [
  { id: 'inbox', label: 'Inbox', icon: '📥', color: 'border-t-gray-500' },
  { id: 'up_next', label: 'Up Next', icon: '🎯', color: 'border-t-blue-500' },
  { id: 'in_progress', label: 'In Progress', icon: '⚡', color: 'border-t-yellow-500' },
  { id: 'in_review', label: 'In Review', icon: '👀', color: 'border-t-purple-500' },
  { id: 'done', label: 'Done', icon: '✅', color: 'border-t-green-500' },
];

const PRIORITY_VARIANTS = {
  none: 'default' as const,
  low: 'info' as const,
  medium: 'warning' as const,
  high: 'danger' as const,
};

const AGENT_EMOJIS: Record<string, string> = {
  product_engineer: '🔧',
  ux_architect: '🎨',
  qa_lead: '🧪',
  closer: '💰',
  daba: '🗄️',
  seesee: '🖥️',
  it_ops: '⚙️',
  router_agent: '🔀',
  ceo_bri: '👑',
};

const API_BASE = '/api/v2';

export function TaskBoard() {
  const [tasks, setTasks] = useState<BMCTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [draggedTask, setDraggedTask] = useState<string | null>(null);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [addColumn, setAddColumn] = useState<TaskStatus>('inbox');
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newPriority, setNewPriority] = useState<BMCTask['priority']>('none');
  const [newAgent, setNewAgent] = useState('');

  const fetchTasks = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/tasks`);
      if (res.ok) {
        const data = await res.json();
        setTasks(data.tasks || []);
      }
    } catch (err) {
      console.error('Failed to fetch tasks:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTasks();
    // SSE for real-time updates
    const es = new EventSource('/api/stream');
    es.addEventListener('task_update', (e) => {
      try {
        const update = JSON.parse(e.data);
        if (update.type === 'task_update') {
          fetchTasks();
        }
      } catch { /* ignore */ }
    });
    return () => es.close();
  }, [fetchTasks]);

  const handleDragStart = (taskId: string) => {
    setDraggedTask(taskId);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = async (e: React.DragEvent, targetStatus: TaskStatus) => {
    e.preventDefault();
    if (!draggedTask) return;

    const task = tasks.find(t => t.id === draggedTask);
    if (!task || task.status === targetStatus) {
      setDraggedTask(null);
      return;
    }

    // Optimistic update
    setTasks(prev => prev.map(t => t.id === draggedTask ? { ...t, status: targetStatus } : t));
    setDraggedTask(null);

    try {
      await fetch(`${API_BASE}/tasks/${draggedTask}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: targetStatus }),
      });
    } catch {
      fetchTasks(); // Revert on error
    }
  };

  const handleAddTask = async () => {
    if (!newTitle.trim()) return;
    try {
      await fetch(`${API_BASE}/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newTitle.trim(),
          description: newDescription.trim() || null,
          status: addColumn,
          priority: newPriority,
          assigned_agent: newAgent || null,
        }),
      });
      setNewTitle('');
      setNewDescription('');
      setNewPriority('none');
      setNewAgent('');
      setShowAddDialog(false);
      fetchTasks();
    } catch (err) {
      console.error('Failed to create task:', err);
    }
  };

  const getColumnTasks = (status: TaskStatus) =>
    tasks.filter(t => t.status === status).sort((a, b) => a.position - b.position);

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
        <h2 className="text-lg font-semibold text-[var(--text-secondary)]">Task Board</h2>
        <div className="text-xs text-[var(--text-muted)]">{tasks.length} tasks total</div>
      </div>

      <div className="grid grid-cols-5 gap-3 min-h-[500px]">
        {COLUMNS.map((col) => {
          const columnTasks = getColumnTasks(col.id);
          return (
            <div
              key={col.id}
              className={`bg-[var(--bg-card)] rounded-2xl border border-[var(--border-color)] border-t-4 ${col.color} flex flex-col`}
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, col.id)}
            >
              {/* Column Header */}
              <div className="px-3 py-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span>{col.icon}</span>
                  <span className="text-sm font-medium text-[var(--text-primary)]">{col.label}</span>
                  <span className="text-xs text-[var(--text-muted)] bg-[var(--bg-card-hover)] px-1.5 py-0.5 rounded-full">
                    {columnTasks.length}
                  </span>
                </div>
                <button
                  onClick={() => { setAddColumn(col.id); setShowAddDialog(true); }}
                  className="text-[var(--text-muted)] hover:text-[var(--accent)] transition-colors text-lg leading-none"
                  title="Add task"
                >
                  +
                </button>
              </div>

              {/* Task Cards */}
              <div className="flex-1 px-2 pb-2 space-y-2 overflow-y-auto max-h-[600px]">
                {columnTasks.map((task) => (
                  <div
                    key={task.id}
                    draggable
                    onDragStart={() => handleDragStart(task.id)}
                    className={`bg-[var(--bg-primary)] rounded-xl p-3 border border-[var(--border-color)] cursor-grab active:cursor-grabbing hover:border-[var(--accent)]/40 transition-all ${
                      draggedTask === task.id ? 'opacity-50 scale-95' : ''
                    }`}
                  >
                    <div className="text-sm font-medium text-[var(--text-primary)] mb-2 line-clamp-2">
                      {task.title}
                    </div>
                    {task.description && (
                      <div className="text-xs text-[var(--text-muted)] mb-2 line-clamp-1">
                        {task.description}
                      </div>
                    )}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        {task.priority !== 'none' && (
                          <Badge variant={PRIORITY_VARIANTS[task.priority]}>{task.priority}</Badge>
                        )}
                        {task.assigned_agent && (
                          <Badge variant="purple">
                            {AGENT_EMOJIS[task.assigned_agent] || '🤖'} {task.assigned_agent}
                          </Badge>
                        )}
                      </div>
                      <span className="text-[10px] text-[var(--text-muted)]">
                        {formatDistanceToNow(new Date(task.created_at), { addSuffix: true })}
                      </span>
                    </div>
                  </div>
                ))}
                {columnTasks.length === 0 && (
                  <div className="text-center py-8 text-xs text-[var(--text-muted)]">
                    Drop tasks here
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Add Task Dialog */}
      <Dialog open={showAddDialog} onClose={() => setShowAddDialog(false)} title={`Add Task → ${COLUMNS.find(c => c.id === addColumn)?.label}`}>
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">Title *</label>
            <input
              type="text"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="Task title..."
              className="w-full px-3 py-2 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
              autoFocus
              onKeyDown={(e) => { if (e.key === 'Enter') handleAddTask(); }}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">Description</label>
            <textarea
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
              placeholder="Optional description..."
              rows={3}
              className="w-full px-3 py-2 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)] resize-none"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">Priority</label>
              <select
                value={newPriority}
                onChange={(e) => setNewPriority(e.target.value as BMCTask['priority'])}
                className="w-full px-3 py-2 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg text-sm text-[var(--text-primary)]"
              >
                <option value="none">None</option>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--text-muted)] mb-1">Assign Agent</label>
              <select
                value={newAgent}
                onChange={(e) => setNewAgent(e.target.value)}
                className="w-full px-3 py-2 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg text-sm text-[var(--text-primary)]"
              >
                <option value="">Unassigned</option>
                {Object.keys(AGENT_EMOJIS).map(agent => (
                  <option key={agent} value={agent}>{AGENT_EMOJIS[agent]} {agent}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={() => setShowAddDialog(false)}
              className="px-4 py-2 text-sm text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleAddTask}
              disabled={!newTitle.trim()}
              className="px-4 py-2 bg-[var(--accent)] text-white rounded-lg text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              Create Task
            </button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
