import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { toISODate } from '../lib/parseCSV'

export default function CaretakerNotes({ weekStart, caretakerNote, isAdmin, onRefresh }) {
  const existing = caretakerNote?.note || ''
  const [text, setText] = useState(existing)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const save = async () => {
    setSaving(true)
    await supabase.from('caretaker_notes').upsert(
      { week_start: toISODate(weekStart), note: text.trim() || null, updated_at: new Date().toISOString() },
      { onConflict: 'week_start' }
    )
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
    onRefresh()
  }

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold text-gray-700">{isAdmin ? 'Caretaker Notes' : 'Note'}</h3>
      <textarea
        value={text}
        onChange={e => { setText(e.target.value); setSaved(false) }}
        rows={3}
        placeholder="Notes for the caretaker…"
        className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-400 resize-none"
      />
      <button
        onClick={save}
        disabled={saving}
        className="text-sm font-medium text-blue-600 hover:underline disabled:opacity-40"
      >
        {saved ? '✓ Saved' : saving ? 'Saving…' : 'Save Note'}
      </button>
    </div>
  )
}
