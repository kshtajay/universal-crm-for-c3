import { useEffect, useState } from 'react'
import { CheckCircle2, Circle, Plus, Clock } from 'lucide-react'
import { supabase } from '../../../integrations/supabase/client'

interface Task {
  id: string
  title: string
  status: 'open' | 'complete'
  assignee_role: string | null
  due_at: string | null
  created_at: string
}

interface Props {
  leadId: string
  clientId: string
}

export function TasksTab({ leadId, clientId }: Props) {
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [newTitle, setNewTitle] = useState('')
  const [adding, setAdding] = useState(false)

  const load = () => {
    supabase
      .from('tasks')
      .select('id, title, status, assignee_role, due_at, created_at')
      .eq('lead_id', leadId)
      .order('created_at', { ascending: false })
      .then(({ data }) => { setTasks((data ?? []) as Task[]); setLoading(false) })
  }

  useEffect(() => { load() }, [leadId])

  const toggleTask = async (task: Task) => {
    const newStatus = task.status === 'open' ? 'complete' : 'open'
    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: newStatus } : t))
    await supabase.from('tasks').update({ status: newStatus }).eq('id', task.id)
  }

  const addTask = async () => {
    if (!newTitle.trim()) return
    setAdding(true)
    const { data } = await supabase
      .from('tasks')
      .insert({ lead_id: leadId, client_id: clientId, title: newTitle.trim(), status: 'open', assignee_role: 'tenant_agent' })
      .select('id, title, status, assignee_role, due_at, created_at')
      .single()

    if (data) setTasks(prev => [data as Task, ...prev])
    setNewTitle('')
    setAdding(false)
  }

  const open = tasks.filter(t => t.status === 'open')
  const done = tasks.filter(t => t.status === 'complete')

  return (
    <div className="p-5 space-y-4">
      {/* Add task */}
      <div className="flex gap-2">
        <input
          type="text"
          className="flex-1 bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          placeholder="Add a task…"
          value={newTitle}
          onChange={e => setNewTitle(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && addTask()}
        />
        <button
          onClick={addTask}
          disabled={adding || !newTitle.trim()}
          className="px-3 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium disabled:opacity-40 hover:opacity-90 transition-opacity"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[...Array(3)].map((_, i) => <div key={i} className="h-10 bg-secondary rounded-lg animate-pulse" />)}
        </div>
      ) : (
        <>
          {/* Open tasks */}
          {open.length > 0 && (
            <div className="space-y-1.5">
              {open.map(task => (
                <TaskRow key={task.id} task={task} onToggle={toggleTask} />
              ))}
            </div>
          )}

          {tasks.length === 0 && (
            <p className="text-muted-foreground text-sm text-center py-6">No tasks yet.</p>
          )}

          {/* Completed */}
          {done.length > 0 && (
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide pt-2">Completed</p>
              {done.map(task => (
                <TaskRow key={task.id} task={task} onToggle={toggleTask} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}

function TaskRow({ task, onToggle }: { task: Task; onToggle: (t: Task) => void }) {
  const isOverdue = task.due_at && new Date(task.due_at) < new Date() && task.status === 'open'

  return (
    <div
      className="flex items-start gap-2.5 p-2.5 rounded-lg hover:bg-secondary/60 cursor-pointer transition-colors group"
      onClick={() => onToggle(task)}
    >
      {task.status === 'complete'
        ? <CheckCircle2 className="w-4.5 h-4.5 text-primary shrink-0 mt-0.5" />
        : <Circle className="w-4.5 h-4.5 text-muted-foreground group-hover:text-foreground shrink-0 mt-0.5 transition-colors" />
      }
      <div className="flex-1 min-w-0">
        <p className={`text-sm ${task.status === 'complete' ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
          {task.title}
        </p>
        {task.due_at && (
          <span className={`flex items-center gap-1 text-xs mt-0.5 ${isOverdue ? 'text-destructive' : 'text-muted-foreground'}`}>
            <Clock className="w-3 h-3" />
            {new Date(task.due_at).toLocaleDateString('en-US', { dateStyle: 'medium' })}
            {isOverdue && ' · Overdue'}
          </span>
        )}
      </div>
    </div>
  )
}
