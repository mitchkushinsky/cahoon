import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { STATUS_META, STATUS_OPTIONS, fmtMoney, buildInviteEmailPreview } from '../lib/seasonInvites'
import SeasonInviteEmailModal from './SeasonInviteEmailModal'

const inputCls = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400 bg-white'

export default function SeasonInviteModal({ invite, renter, onClose, onUpdated }) {
  const [proposedStart, setProposedStart] = useState(invite.proposed_start || '')
  const [proposedEnd, setProposedEnd] = useState(invite.proposed_end || '')
  const [proposedRent, setProposedRent] = useState(invite.proposed_rent ?? '')
  const [notes, setNotes] = useState(invite.notes || '')
  const [notesSaved, setNotesSaved] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [showPreview, setShowPreview] = useState(false)

  // Dates and rent are only ever editable before the first send — once a
  // status beyond "not_sent" is set, what was actually proposed is a record
  // of what was sent, not a draft to keep adjusting.
  const locked = invite.status !== 'not_sent'

  const persist = async (patch) => {
    setSaving(true)
    setError(null)
    const { error: err } = await supabase
      .from('season_invites')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('id', invite.id)
    setSaving(false)
    if (err) { setError(err.message); return false }
    onUpdated({ ...invite, ...patch })
    return true
  }

  const saveDateField = (field, value) => {
    if (locked) return
    persist({ [field]: value || null })
  }

  const saveRent = () => {
    if (locked) return
    const amt = proposedRent === '' ? null : Number(proposedRent)
    persist({ proposed_rent: amt })
  }

  const handleStatusChange = (e) => {
    persist({ status: e.target.value })
  }

  const handleMarkSent = () => {
    persist({ status: 'sent' })
  }

  const handleSaveNotes = async () => {
    const ok = await persist({ notes: notes.trim() || null })
    if (ok) {
      setNotesSaved(true)
      setTimeout(() => setNotesSaved(false), 2000)
    }
  }

  const preview = buildInviteEmailPreview(invite, renter)
  const statusMeta = STATUS_META[invite.status] || STATUS_META.not_sent

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-lg max-h-[92dvh] flex flex-col shadow-2xl">

        {/* Header */}
        <div className="flex items-start justify-between px-5 py-4 border-b border-gray-100 flex-shrink-0">
          <div>
            <h2 className="text-lg font-bold text-gray-900">{renter?.name || 'Unknown'}</h2>
            {renter?.email && (
              <a href={`mailto:${renter.email}`} className="text-sm text-blue-600 hover:underline">{renter.email}</a>
            )}
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none p-1">×</button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">

          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${statusMeta.badgeClass}`}>
            {statusMeta.label}
          </span>

          {/* Proposed dates + rent */}
          <div className="space-y-3">
            <p className="text-sm font-semibold text-gray-700">Proposed {new Date().getFullYear() + 1} Week</p>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Start Date</label>
                {locked ? (
                  <p className="text-sm text-gray-800 py-2">{proposedStart || '—'}</p>
                ) : (
                  <input
                    type="date"
                    value={proposedStart}
                    onChange={e => setProposedStart(e.target.value)}
                    onBlur={() => saveDateField('proposed_start', proposedStart)}
                    className={inputCls}
                  />
                )}
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">End Date</label>
                {locked ? (
                  <p className="text-sm text-gray-800 py-2">{proposedEnd || '—'}</p>
                ) : (
                  <input
                    type="date"
                    value={proposedEnd}
                    onChange={e => setProposedEnd(e.target.value)}
                    onBlur={() => saveDateField('proposed_end', proposedEnd)}
                    className={inputCls}
                  />
                )}
              </div>
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Proposed Rent</label>
              {locked ? (
                <p className="text-sm text-gray-800 py-2">{fmtMoney(proposedRent)}</p>
              ) : (
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                  <input
                    type="number"
                    inputMode="decimal"
                    step="1"
                    min="0"
                    value={proposedRent}
                    onChange={e => setProposedRent(e.target.value)}
                    onBlur={saveRent}
                    className={`${inputCls} pl-7`}
                  />
                </div>
              )}
            </div>
          </div>

          {/* Status selector */}
          <div>
            <label className="text-xs font-semibold text-gray-500 block mb-1">Status</label>
            <select value={invite.status} onChange={handleStatusChange} className={inputCls}>
              {STATUS_OPTIONS.map(s => (
                <option key={s} value={s}>{STATUS_META[s].label}</option>
              ))}
            </select>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-gray-500 block">Notes</label>
            <textarea
              value={notes}
              onChange={e => { setNotes(e.target.value); setNotesSaved(false) }}
              rows={3}
              placeholder="Add notes…"
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-400 resize-none"
            />
            <button
              onClick={handleSaveNotes}
              disabled={saving}
              className="text-sm font-medium text-blue-600 hover:underline disabled:opacity-40"
            >
              {notesSaved ? '✓ Saved' : saving ? 'Saving…' : 'Save Notes'}
            </button>
          </div>

          {error && <p className="text-xs text-red-600">{error}</p>}

        </div>

        {/* Actions */}
        <div className="px-5 py-4 border-t border-gray-100 flex-shrink-0 space-y-2">
          <button
            onClick={() => setShowPreview(true)}
            className="w-full py-2.5 rounded-xl text-sm font-medium border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Preview & Copy Email
          </button>
          <button
            onClick={handleMarkSent}
            disabled={invite.status === 'sent'}
            className="w-full py-2.5 rounded-xl text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-40 transition-colors"
          >
            Mark as Sent ✓
          </button>
        </div>

      </div>

      {showPreview && (
        <SeasonInviteEmailModal
          email={preview.email}
          subject={preview.subject}
          html={preview.html}
          plain={preview.plain}
          onClose={() => setShowPreview(false)}
        />
      )}
    </div>
  )
}
