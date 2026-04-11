import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { toISODate } from '../lib/parseCSV'
import AppointmentList from './AppointmentList'

export default function VacantModal({ week, appointments, onClose, onRefresh }) {
  const { weekStart } = week
  const [marking, setMarking] = useState(false)
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  const weekAppts = appointments.filter(a => a.week_start === toISODate(weekStart))

  const saveOwnerUse = async () => {
    setSaving(true)
    await supabase.from('owner_use').upsert(
      { week_start: toISODate(weekStart), notes: notes.trim() || null },
      { onConflict: 'week_start' }
    )
    setSaving(false)
    onRefresh()
    onClose()
  }

  return (
    <div className="p-5 space-y-5 pb-8">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-gray-900">Vacant Week</h2>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none p-1">×</button>
      </div>

      {!marking ? (
        <button
          onClick={() => setMarking(true)}
          className="w-full py-3 rounded-xl bg-blue-50 border border-blue-200 text-blue-700 font-medium text-sm hover:bg-blue-100 transition-colors"
        >
          🏠 Mark as Owner Use
        </button>
      ) : (
        <div className="space-y-3 border border-blue-200 rounded-xl p-4 bg-blue-50">
          <p className="text-sm font-medium text-blue-800">Mark as Owner Use</p>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            rows={3}
            placeholder="Notes (optional)"
            className="w-full border border-blue-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400 resize-none bg-white"
          />
          <div className="flex gap-2">
            <button
              onClick={() => setMarking(false)}
              className="flex-1 py-2 rounded-lg text-sm text-gray-500 border border-gray-200 bg-white hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={saveOwnerUse}
              disabled={saving}
              className="flex-1 py-2 rounded-lg text-sm font-medium bg-blue-600 text-white disabled:opacity-40 hover:bg-blue-700 transition-colors"
            >
              {saving ? 'Saving…' : 'Confirm'}
            </button>
          </div>
        </div>
      )}

      <AppointmentList appointments={weekAppts} weekStart={weekStart} onRefresh={onRefresh} />
    </div>
  )
}
