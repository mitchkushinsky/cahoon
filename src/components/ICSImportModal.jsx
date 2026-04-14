import { useState, useRef } from 'react'
import { parseICS } from '../lib/parseICS'
import { supabase } from '../lib/supabase'

const fmtDate = (dateStr) => {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export default function ICSImportModal({ onClose, onImported }) {
  const [appointments, setAppointments] = useState(null)
  const [status, setStatus] = useState('idle') // idle | previewing | importing | done | error
  const [message, setMessage] = useState('')
  const inputRef = useRef()

  const handleFile = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const parsed = parseICS(ev.target.result)
        setAppointments(parsed)
        setStatus('previewing')
      } catch (err) {
        setMessage('Failed to parse ICS file: ' + (err.message || 'Unknown error'))
        setStatus('error')
      }
    }
    reader.readAsText(file)
  }

  const handleImport = async () => {
    setStatus('importing')
    try {
      // ignoreDuplicates: true on (week_start, title, date) means re-importing
      // the same ICS file is safe — existing rows are silently skipped.
      const { error } = await supabase
        .from('appointments')
        .upsert(appointments, { ignoreDuplicates: true, onConflict: 'week_start,title,date' })
      if (error) throw error
      setMessage(`Imported ${appointments.length} appointment${appointments.length !== 1 ? 's' : ''}`)
      setStatus('done')
      onImported()
    } catch (err) {
      setMessage('Import failed: ' + (err.message || 'Unknown error'))
      setStatus('error')
    }
  }

  const cleaningCount = appointments?.filter(a => a.type === 'cleaning').length ?? 0
  const repairCount   = appointments?.filter(a => a.type === 'repair').length ?? 0

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[85dvh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">Import Calendar</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {(status === 'idle' || status === 'error') && (
            <>
              <p className="text-sm text-gray-500">
                Export your Google Calendar as an ICS file and upload it here to import appointments.
              </p>
              <button
                onClick={() => inputRef.current?.click()}
                className="w-full py-2.5 rounded-xl border-2 border-dashed border-gray-200 text-sm text-blue-600 font-medium hover:border-blue-300 hover:bg-blue-50 transition-colors"
              >
                Choose .ics file
              </button>
              <input
                ref={inputRef}
                type="file"
                accept=".ics"
                className="hidden"
                onChange={handleFile}
              />
              {status === 'error' && (
                <p className="text-sm text-red-600">{message}</p>
              )}
            </>
          )}

          {(status === 'previewing' || status === 'importing') && appointments && (
            <>
              <p className="text-sm text-gray-700 font-medium">
                Found {cleaningCount} cleaning appointment{cleaningCount !== 1 ? 's' : ''},{' '}
                {repairCount} other appointment{repairCount !== 1 ? 's' : ''}
              </p>
              <div className="space-y-1 max-h-64 overflow-y-auto rounded-lg border border-gray-100 divide-y divide-gray-50">
                {appointments.map((appt, i) => (
                  <div key={i} className="flex items-center gap-2 px-3 py-2">
                    <span className="text-base flex-shrink-0">
                      {appt.type === 'cleaning' ? '🧹' : '🔨'}
                    </span>
                    <span className="text-sm text-gray-700">
                      {fmtDate(appt.date)} — {appt.title}
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}

          {status === 'done' && (
            <p className="text-sm text-green-700 font-medium">{message}</p>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 pb-5 pt-3 border-t border-gray-100 flex gap-2">
          {status === 'previewing' && (
            <>
              <button
                onClick={handleImport}
                className="flex-1 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 transition-colors"
              >
                Import {appointments.length} appointment{appointments.length !== 1 ? 's' : ''}
              </button>
              <button
                onClick={onClose}
                className="px-4 py-2.5 text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
              >
                Cancel
              </button>
            </>
          )}

          {status === 'importing' && (
            <div className="flex-1 flex items-center justify-center gap-2 py-2">
              <div className="w-4 h-4 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
              <span className="text-sm text-gray-500">Importing…</span>
            </div>
          )}

          {(status === 'done' || status === 'idle' || status === 'error') && (
            <button
              onClick={onClose}
              className="flex-1 py-2.5 bg-gray-100 text-gray-700 text-sm font-semibold rounded-xl hover:bg-gray-200 transition-colors"
            >
              {status === 'done' ? 'Done' : 'Cancel'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
