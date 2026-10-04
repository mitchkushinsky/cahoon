import { useState, useEffect } from 'react'
import TaskList from './TaskList'

export default function TasksScreen({ onClose, tasks, completedTasks, isAdmin, onRefresh }) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true))
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  const handleClose = () => {
    setVisible(false)
    setTimeout(onClose, 250)
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-white flex flex-col"
      style={{
        transform: visible ? 'translateX(0)' : 'translateX(100%)',
        transition: 'transform 0.25s ease-out',
        paddingTop: 'env(safe-area-inset-top)',
      }}
    >
      {/* Header */}
      <header className="bg-white border-b border-gray-100 shadow-sm flex-shrink-0">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <button
            onClick={handleClose}
            className="text-blue-600 font-medium text-sm hover:text-blue-800 transition-colors flex items-center gap-1"
          >
            ← Back
          </button>
          <h2 className="text-base font-semibold text-gray-900 flex-1">Tasks</h2>
        </div>
      </header>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-4 py-4">
          <TaskList tasks={tasks} completedTasks={completedTasks} isAdmin={isAdmin} onRefresh={onRefresh} />
        </div>
      </div>
    </div>
  )
}
