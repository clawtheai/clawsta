import { Router, Request, Response } from 'express';
import fs from 'fs';
import path from 'path';

const router = Router();

interface Task {
  id: string;
  title: string;
  description: string;
  status: 'todo' | 'assigned' | 'in_progress' | 'review' | 'done';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  created_by: string | null;
  created_at: string;
  updated_at: string;
  assignees: string[];
}

// Tasks storage (synced from mission control)
let tasks: Task[] = [];
const TASKS_FILE = path.join(process.cwd(), 'data', 'tasks.json');

// Load tasks from file
function loadTasks(): Task[] {
  try {
    if (fs.existsSync(TASKS_FILE)) {
      const data = fs.readFileSync(TASKS_FILE, 'utf-8');
      return JSON.parse(data);
    }
  } catch (e) {
    console.error('Failed to load tasks:', e);
  }
  return [];
}

// Save tasks to file
function saveTasks(taskList: Task[]): void {
  try {
    const dir = path.dirname(TASKS_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(TASKS_FILE, JSON.stringify(taskList, null, 2));
  } catch (e) {
    console.error('Failed to save tasks:', e);
  }
}

// Initialize
tasks = loadTasks();

// API: Get all tasks
router.get('/api/tasks', (req: Request, res: Response) => {
  res.json(tasks);
});

// API: Sync tasks (POST from local machine)
router.post('/api/tasks/sync', (req: Request, res: Response) => {
  const { secret, taskList } = req.body;
  
  // Simple secret check
  if (secret !== process.env.DASHBOARD_SECRET && secret !== 'claw-dashboard-2026') {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  if (!Array.isArray(taskList)) {
    return res.status(400).json({ error: 'Invalid task list' });
  }
  
  tasks = taskList;
  saveTasks(tasks);
  res.json({ success: true, count: tasks.length });
});

// Dashboard HTML page
router.get('/', (req: Request, res: Response) => {
  const statusColors: Record<string, string> = {
    todo: '#6b7280',
    assigned: '#3b82f6',
    in_progress: '#f59e0b',
    review: '#8b5cf6',
    done: '#10b981'
  };

  const priorityColors: Record<string, string> = {
    low: '#6b7280',
    medium: '#3b82f6',
    high: '#f59e0b',
    urgent: '#ef4444'
  };

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>🦞 Claw Squad Dashboard</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
      min-height: 100vh;
      color: #e5e5e5;
      padding: 20px;
    }
    .header {
      text-align: center;
      margin-bottom: 30px;
    }
    .header h1 {
      font-size: 2.5rem;
      margin-bottom: 10px;
    }
    .header p {
      color: #9ca3af;
      font-size: 1.1rem;
    }
    .stats {
      display: flex;
      gap: 15px;
      justify-content: center;
      flex-wrap: wrap;
      margin-bottom: 30px;
    }
    .stat {
      background: rgba(255,255,255,0.1);
      padding: 15px 25px;
      border-radius: 12px;
      text-align: center;
    }
    .stat-value {
      font-size: 2rem;
      font-weight: bold;
    }
    .stat-label {
      font-size: 0.9rem;
      color: #9ca3af;
    }
    .board {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
      gap: 20px;
      max-width: 1400px;
      margin: 0 auto;
    }
    .column {
      background: rgba(255,255,255,0.05);
      border-radius: 12px;
      padding: 15px;
    }
    .column-header {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 15px;
      padding-bottom: 10px;
      border-bottom: 1px solid rgba(255,255,255,0.1);
    }
    .column-dot {
      width: 12px;
      height: 12px;
      border-radius: 50%;
    }
    .column-title {
      font-weight: 600;
      text-transform: uppercase;
      font-size: 0.85rem;
      letter-spacing: 0.5px;
    }
    .column-count {
      margin-left: auto;
      background: rgba(255,255,255,0.1);
      padding: 2px 8px;
      border-radius: 10px;
      font-size: 0.8rem;
    }
    .task {
      background: rgba(255,255,255,0.08);
      border-radius: 8px;
      padding: 12px;
      margin-bottom: 10px;
    }
    .task:last-child { margin-bottom: 0; }
    .task-title {
      font-weight: 500;
      margin-bottom: 6px;
      line-height: 1.3;
    }
    .task-meta {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
      font-size: 0.75rem;
    }
    .task-priority {
      padding: 2px 6px;
      border-radius: 4px;
      font-weight: 500;
    }
    .task-assignees {
      color: #9ca3af;
    }
    .task-description {
      font-size: 0.8rem;
      color: #9ca3af;
      margin-top: 8px;
      line-height: 1.4;
      display: none;
    }
    .task:hover .task-description {
      display: block;
    }
    .refresh-time {
      text-align: center;
      color: #6b7280;
      font-size: 0.85rem;
      margin-top: 30px;
    }
    .no-tasks {
      color: #6b7280;
      text-align: center;
      padding: 20px;
      font-style: italic;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>🦞 Claw Squad Dashboard</h1>
    <p>Real-time view of what the agents are working on</p>
  </div>
  
  <div class="stats" id="stats">
    <div class="stat">
      <div class="stat-value" id="total-count">-</div>
      <div class="stat-label">Total Tasks</div>
    </div>
    <div class="stat">
      <div class="stat-value" id="active-count">-</div>
      <div class="stat-label">In Progress</div>
    </div>
    <div class="stat">
      <div class="stat-value" id="done-count">-</div>
      <div class="stat-label">Completed</div>
    </div>
  </div>
  
  <div class="board" id="board"></div>
  
  <div class="refresh-time" id="refresh-time">Loading...</div>

  <script>
    const statusColors = ${JSON.stringify(statusColors)};
    const priorityColors = ${JSON.stringify(priorityColors)};
    const columns = ['todo', 'assigned', 'in_progress', 'review', 'done'];
    const columnNames = {
      todo: 'To Do',
      assigned: 'Assigned',
      in_progress: 'In Progress',
      review: 'Review',
      done: 'Done'
    };

    function truncate(str, len) {
      if (!str) return '';
      return str.length > len ? str.slice(0, len) + '...' : str;
    }
    
    function escapeHtml(str) {
      if (!str) return '';
      return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;')
        .replace(/\`/g, '&#96;')
        .replace(/\\n/g, ' ');
    }

    async function loadTasks() {
      try {
        const res = await fetch('/dashboard/api/tasks');
        const tasks = await res.json();
        
        // Update stats
        document.getElementById('total-count').textContent = tasks.length;
        document.getElementById('active-count').textContent = 
          tasks.filter(t => t.status === 'in_progress').length;
        document.getElementById('done-count').textContent = 
          tasks.filter(t => t.status === 'done').length;
        
        // Group by status
        const grouped = {};
        columns.forEach(c => grouped[c] = []);
        tasks.forEach(t => {
          if (grouped[t.status]) grouped[t.status].push(t);
        });
        
        // Render board
        const board = document.getElementById('board');
        board.innerHTML = columns.map(col => {
          const colTasks = grouped[col] || [];
          return \`
            <div class="column">
              <div class="column-header">
                <div class="column-dot" style="background: \${statusColors[col]}"></div>
                <div class="column-title">\${columnNames[col]}</div>
                <div class="column-count">\${colTasks.length}</div>
              </div>
              \${colTasks.length === 0 ? '<div class="no-tasks">No tasks</div>' : ''}
              \${colTasks.map(task => \`
                <div class="task">
                  <div class="task-title">\${escapeHtml(task.title)}</div>
                  <div class="task-meta">
                    <span class="task-priority" style="background: \${priorityColors[task.priority]}20; color: \${priorityColors[task.priority]}">\${task.priority}</span>
                    \${task.assignees.length ? \`<span class="task-assignees">@\${task.assignees.join(', @')}</span>\` : ''}
                  </div>
                  <div class="task-description">\${escapeHtml(truncate(task.description, 200))}</div>
                </div>
              \`).join('')}
            </div>
          \`;
        }).join('');
        
        document.getElementById('refresh-time').textContent = 
          'Last updated: ' + new Date().toLocaleString();
      } catch (e) {
        document.getElementById('refresh-time').textContent = 'Failed to load tasks';
      }
    }

    loadTasks();
    setInterval(loadTasks, 30000); // Refresh every 30s
  </script>
</body>
</html>
  `;
  
  res.send(html);
});

export default router;
