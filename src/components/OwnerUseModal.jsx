import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { toISODate } from '../lib/parseCSV'
import AppointmentList from './AppointmentList'
import CaretakerNotes from './CaretakerNotes'

const inputCls = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400 bg-white'

export default function OwnerUseModal({ week, ownerUseRow, appointments, caretakerNote, isAdmin, onClose, onRefresh, isDemo, onDemoWrite, ownerLockCode, lockboxCode }) {
  const { weekStart } = week

  const weekEndDate = new Date(weekStart)
  weekEndDate.setDate(weekEndDate.getDate() + 6)

  const [editing, setEditing] = useState(false)
  const [notes, setNotes] = useState(ownerUseRow?.notes || '')
  const [startDate, setStartDate] = useState(ownerUseRow?.start_date || toISODate(weekStart))
  const [endDate, setEndDate] = useState(ownerUseRow?.end_date || toISODate(weekEndDate))
  const [saving, setSaving] = useState(false)

  const weekAppts = appointments.filter(a => a.week_start === toISODate(weekStart))

  const saveNotes = async () => {
    if (isDemo) { onDemoWrite(); return }
    setSaving(true)
    await supabase.from('owner_use').upsert(
      { week_start: toISODate(weekStart), notes: notes.trim() || null, start_date: startDate, end_date: endDate },
      { onConflict: 'week_start' }
    )
    setSaving(false)
    setEditing(false)
    onRefresh()
  }

  const removeOwnerUse = async () => {
    if (isDemo) { onDemoWrite(); return }
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
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Start Date</label>
                  <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className={inputCls} />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">End Date</label>
                  <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className={inputCls} />
                </div>
              </div>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                rows={3}
                placeholder="Notes (optional)"
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-400 resize-none"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setEditing(false)
                    setNotes(ownerUseRow?.notes || '')
                    setStartDate(ownerUseRow?.start_date || toISODate(weekStart))
                    setEndDate(ownerUseRow?.end_date || toISODate(weekEndDate))
                  }}
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

      {isAdmin && (ownerLockCode || lockboxCode) && (
        <div className="bg-gray-50 rounded-xl px-4 py-3 space-y-1">
          {ownerLockCode && (
            <p className="text-sm text-gray-700">🔑 Smart Lock: <span className="font-mono font-semibold tracking-widest">{ownerLockCode}</span></p>
          )}
          {lockboxCode && (
            <p className="text-sm text-gray-700">🔒 Lock Box: <span className="font-mono font-semibold tracking-widest">{lockboxCode}</span></p>
          )}
        </div>
      )}

      <CaretakerNotes weekStart={weekStart} caretakerNote={caretakerNote} isAdmin={isAdmin} onRefresh={onRefresh} isDemo={isDemo} onDemoWrite={onDemoWrite} />

      <AppointmentList appointments={weekAppts} weekStart={weekStart} onRefresh={onRefresh} isAdmin={isAdmin} isDemo={isDemo} onDemoWrite={onDemoWrite} />

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
