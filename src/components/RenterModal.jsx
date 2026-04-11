import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { toISODate } from '../lib/parseCSV'
import { calculateMilestones, amountDueByNow, parseAmountPaid, getPaymentBadge } from '../lib/paymentLogic'
import AppointmentList from './AppointmentList'

function fmt(n) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n)
}

export default function RenterModal({ week, appointments, commentOverride, onClose, onRefresh }) {
  const { weekStart, renterInfo, totalRent, deposit, leaseStatus, balanceDue, paymentStatus, comment } = week
  const { name, email, dates } = renterInfo

  const effectiveComment = commentOverride?.comment ?? comment
  const [commentText, setCommentText] = useState(effectiveComment || '')
  const [savingComment, setSavingComment] = useState(false)
  const [commentSaved, setCommentSaved] = useState(false)

  const today = new Date()
  const leaseStart = dates?.start || null
  const amountPaid = parseAmountPaid(paymentStatus, totalRent)
  const dueNow = amountDueByNow(totalRent, deposit, leaseStart, today)
  const badge = getPaymentBadge(amountPaid, dueNow, totalRent)
  const milestones = calculateMilestones(totalRent, deposit, leaseStart)

  const saveComment = async () => {
    setSavingComment(true)
    const weekKey = toISODate(weekStart)
    await supabase.from('comment_overrides').upsert(
      { week_start: weekKey, comment: commentText, updated_at: new Date().toISOString() },
      { onConflict: 'week_start' }
    )
    setSavingComment(false)
    setCommentSaved(true)
    setTimeout(() => setCommentSaved(false), 2000)
    onRefresh()
  }

  const weekAppts = appointments.filter(a => a.week_start === toISODate(weekStart))

  const formatDate = (d) => d ? d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—'

  return (
    <div className="p-5 space-y-5 pb-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">{name}</h2>
          <a href={`mailto:${email}`} className="text-sm text-blue-600 hover:underline">{email}</a>
          {dates && (
            <p className="text-sm text-gray-500 mt-0.5">
              {formatDate(dates.start)} – {formatDate(dates.end)}
            </p>
          )}
        </div>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none p-1">×</button>
      </div>

      {/* Lease status */}
      {leaseStatus && (
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
          <span>📋</span> Lease: {leaseStatus}
        </div>
      )}

      {/* Financial Summary */}
      <div className="bg-gray-50 rounded-xl p-4 space-y-3">
        <h3 className="text-sm font-semibold text-gray-700">Financial Summary</h3>

        <div className="grid grid-cols-2 gap-2 text-sm">
          <div><span className="text-gray-400">Total Rent</span><p className="font-semibold text-gray-900">{fmt(totalRent)}</p></div>
          <div><span className="text-gray-400">Deposit</span><p className="font-semibold text-gray-900">{fmt(deposit)}</p></div>
          <div><span className="text-gray-400">Amount Paid</span><p className="font-semibold text-gray-900">{fmt(amountPaid)}</p></div>
          <div><span className="text-gray-400">Due Now</span><p className={`font-semibold ${dueNow > amountPaid ? 'text-red-600' : 'text-gray-900'}`}>{fmt(dueNow)}</p></div>
          <div><span className="text-gray-400">Balance Remaining</span><p className="font-semibold text-gray-900">{fmt(balanceDue)}</p></div>
        </div>

        {/* Payment milestones */}
        <div className="border-t border-gray-200 pt-3 space-y-1.5">
          <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">Milestones</p>
          {milestones.map((m, i) => (
            <div key={i} className="flex justify-between text-xs">
              <span className="text-gray-600">{m.label}{m.due ? ` — due ${m.due.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}` : ' — on signing'}</span>
              <span className="font-medium text-gray-800">{fmt(m.amount)}</span>
            </div>
          ))}
        </div>

        {/* Badge */}
        <div className="border-t border-gray-200 pt-3">
          <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-semibold ${
            badge.color === 'green' ? 'bg-green-100 text-green-700' :
            badge.color === 'yellow' ? 'bg-yellow-100 text-yellow-700' :
            badge.color === 'red' ? 'bg-red-100 text-red-700' :
            'bg-gray-100 text-gray-600'
          }`}>
            {badge.emoji} {badge.label}
          </div>
          {paymentStatus && (
            <p className="text-xs text-gray-400 mt-1.5 italic">"{paymentStatus}"</p>
          )}
        </div>
      </div>

      {/* Comments */}
      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-gray-700">Comments</h3>
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

      {/* Appointments */}
      <AppointmentList appointments={weekAppts} weekStart={weekStart} onRefresh={onRefresh} />
    </div>
  )
}
