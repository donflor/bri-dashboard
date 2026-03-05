import re

with open("src/app/page.tsx", "r") as f:
    content = f.read()

# 1. Add imports
imports = """
import { TaskBoard } from '@/components/TaskBoard';
import { ApprovalQueue } from '@/components/ApprovalQueue';
import { AgentLogStream } from '@/components/AgentLogStream';
import { ActivityTimeline } from '@/components/ActivityTimeline';
import { Tabs } from '@/components/ui/Tabs';
"""
content = re.sub(r'(import { EmptyState } from \'@/components/EmptyState\';)', r'\1\n' + imports.strip(), content)

# 2. Update TabType
content = re.sub(
    r"type TabType = 'status' \| 'manage' \| 'observe' \| 'activity';",
    "type TabType = 'overview' | 'tasks' | 'approvals' | 'activity' | 'logs';",
    content
)

# 3. Update initial tab
content = re.sub(r"useState<TabType>\('status'\)", "useState<TabType>('overview')", content)

# 4. Insert Top Tabs
tabs_jsx = """
        <div className="max-w-4xl mx-auto p-4 pb-0">
          <Tabs 
            tabs={[
              { id: 'overview', label: 'Overview', icon: '📊' },
              { id: 'tasks', label: 'Tasks', icon: '📝' },
              { id: 'approvals', label: 'Approvals', icon: '✅' },
              { id: 'activity', label: 'Activity', icon: '📋' },
              { id: 'logs', label: 'Agent Logs', icon: '📡' },
            ]}
            activeTab={activeTab}
            onChange={(id) => switchTab(id as TabType)}
          />
        </div>
"""
content = re.sub(r'(<main className="flex-1 overflow-y-auto pb-20">)', r'\1\n' + tabs_jsx, content)

# 5. Rename 'status' tab to 'overview' and wrap the existing 3 tabs in 'overview'
content = re.sub(r"\{/\* ═══════════ STATUS TAB ═══════════ \*/\}", "{/* ═══════════ OVERVIEW TAB ═══════════ */}", content)
content = re.sub(r"activeTab === 'status'", "activeTab === 'overview'", content)

# 6. Insert new content blocks
new_blocks = """
          {/* ═══════════ NEW BMC V2 TABS ═══════════ */}
          {activeTab === 'tasks' && <TaskBoard />}
          {activeTab === 'approvals' && <ApprovalQueue />}
          {activeTab === 'logs' && <AgentLogStream />}
          
          {/* ═══════════ ACTIVITY TIMELINE (V2) ═══════════ */}
          {activeTab === 'activity' && <ActivityTimeline />}
"""

# Replace the old activity tab with V2 ActivityTimeline if activeTab === 'activity'. But I'll just keep the old one and wrap it, or actually we want to use the new V2 one. The prompt says "Activity (ActivityTimeline)". I'll just hide the old activity tab and insert the new ones.
# Find where OBSERVABILITY TAB ends (before ACTIVITY TAB starts)
content = re.sub(
    r"(\{\/\* ═══════════ ACTIVITY TAB ═══════════ \*\/\}[\s\S]*?)(\<\/div\>\n      \<\/main\>)", 
    new_blocks + r'\2', 
    content
)

# We should also hide the bottom nav or just change its items, but the prompt says "Add a tab navigation at the top", I'll just leave the bottom nav or remove it. Let's remove the bottom nav.
content = re.sub(r"(<nav className=\"fixed bottom-0 left-0 right-0.*?</nav>)", "", content, flags=re.DOTALL)

with open("src/app/page.tsx", "w") as f:
    f.write(content)
