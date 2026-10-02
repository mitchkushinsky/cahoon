import { useState } from 'react'
import { supabase } from '../lib/supabase'

function formatDue(due_date) {
  if (!due_date) return null
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const [y, m, d] = String(due_date).slice(0, 10).split('-').map(Number)
  const due = new Date(y, m - 1, d)
  const diffDays = Math.round((due - today) / 86400000)
  const formatted = due.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  if (diffDays < 0) return { text: `Overdue · ${formatted}`, cls: 'text-red-500' }
  if (diffDays === 0) return { text: 'Due today', cls: 'text-amber-500' }
  return { text: `Due ${formatted}`, cls: 'text-gray-400' }
}

function formatCompleted(completed_at) {
  if (!completed_at) return ''
  const [y, m, d] = String(completed_at).slice(0, 10).split('-').map(Number)
  const date = new Date(y, m - 1, d)
  return 'Completed ' + date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// Options for the form's category <select>, and the fixed group order/labels
// for the list below — both read from this one place so they can't drift.
const TASK_CATEGORIES = [
  { value: '',                 label: 'None' },
  { value: 'winterize',        label: 'Winterize' },
  { value: 'new_season_setup', label: 'New Season Setup' },
]

// Buckets pending tasks into the three groups, preserving each task's
// existing relative order (already due_date-sorted by the query in App.jsx —
// this only partitions that order, never re-sorts it). Grouping is an
// all-or-nothing decision across the whole list: if nothing has a category
// yet, every task falls into "general" and the caller renders flat instead.
function groupTasksByCategory(tasks) {
  const winterize = tasks.filter(t => t.category === 'winterize')
  const newSeasonSetup = tasks.filter(t => t.category === 'new_season_setup')
  const general = tasks.filter(t => t.category !== 'winterize' && t.category !== 'new_season_setup')
  return [
    { key: 'winterize', label: 'Winterize', tasks: winterize },
    { key: 'new_season_setup', label: 'New Season Setup', tasks: newSeasonSetup },
    { key: 'general', label: 'General', tasks: general },
  ].filter(g => g.tasks.length > 0)
}

// One pending-task row — factored out so the flat list and the grouped-by-
// category list (below) render identical cards instead of two copies that
// could drift.
function TaskCard({ task, isAdmin, isCompleting, isCollapsing, isConfirm, onComplete, onEdit, onConfirmDelete, onCancelDelete, onDelete }) {
  const due = formatDue(task.due_date)
  return (
    <div style={collapseStyle(isCollapsing)}>
      <div className={`bg-white border border-gray-200 rounded-xl ${isCompleting ? 'task-flash' : ''}`}>
        {isConfirm ? (
          <div className="px-4 py-3 flex items-center justify-between gap-3">
            <p className="text-sm text-gray-700">Delete this task?</p>
            <div className="flex gap-2">
              <button
                onClick={() => onDelete(task.id)}
                className="px-3 py-1.5 bg-red-600 text-white text-xs font-medium rounded-lg hover:bg-red-700 transition-colors"
              >
                Delete
              </button>
              <button
                onClick={onCancelDelete}
                className="px-3 py-1.5 border border-gray-200 text-gray-600 text-xs font-medium rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="px-4 py-3 flex items-start gap-3">
            <button
              onClick={() => onComplete(task)}
              disabled={isCompleting}
              className="flex-shrink-0 mt-0.5 w-7 h-7 rounded-full border-2 border-gray-300 flex items-center justify-center hover:border-green-400 disabled:cursor-default transition-colors text-base leading-none"
              aria-label="Mark complete"
            >
              {isCompleting ? '✅' : ''}
            </button>
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-semibold ${isCompleting ? 'text-green-700 line-through' : 'text-gray-900'}`}>
                {task.title}
              </p>
              {due && (
                <p className={`text-xs mt-0.5 ${due.cls}`}>{due.text}</p>
              )}
              {task.notes && (
                <p className="text-xs text-gray-400 mt-1 leading-snug">{task.notes}</p>
              )}
            </div>
            {isAdmin && !isCompleting && (
              <div className="flex gap-0.5 flex-shrink-0 -mr-1">
                <button
                  onClick={() => onEdit(task)}
                  className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors leading-none"
                  title="Edit"
                >
                  ✏️
                </button>
                <button
                  onClick={() => onConfirmDelete(task.id)}
                  className="p-1.5 text-gray-400 hover:text-red-500 rounded-lg hover:bg-red-50 transition-colors leading-none"
                  title="Delete"
                >
                  🗑️
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

const collapseStyle = (collapsing) =>
  collapsing
    ? { maxHeight: 0, opacity: 0, marginBottom: 0, overflow: 'hidden',
        transition: 'max-height 0.35s ease, opacity 0.15s ease, margin-bottom 0.35s ease' }
    : { maxHeight: '300px', marginBottom: '8px',
        transition: 'max-height 0.35s ease, opacity 0.15s ease, margin-bottom 0.35s ease' }

export default function TaskList({ tasks, completedTasks = [], isAdmin, onRefresh }) {
  const [completingIds, setCompletingIds] = useState(new Set())
  const [collapsingIds, setCollapsingIds] = useState(new Set())
  const [showForm, setShowForm]           = useState(false)
  const [editingTask, setEditingTask]     = useState(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState(null)
  const [formTitle, setFormTitle]   = useState('')
  const [formNotes, setFormNotes]   = useState('')
  const [formDueDate, setFormDueDate] = useState('')
  const [formCategory, setFormCategory] = useState('')
  const [saving, setSaving]         = useState(false)
  const [showCompleted, setShowCompleted] = useState(false)

  if (tasks.length === 0 && !showForm && !isAdmin) return null

  const handleComplete = async (task) => {
    if (completingIds.has(task.id)) return
    const { error } = await supabase
      .from('tasks')
      .update({ completed_at: new Date().toISOString() })
      .eq('id', task.id)
    if (error) { console.error('Task update failed:', error); return }
    setCompletingIds(prev => new Set([...prev, task.id]))
    setTimeout(() => {
      setCollapsingIds(prev => new Set([...prev, task.id]))
      setTimeout(() => onRefresh(), 400)
    }, 1500)
  }

  const openAdd = () => {
    setEditingTask(null)
    setFormTitle('')
    setFormNotes('')
    setFormDueDate('')
    setFormCategory('')
    setShowForm(true)
  }

  const openEdit = (task) => {
    setEditingTask(task)
    setFormTitle(task.title)
    setFormNotes(task.notes || '')
    setFormDueDate(task.due_date ? String(task.due_date).slice(0, 10) : '')
    setFormCategory(task.category || '')
    setShowForm(true)
  }

  const cancelForm = () => { setShowForm(false); setEditingTask(null) }

  const handleSave = async () => {
    if (!formTitle.trim()) return
    setSaving(true)
    const payload = {
      title:    formTitle.trim(),
      notes:    formNotes.trim() || null,
      due_date: formDueDate || null,
      category: formCategory || null,
    }
    if (editingTask) {
      await supabase.from('tasks').update(payload).eq('id', editingTask.id)
    } else {
      await supabase.from('tasks').insert(payload)
    }
    setSaving(false)
    setShowForm(false)
    setEditingTask(null)
    onRefresh()
  }

  const handleDelete = async (id) => {
    await supabase.from('tasks').delete().eq('id', id)
    setConfirmDeleteId(null)
    onRefresh()
  }

  return (
    <div className="mb-4">
      {/* Section header */}
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-sm font-bold text-gray-700">
          📋 {isAdmin ? 'Tasks' : 'Tasks from Mitch'}
        </h2>
        {isAdmin && (
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowCompleted(v => !v)}
              className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
            >
              {showCompleted ? 'Hide Completed' : 'Show Completed'}
            </button>
            {!showForm && (
              <button
                onClick={openAdd}
                className="text-sm text-blue-600 font-medium hover:underline"
              >
                + Add Task
              </button>
            )}
          </div>
        )}
      </div>

      {/* Add / Edit form */}
      {showForm && (
        <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3 mb-2">
          <input
            type="text"
            placeholder="Task title (required)"
            value={formTitle}
            onChange={e => setFormTitle(e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
            autoFocus
          />
          <textarea
            placeholder="Notes (optional)"
            value={formNotes}
            onChange={e => setFormNotes(e.target.value)}
            rows={2}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400 resize-none"
          />
          <input
            type="date"
            value={formDueDate}
            onChange={e => setFormDueDate(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
          />
          <select
            value={formCategory}
            onChange={e => setFormCategory(e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400 bg-white"
          >
            {TASK_CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
          <div className="flex gap-2 pt-1">
            <button
              onClick={handleSave}
              disabled={saving || !formTitle.trim()}
              className="flex-1 py-2 bg-blue-600 text-white text-sm font-medium rounded-xl disabled:opacity-40 hover:bg-blue-700 transition-colors"
            >
              {saving ? 'Saving…' : editingTask ? 'Save Changes' : 'Add Task'}
            </button>
            <button
              onClick={cancelForm}
              className="flex-1 py-2 border border-gray-200 text-gray-600 text-sm font-medium rounded-xl hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Pending task cards — grouped by category once any task has one set
          (visible in caretaker mode too, same as the rest of this list;
          only the +Add/Edit/Delete controls are isAdmin-gated, unchanged).
          Otherwise the same flat list as before, no headers. */}
      {(() => {
        const cardProps = {
          isAdmin,
          onComplete: handleComplete,
          onEdit: openEdit,
          onConfirmDelete: setConfirmDeleteId,
          onCancelDelete: () => setConfirmDeleteId(null),
          onDelete: handleDelete,
        }
        const hasCategorized = tasks.some(t => t.category)
        if (!hasCategorized) {
          return (
            <div>
              {tasks.map(task => (
                <TaskCard
                  key={task.id}
                  task={task}
                  isCompleting={completingIds.has(task.id)}
                  isCollapsing={collapsingIds.has(task.id)}
                  isConfirm={confirmDeleteId === task.id}
                  {...cardProps}
                />
              ))}
            </div>
          )
        }
        return groupTasksByCategory(tasks).map(group => (
          <div key={group.key} className="mb-3">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5 px-1">{group.label}</p>
            {group.tasks.map(task => (
              <TaskCard
                key={task.id}
                task={task}
                isCompleting={completingIds.has(task.id)}
                isCollapsing={collapsingIds.has(task.id)}
                isConfirm={confirmDeleteId === task.id}
                {...cardProps}
              />
            ))}
          </div>
        ))
      })()}

      {tasks.length === 0 && !showForm && (
        <p className="text-xs text-gray-400 px-1">No pending tasks</p>
      )}

      {/* Completed tasks */}
      {isAdmin && showCompleted && completedTasks.length > 0 && (
        <div className="mt-3">
          <div className="flex items-center gap-2 mb-2">
            <div className="flex-1 h-px bg-gray-100" />
            <span className="text-xs text-gray-400 font-medium">Completed</span>
            <div className="flex-1 h-px bg-gray-100" />
          </div>
          <div>
            {completedTasks.map(task => {
              const isConfirm = confirmDeleteId === task.id
              return (
                <div key={task.id} style={{ marginBottom: '8px' }}>
                  <div className="bg-white border border-gray-100 rounded-xl">
                    {isConfirm ? (
                      <div className="px-4 py-3 flex items-center justify-between gap-3">
                        <p className="text-sm text-gray-700">Delete this task?</p>
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleDelete(task.id)}
                            className="px-3 py-1.5 bg-red-600 text-white text-xs font-medium rounded-lg hover:bg-red-700 transition-colors"
                          >
                            Delete
                          </button>
                          <button
                            onClick={() => setConfirmDeleteId(null)}
                            className="px-3 py-1.5 border border-gray-200 text-gray-600 text-xs font-medium rounded-lg hover:bg-gray-50 transition-colors"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="px-4 py-3 flex items-start gap-3">
                        <span className="flex-shrink-0 mt-0.5 text-base leading-none">✅</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-gray-400 line-through">{task.title}</p>
                          <p className="text-xs text-gray-400 mt-0.5">{formatCompleted(task.completed_at)}</p>
                        </div>
                        <button
                          onClick={() => setConfirmDeleteId(task.id)}
                          className="p-1.5 text-gray-300 hover:text-red-400 rounded-lg hover:bg-red-50 transition-colors leading-none flex-shrink-0 -mr-1"
                          title="Delete"
                        >
                          🗑️
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
