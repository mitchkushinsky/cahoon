import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { toISODate } from '../lib/parseCSV'
import { computePayment, milestoneStatus } from '../lib/paymentLogic'
import { buildRenterKey } from '../lib/resolvePayments'
import AppointmentList from './AppointmentList'
import AddPaymentDrawer from './AddPaymentDrawer'
import CaretakerNotes from './CaretakerNotes'

function fmt(n) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n ?? 0)
}

const badgeClass = {
  green:  'bg-green-100 text-green-700',
  yellow: 'bg-yellow-100 text-yellow-700',
  red:    'bg-red-100 text-red-700',
  gray:   'bg-gray-100 text-gray-500',
}

function calcMilestones(totalRent) {
  const rent = Number(totalRent) || 0
  if (!rent) return { payment1_owed: null, payment2_owed: null, payment3_owed: null }
  const deposit  = 500
  const payment2 = (rent - deposit) / 2
  const payment3 = rent - deposit - payment2
  return { payment1_owed: deposit, payment2_owed: payment2, payment3_owed: payment3 }
}

// ─── EditRentalForm ───────────────────────────────────────────────────────────

function EditRentalForm({ week, onSaved, onCancel }) {
  const [startDate,     setStartDate]     = useState(toISODate(week.startDate))
  const [endDate,       setEndDate]       = useState(toISODate(week.endDate))
  const [totalRent,     setTotalRent]     = useState(week.totalRent || '')
  const [leaseStatus,   setLeaseStatus]   = useState(week.leaseStatus || '')
  const [leaseUrl,      setLeaseUrl]      = useState(week.leaseUrl || '')
  const [smartLock,     setSmartLock]     = useState(week.smartLockCombo || '')
  const [saving,        setSaving]        = useState(false)
  const [error,         setError]         = useState(null)

  const handleSave = async () => {
    if (!startDate || !endDate) return
    setSaving(true)
    setError(null)
    try {
      const milestones = calcMilestones(totalRent)
      const { error: err } = await supabase
        .from('rentals')
        .update({
          start_date:    startDate,
          end_date:      endDate,
          total_rent:    totalRent ? Number(totalRent) : null,
          lease_status:  leaseStatus.trim() || null,
          lease_url:     leaseUrl.trim() || null,
          smart_lock_combo: smartLock.trim() || null,
          ...milestones,
        })
        .eq('id', week.rentalId)
      if (err) throw new Error(err.message)
      onSaved()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const inputCls = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400 bg-white'

  return (
    <div className="space-y-3 border border-blue-200 rounded-xl p-4 bg-blue-50">
      <p className="text-sm font-medium text-blue-800">Edit Rental</p>

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

      <input
        type="number"
        placeholder="Total Rent"
        value={totalRent}
        onChange={e => setTotalRent(e.target.value)}
        className={inputCls}
      />
      <input
        type="text"
        placeholder="Lease Status"
        value={leaseStatus}
        onChange={e => setLeaseStatus(e.target.value)}
        className={inputCls}
      />
      <div>
        <label className="text-xs text-gray-500 mb-1 block">Lease URL (Google Drive link)</label>
        <input
          type="text"
          placeholder="https://drive.google.com/…"
          value={leaseUrl}
          onChange={e => setLeaseUrl(e.target.value)}
          className={inputCls}
        />
      </div>
      <input
        type="text"
        placeholder="Smart Lock Combo"
        value={smartLock}
        onChange={e => setSmartLock(e.target.value)}
        className={inputCls}
      />

      {error && <p className="text-xs text-red-600">{error}</p>}

      <div className="flex gap-2">
        <button
          onClick={onCancel}
          className="flex-1 py-2 rounded-lg text-sm text-gray-500 border border-gray-200 bg-white hover:bg-gray-50 transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex-1 py-2 rounded-lg text-sm font-medium bg-blue-600 text-white disabled:opacity-40 hover:bg-blue-700 transition-colors"
        >
          {saving ? 'Saving…' : 'Save Changes'}
        </button>
      </div>
    </div>
  )
}

// ─── RenterModal ──────────────────────────────────────────────────────────────

export default function RenterModal({ week, appointments, commentOverride, caretakerNote, isAdmin, onClose, onRefresh, onFullRefresh }) {
  const { weekStart, renterInfo, totalRent, leaseStatus, leaseUrl, comment, source, rentalId } = week
  const { name, email, dates } = renterInfo

  const effectiveComment = commentOverride?.comment ?? comment
  const [commentText, setCommentText] = useState(effectiveComment || '')
  const [savingComment, setSavingComment] = useState(false)
  const [commentSaved, setCommentSaved] = useState(false)
  const [showAddPayment, setShowAddPayment] = useState(false)
  const [showEdit, setShowEdit] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const { milestones, totalPaid, totalDueNow, totalCredit, hasMismatch, badge } = computePayment(week)
  const balanceRemaining = Math.max(0, totalRent - totalPaid)
  const weekAppts = appointments.filter(a => a.week_start === toISODate(weekStart))

  const nextUnpaidIdx = milestones.findIndex(m => m.amountOwed > 0 && !(m.actual?.amount > 0))
  const hasUnpaid = nextUnpaidIdx >= 0

  const renterKey = buildRenterKey(week)

  const fmtDate = (d) => d
    ? (d instanceof Date
        ? d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
        : d)
    : '—'

  const saveComment = async () => {
    setSavingComment(true)
    await supabase.from('comment_overrides').upsert(
      { week_start: toISODate(weekStart), comment: commentText, updated_at: new Date().toISOString() },
      { onConflict: 'week_start' }
    )
    setSavingComment(false)
    setCommentSaved(true)
    setTimeout(() => setCommentSaved(false), 2000)
    onRefresh()
  }

  const handleDelete = async () => {
    setDeleting(true)
    await supabase.from('rentals').delete().eq('id', rentalId)
    setDeleting(false)
    onFullRefresh()
  }

  return (
    <div className="p-5 space-y-5 pb-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">{name}</h2>
          <a href={`mailto:${email}`} className="text-sm text-blue-600 hover:underline">{email}</a>
          {dates && (
            <p className="text-sm text-gray-500 mt-0.5">
              {fmtDate(dates.start)} – {fmtDate(dates.end)}
            </p>
          )}
        </div>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none p-1">×</button>
      </div>

      {isAdmin && leaseStatus && (
        leaseUrl ? (
          <a
            href={leaseUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600 hover:bg-gray-200 underline underline-offset-2"
          >
            📄 Lease: {leaseStatus} ↗
          </a>
        ) : (
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
            📋 Lease: {leaseStatus}
          </div>
        )
      )}

      {isAdmin && (
        <>
          {/* Mismatch warning */}
          {hasMismatch && (
            <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800">
              <span className="text-base flex-shrink-0">⚠️</span>
              <span>Total rent mismatch — please check the spreadsheet.</span>
            </div>
          )}

          {/* Milestone table */}
          <div className="bg-gray-50 rounded-xl p-4 space-y-4">
            <h3 className="text-sm font-semibold text-gray-700">Payment Milestones</h3>

            <div className="overflow-x-auto -mx-1">
              <table className="w-full text-xs min-w-[440px]">
                <thead>
                  <tr className="text-gray-400 text-left border-b border-gray-200">
                    <th className="pb-2 pr-3 font-medium">Milestone</th>
                    <th className="pb-2 pr-3 font-medium">Due</th>
                    <th className="pb-2 pr-3 font-medium text-right">Owed</th>
                    <th className="pb-2 pr-3 font-medium text-right">Paid</th>
                    <th className="pb-2 pr-2 font-medium">Method</th>
                    <th className="pb-2 font-medium text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {milestones.map((m, i) => {
                    const paid = m.actual?.amount || 0
                    return (
                      <tr key={i} className="text-gray-700">
                        <td className="py-2.5 pr-3 font-medium text-gray-800">{m.label}</td>
                        <td className="py-2.5 pr-3 text-gray-500 whitespace-nowrap">{m.dueDateLabel}</td>
                        <td className="py-2.5 pr-3 text-right font-mono">{fmt(m.amountOwed)}</td>
                        <td className={`py-2.5 pr-3 text-right font-mono font-semibold ${paid > 0 ? 'text-green-700' : 'text-gray-400'}`}>
                          {paid > 0 ? fmt(paid) : '—'}
                        </td>
                        <td className="py-2.5 pr-2 text-gray-500">{m.actual?.method || '—'}</td>
                        <td className="py-2.5 text-center text-base">{milestoneStatus(m)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Summary row */}
            <div className="border-t border-gray-200 pt-3 grid grid-cols-2 gap-y-1.5 text-sm">
              <span className="text-gray-400">Total Rent</span>
              <span className="text-right font-semibold text-gray-900">{fmt(totalRent)}</span>

              <span className="text-gray-400">Total Paid</span>
              <span className="text-right font-semibold text-green-700">{fmt(totalPaid)}</span>

              <span className="text-gray-400">Balance Remaining</span>
              <span className={`text-right font-semibold ${balanceRemaining > 0 ? 'text-red-600' : 'text-gray-900'}`}>
                {fmt(balanceRemaining)}
              </span>
            </div>

            {/* Credit note */}
            {totalCredit > 0 && (
              <p className="text-xs text-blue-600 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2">
                💡 Credit of {fmt(totalCredit)} applied from overpayment
              </p>
            )}

            {/* Overall badge + Add Payment */}
            <div className="flex items-center justify-between pt-1">
              <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-semibold ${badgeClass[badge.color]}`}>
                {badge.emoji} {badge.label}
              </span>
              {hasUnpaid && (
                <button
                  onClick={() => setShowAddPayment(true)}
                  className="text-sm font-semibold text-blue-600 border border-blue-200 rounded-full px-3 py-1 hover:bg-blue-50 transition-colors"
                >
                  + Add Payment
                </button>
              )}
            </div>
          </div>

          {/* Owner Comments (admin only) */}
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-gray-700">Owner Notes</h3>
            <textarea
              value={commentText}
              onChange={e => { setCommentText(e.target.value); setCommentSaved(false) }}
              rows={3}
              placeholder="Add notes…"
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-400 resize-none"
            />
            <button
              onClick={saveComment}
              disabled={savingComment}
              className="text-sm font-medium text-blue-600 hover:underline disabled:opacity-40"
            >
              {commentSaved ? '✓ Saved' : savingComment ? 'Saving…' : 'Save Comment'}
            </button>
          </div>

          {/* Edit / Delete */}
          <div className="space-y-2 pt-1">
            {!showEdit && !confirmDelete && (
              <>
                <button
                  onClick={() => setShowEdit(true)}
                  className="w-full py-2.5 rounded-xl text-sm font-medium border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  ✏️ Edit Rental
                </button>
                <button
                  onClick={() => setConfirmDelete(true)}
                  className="w-full py-2.5 rounded-xl text-sm font-medium border border-red-200 bg-red-50 text-red-600 hover:bg-red-100 transition-colors"
                >
                  🗑 Delete Rental
                </button>
              </>
            )}

            {showEdit && (
              <EditRentalForm
                week={week}
                onSaved={onFullRefresh}
                onCancel={() => setShowEdit(false)}
              />
            )}

            {confirmDelete && (
              <div className="border border-red-200 rounded-xl p-4 bg-red-50 space-y-3">
                <p className="text-sm font-medium text-red-800">
                  Remove {name} from this week? This cannot be undone.
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setConfirmDelete(false)}
                    className="flex-1 py-2 rounded-lg text-sm text-gray-500 border border-gray-200 bg-white hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleDelete}
                    disabled={deleting}
                    className="flex-1 py-2 rounded-lg text-sm font-medium bg-red-600 text-white disabled:opacity-40 hover:bg-red-700 transition-colors"
                  >
                    {deleting ? 'Deleting…' : 'Delete'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* Caretaker Notes (visible in both modes) */}
      <CaretakerNotes weekStart={weekStart} caretakerNote={caretakerNote} isAdmin={isAdmin} onRefresh={onRefresh} />

      <AppointmentList appointments={weekAppts} weekStart={weekStart} onRefresh={onRefresh} isAdmin={isAdmin} />

      {isAdmin && showAddPayment && (
        <AddPaymentDrawer
          renterKey={renterKey}
          milestone={milestones[nextUnpaidIdx]}
          milestoneNumber={nextUnpaidIdx + 1}
          onSave={() => { setShowAddPayment(false); onRefresh() }}
          onClose={() => setShowAddPayment(false)}
        />
      )}
    </div>
  )
}
