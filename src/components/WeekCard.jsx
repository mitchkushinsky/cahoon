import { toISODate } from '../lib/parseCSV'
import { parseAmountPaid, amountDueByNow, getPaymentBadge } from '../lib/paymentLogic'

function formatWeekRange(weekStart) {
  const end = new Date(weekStart)
  end.setDate(end.getDate() + 6)
  const fmt = d => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  return `${fmt(weekStart)} – ${fmt(end)}`
}

export default function WeekCard({ week, ownerUseRow, appointments, commentOverride, onClick }) {
  const { weekStart, renterInfo, isOwnerSheet, comment, totalRent, deposit, paymentStatus } = week
  const weekKey = toISODate(weekStart)
  const isOwner = isOwnerSheet || !!ownerUseRow

  const weekAppts = appointments.filter(a => a.week_start === weekKey)
  const hasCleaning = weekAppts.some(a => a.type === 'cleaning')
  const hasRepair = weekAppts.some(a => a.type === 'repair')
  const effectiveComment = commentOverride?.comment ?? comment
  const hasComment = !!effectiveComment

  let status = 'vacant'
  if (isOwner) status = 'owner'
  else if (renterInfo) status = 'renter'

  const today = new Date()
  let badge = null
  if (status === 'renter' && totalRent > 0) {
    const amountPaid = parseAmountPaid(paymentStatus, totalRent)
    const dueNow = amountDueByNow(totalRent, deposit, renterInfo?.dates?.start, today)
    badge = getPaymentBadge(amountPaid, dueNow, totalRent)
  }

  const statusConfig = {
    owner: { label: '🏠 Owner Use', chipClass: 'bg-blue-100 text-blue-700' },
    vacant: { label: 'VACANT', chipClass: 'bg-gray-100 text-gray-500' },
    renter: { label: renterInfo?.name, chipClass: 'bg-green-100 text-green-700' },
  }

  const config = statusConfig[status]

  return (
    <button
      onClick={onClick}
      className="w-full text-left bg-white rounded-xl border border-gray-100 shadow-sm px-4 py-3.5 hover:shadow-md hover:border-gray-200 transition-all active:scale-[0.99]"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-xs text-gray-400 font-medium mb-1">{formatWeekRange(weekStart)}</p>
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-sm font-semibold ${config.chipClass}`}>
            {config.label}
          </span>
        </div>

        <div className="flex items-center gap-1.5 flex-shrink-0 mt-0.5">
          {badge && (
            <span className="text-base" title={badge.label}>{badge.emoji}</span>
          )}
          {hasCleaning && <span title="Cleaning">🧹</span>}
          {hasRepair && <span title="Repair">🔧</span>}
          {hasComment && <span title="Has comment" className="text-gray-400 text-sm">💬</span>}
        </div>
      </div>
    </button>
  )
}
