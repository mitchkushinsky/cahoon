import { useState } from 'react'
import { supabase } from '../lib/supabase'
import AppointmentForm from './AppointmentForm'

const TYPES = [
  { value: 'cleaning',     label: '🧹 Cleaning' },
  { value: 'repair',       label: '🔨 Repair' },
  { value: 'exterminator', label: '🦟 Exterminator' },
  { value: 'other',        label: '📌 Other' },
]

function AppointmentEditForm({ appt, onSaved, onCancel, isDemo, onDemoWrite }) {
  const [type, setType] = useState(appt.type || 'cleaning')
  const [title, setTitle] = useState(appt.title || '')
  const [date, setDate] = useState(appt.date || '')
  const [timeWindow, setTimeWindow] = useState(appt.time_window || '')
  const [notes, setNotes] = useState(appt.notes || '')
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    if (!title.trim() || !date) return
    if (isDemo) { onDemoWrite(); return }
    setSaving(true)
    const d = new Date(date + 'T00:00:00')
    d.setDate(d.getDate() - d.getDay())
    const week_start = d.toISOString().slice(0, 10)
    await supabase.from('appointments').update({
      type,
      title: title.trim(),
      date,
      week_start,
      time_window: timeWindow.trim() || null,
      notes: notes.trim() || null,
    }).eq('id', appt.id)
    setSaving(false)
    onSaved()
  }

  return (
    <div className="border border-gray-200 rounded-xl p-4 space-y-3 bg-gray-50">
      <div className="flex gap-2">
        {TYPES.map(({ value, label }) => (
          <button
            key={value}
            onClick={() => setType(value)}
            className={`flex-1 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
              type === value
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <input
        type="text"
        placeholder="Title (e.g. Final cleaning, AC repair)"
        value={title}
        onChange={e => setTitle(e.target.value)}
        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
      />

      <input
        type="date"
        value={date}
        onChange={e => setDate(e.target.value)}
        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
      />

      <input
        type="text"
        placeholder="Time / Arrival Window (optional) — e.g. 9:00 AM – 11:00 AM"
        value={timeWindow}
        onChange={e => setTimeWindow(e.target.value)}
        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
      />

      <textarea
        placeholder="Notes (optional)"
        value={notes}
        onChange={e => setNotes(e.target.value)}
        rows={2}
        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400 resize-none"
      />

      <div className="flex gap-2">
        <button
          onClick={onCancel}
          className="flex-1 py-2 rounded-lg text-sm text-gray-500 border border-gray-200 hover:bg-gray-100 transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={!title.trim() || !date || saving}
          className="flex-1 py-2 rounded-lg text-sm font-medium bg-blue-600 text-white disabled:opacity-40 hover:bg-blue-700 transition-colors"
        >
          {saving ? 'Saving…' : 'Save Changes'}
        </button>
      </div>
    </div>
  )
}

export default function AppointmentList({ appointments, weekStart, onRefresh, isAdmin = true, isDemo, onDemoWrite }) {
  const [adding, setAdding] = useState(false)
  const [editingId, setEditingId] = useState(null)

  const handleDelete = async (id) => {
    if (isDemo) { onDemoWrite(); return }
    await supabase.from('appointments').delete().eq('id', id)
    onRefresh()
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-700">Appointments</h3>
        {isAdmin && !adding && (
          <button
            onClick={() => setAdding(true)}
            className="text-xs text-blue-600 font-medium hover:underline"
          >
            + Add
          </button>
        )}
      </div>

      {appointments.length === 0 && !adding && (
        <p className="text-sm text-gray-400 italic">No appointments</p>
      )}

      {appointments.map(appt => (
        editingId === appt.id ? (
          <AppointmentEditForm
            key={appt.id}
            appt={appt}
            onSaved={() => { setEditingId(null); onRefresh() }}
            onCancel={() => setEditingId(null)}
            isDemo={isDemo}
            onDemoWrite={onDemoWrite}
          />
        ) : (
          <div key={appt.id} className="flex items-start gap-2 p-3 bg-gray-50 rounded-lg border border-gray-100">
            <span className="text-base mt-0.5">
              {appt.type === 'cleaning' ? '🧹' : appt.type === 'exterminator' ? '🦟' : appt.type === 'other' ? '📌' : '🔨'}
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-800">{appt.title}</p>
              {appt.time_window && <p className="text-xs text-gray-500">{appt.time_window}</p>}
              <p className="text-xs text-gray-400">{appt.date}</p>
              {appt.notes && <p className="text-xs text-gray-500 mt-0.5">{appt.notes}</p>}
            </div>
            {isAdmin && (
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <button
                  onClick={() => { setEditingId(appt.id); setAdding(false) }}
                  className="text-gray-300 hover:text-blue-400 text-sm leading-none transition-colors"
                  aria-label="Edit appointment"
                >
                  ✏️
                </button>
                <button
                  onClick={() => handleDelete(appt.id)}
                  className="text-gray-300 hover:text-red-400 text-lg leading-none transition-colors"
                  aria-label="Delete appointment"
                >
                  ×
                </button>
              </div>
            )}
          </div>
        )
      ))}

      {adding && (
        <AppointmentForm
          weekStart={weekStart}
          onSaved={() => { setAdding(false); onRefresh() }}
          onCancel={() => setAdding(false)}
          isDemo={isDemo}
          onDemoWrite={onDemoWrite}
        />
      )}
    </div>
  )
}
