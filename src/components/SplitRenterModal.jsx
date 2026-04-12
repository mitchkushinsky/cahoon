import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { toISODate } from '../lib/parseCSV'
import { computePayment, milestoneStatus } from '../lib/paymentLogic'
import { buildRenterKey } from '../lib/resolvePayments'
import AppointmentList from './AppointmentList'
import AddPaymentDrawer from './AddPaymentDrawer'

function fmt(n) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n ?? 0)
}

const badgeClass = {
  green:  'bg-green-100 text-green-700',
  yellow: 'bg-yellow-100 text-yellow-700',
  red:    'bg-red-100 text-red-700',
  gray:   'bg-gray-100 text-gray-500',
}

function RenterSection({ renter, index, onRefresh }) {
  const { renterInfo, totalRent, leaseStatus, leaseUrl } = renter
  const { name, email, dates } = renterInfo
  const { milestones, totalPaid, totalCredit, hasMismatch, badge } = computePayment(renter)
  const balanceRemaining = Math.max(0, totalRent - totalPaid)

  const nextUnpaidIdx = milestones.findIndex(m => m.amountOwed > 0 && !(m.actual?.amount > 0))
  const hasUnpaid = nextUnpaidIdx >= 0
  const [showAddPayment, setShowAddPayment] = useState(false)

  const renterKey = buildRenterKey(renter)

  const fmtDate = d =>
    d instanceof Date
      ? d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      : (d || '—')

  return (
    <div className="space-y-3">
      {/* Renter header */}
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-0.5">
            Renter {index + 1}
          </p>
          <h3 className="text-lg font-bold text-gray-900 leading-tight">{name}</h3>
          <a href={`mailto:${email}`} className="text-sm text-blue-600 hover:underline">{email}</a>
          {dates && (
            <p className="text-sm text-gray-500 mt-0.5">
              {fmtDate(dates.start)} – {fmtDate(dates.end)}
            </p>
          )}
        </div>
        {leaseStatus && (
          leaseUrl ? (
            <a
              href={leaseUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600 hover:bg-gray-200 underline underline-offset-2 flex-shrink-0 ml-2 mt-1"
            >
              📄 {leaseStatus} ↗
            </a>
          ) : (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600 flex-shrink-0 ml-2 mt-1">
              📋 {leaseStatus}
            </span>
          )
        )}
      </div>

      {/* Mismatch warning */}
      {hasMismatch && (
        <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5 text-xs text-amber-800">
          <span className="flex-shrink-0">⚠️</span>
          <span>Total rent mismatch — please check the spreadsheet.</span>
        </div>
      )}

      {/* Milestone table */}
      <div className="bg-gray-50 rounded-xl p-3 space-y-3">
        <div className="overflow-x-auto -mx-1">
          <table className="w-full text-xs min-w-[400px]">
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
                    <td className="py-2 pr-3 font-medium text-gray-800">{m.label}</td>
                    <td className="py-2 pr-3 text-gray-500 whitespace-nowrap">{m.dueDateLabel}</td>
                    <td className="py-2 pr-3 text-right font-mono">{fmt(m.amountOwed)}</td>
                    <td className={`py-2 pr-3 text-right font-mono font-semibold ${paid > 0 ? 'text-green-700' : 'text-gray-400'}`}>
                      {paid > 0 ? fmt(paid) : '—'}
                    </td>
                    <td className="py-2 pr-2 text-gray-500">{m.actual?.method || '—'}</td>
                    <td className="py-2 text-center text-sm">{milestoneStatus(m)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Summary */}
        <div className="border-t border-gray-200 pt-2.5 grid grid-cols-2 gap-y-1 text-xs">
          <span className="text-gray-400">Total Rent</span>
          <span className="text-right font-semibold text-gray-900">{fmt(totalRent)}</span>
          <span className="text-gray-400">Total Paid</span>
          <span className="text-right font-semibold text-green-700">{fmt(totalPaid)}</span>
          <span className="text-gray-400">Balance Remaining</span>
          <span className={`text-right font-semibold ${balanceRemaining > 0 ? 'text-red-600' : 'text-gray-900'}`}>
            {fmt(balanceRemaining)}
          </span>
        </div>

        {totalCredit > 0 && (
          <p className="text-xs text-blue-600 bg-blue-50 border border-blue-100 rounded-lg px-3 py-1.5">
            💡 Credit of {fmt(totalCredit)} applied from overpayment
          </p>
        )}

        {/* Badge + Add Payment */}
        <div className="flex items-center justify-between">
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

      {showAddPayment && (
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

export default function SplitRenterModal({ week, appointments, commentOverride, onClose, onRefresh }) {
  const { weekStart, renters, comment } = week

  const effectiveComment = commentOverride?.comment ?? comment
  const [commentText, setCommentText] = useState(effectiveComment || '')
  const [savingComment, setSavingComment] = useState(false)
  const [commentSaved, setCommentSaved] = useState(false)

  const weekAppts = appointments.filter(a => a.week_start === toISODate(weekStart))

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

  return (
    <div className="p-5 space-y-5 pb-8">
      {/* Modal header */}
      <div className="flex items-center justify-between">
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-purple-100 text-purple-700">
          Split Week · {renters.length} Renters
        </span>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none p-1">×</button>
      </div>

      {/* Renter sections */}
      {renters.map((renter, i) => (
        <div key={i}>
          {i > 0 && <div className="border-t-2 border-dashed border-gray-200 pt-5" />}
          <RenterSection renter={renter} index={i} onRefresh={onRefresh} />
        </div>
      ))}

      {/* Shared comments */}
      <div className="border-t border-gray-100 pt-5 space-y-2">
        <h3 className="text-sm font-semibold text-gray-700">Comments (shared)</h3>
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

      {/* Shared appointments */}
      <div className="border-t border-gray-100 pt-5">
        <AppointmentList appointments={weekAppts} weekStart={weekStart} onRefresh={onRefresh} />
      </div>
    </div>
  )
}
