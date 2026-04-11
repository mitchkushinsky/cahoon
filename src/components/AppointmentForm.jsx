import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { toISODate } from '../lib/parseCSV'

export default function AppointmentForm({ weekStart, onSaved, onCancel }) {
  const [type, setType] = useState('cleaning')
  const [title, setTitle] = useState('')
  const [date, setDate] = useState(toISODate(weekStart) || '')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    if (!title.trim() || !date) return
    setSaving(true)
    const { error } = await supabase.from('appointments').insert({
      week_start: toISODate(weekStart),
      type,
      title: title.trim(),
      date,
      notes: notes.trim() || null,
    })
    setSaving(false)
    if (!error) onSaved()
  }

  return (
    <div className="border border-gray-200 rounded-xl p-4 space-y-3 bg-gray-50">
      <div className="flex gap-2">
        {['cleaning', 'repair'].map(t => (
          <button
            key={t}
            onClick={() => setType(t)}
            className={`flex-1 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
              type === t
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300'
            }`}
          >
            {t === 'cleaning' ? '🧹 Cleaning' : '🔧 Repair'}
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
          {saving ? 'Saving…' : 'Save Appointment'}
        </button>
      </div>
    </div>
  )
}
