import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { toISODate } from '../lib/parseCSV'
import AppointmentList from './AppointmentList'
import CaretakerNotes from './CaretakerNotes'

export default function OwnerUseModal({ week, ownerUseRow, appointments, caretakerNote, isAdmin, onClose, onRefresh }) {
  const { weekStart } = week
  const [editing, setEditing] = useState(false)
  const [notes, setNotes] = useState(ownerUseRow?.notes || '')
  const [saving, setSaving] = useState(false)

  const weekAppts = appointments.filter(a => a.week_start === toISODate(weekStart))

  const saveNotes = async () => {
    setSaving(true)
    await supabase.from('owner_use').upsert(
      { week_start: toISODate(weekStart), notes: notes.trim() || null },
      { onConflict: 'week_start' }
    )
    setSaving(false)
    setEditing(false)
    onRefresh()
  }

  const removeOwnerUse = async () => {
    if (!confirm('Remove owner use for this week?')) return
    await supabase.from('owner_use').delete().eq('week_start', toISODate(weekStart))
    onRefresh()
    onClose()
  }

  return (
    <div className="p-5 space-y-5 pb-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xl">🏠</span>
          <h2 className="text-lg font-bold text-gray-900">Owner Use</h2>
        </div>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none p-1">×</button>
      </div>

      {/* Owner Notes (admin only) */}
      {isAdmin && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-700">Notes</h3>
            {!editing && (
              <button onClick={() => setEditing(true)} className="text-xs text-blue-600 hover:underline">Edit</button>
            )}
          </div>

          {editing ? (
            <div className="space-y-2">
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                rows={3}
                placeholder="Notes (optional)"
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-400 resize-none"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => { setEditing(false); setNotes(ownerUseRow?.notes || '') }}
                  className="flex-1 py-2 rounded-lg text-sm text-gray-500 border border-gray-200 hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={saveNotes}
                  disabled={saving}
                  className="flex-1 py-2 rounded-lg text-sm font-medium bg-blue-600 text-white disabled:opacity-40 hover:bg-blue-700 transition-colors"
                >
                  {saving ? 'Saving…' : 'Save'}
                </button>
              </div>
            </div>
          ) : (
            <p className="text-sm text-gray-500 italic">{ownerUseRow?.notes || 'No notes'}</p>
          )}
        </div>
      )}

      <CaretakerNotes weekStart={weekStart} caretakerNote={caretakerNote} isAdmin={isAdmin} onRefresh={onRefresh} />

      <AppointmentList appointments={weekAppts} weekStart={weekStart} onRefresh={onRefresh} isAdmin={isAdmin} />

      {/* Danger zone (admin only) */}
      {isAdmin && (
        <div className="border-t border-gray-100 pt-4">
          <button
            onClick={removeOwnerUse}
            className="text-sm text-red-400 hover:text-red-600 hover:underline"
          >
            Remove Owner Use
          </button>
        </div>
      )}
    </div>
  )
}
