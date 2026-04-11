import { toISODate } from '../lib/parseCSV'
import { computePayment } from '../lib/paymentLogic'

const fmtDate = d => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

// Always show the calendar week boundaries (Sun – Sat), never rental dates
function formatWeekRange(weekStart) {
  const end = new Date(weekStart)
  end.setDate(end.getDate() + 6)
  return `${fmtDate(weekStart)} – ${fmtDate(end)}`
}

// Compact "Jun 21–Jun 28" from a renterInfo.dates object
function inlineDates(dates) {
  if (!dates?.start) return ''
  return dates.end
    ? `${fmtDate(dates.start)}–${fmtDate(dates.end)}`
    : fmtDate(dates.start)
}

function RenterChip({ renter }) {
  const { badge } = computePayment(renter)
  const dates = renter.renterInfo?.dates
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-sm font-semibold bg-green-100 text-green-700 max-w-full">
      <span className="truncate">{renter.renterInfo.name}</span>
      {dates?.start && (
        <span className="text-xs font-normal opacity-70 whitespace-nowrap flex-shrink-0">
          · {inlineDates(dates)}
        </span>
      )}
      <span className="flex-shrink-0">{badge.emoji}</span>
    </span>
  )
}

export default function WeekCard({ week, ownerUseRow, appointments, commentOverride, onClick }) {
  const { weekStart, type, isOwnerSheet, comment, renterInfo, totalRent, renters } = week
  const weekKey     = toISODate(weekStart)
  const isOwner     = isOwnerSheet || !!ownerUseRow
  const resolvedType = isOwner ? 'owner' : type

  const weekAppts   = appointments.filter(a => a.week_start === weekKey)
  const hasCleaning = weekAppts.some(a => a.type === 'cleaning')
  const hasRepair   = weekAppts.some(a => a.type === 'repair')
  const hasComment  = !!(commentOverride?.comment ?? comment)

  let singleBadge = null
  if (resolvedType === 'renter' && totalRent > 0) {
    singleBadge = computePayment(week).badge
  }

  return (
    <button
      onClick={onClick}
      className="w-full text-left bg-white rounded-xl border border-gray-100 shadow-sm px-4 py-3.5 hover:shadow-md hover:border-gray-200 transition-all active:scale-[0.99]"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          {/* Calendar week anchor — always Sunday to Saturday */}
          <p className="text-xs text-gray-400 font-medium mb-1">{formatWeekRange(weekStart)}</p>

          {resolvedType === 'owner' && (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-sm font-semibold bg-blue-100 text-blue-700">
              🏠 Owner Use
            </span>
          )}

          {resolvedType === 'vacant' && (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-sm font-semibold bg-gray-100 text-gray-500">
              VACANT
            </span>
          )}

          {resolvedType === 'renter' && (
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-sm font-semibold bg-green-100 text-green-700">
                <span className="truncate max-w-[160px]">{renterInfo?.name}</span>
                {renterInfo?.dates?.start && (
                  <span className="text-xs font-normal opacity-70 whitespace-nowrap flex-shrink-0">
                    · {inlineDates(renterInfo.dates)}
                  </span>
                )}
              </span>
              {singleBadge && (
                <span className="text-base flex-shrink-0" title={singleBadge.label}>{singleBadge.emoji}</span>
              )}
            </div>
          )}

          {resolvedType === 'split' && renters && (
            <div className="flex flex-col gap-1.5 mt-0.5">
              {renters.map((r, i) => <RenterChip key={i} renter={r} />)}
            </div>
          )}
        </div>

        <div className="flex items-center gap-1.5 flex-shrink-0 mt-0.5">
          {hasCleaning && <span title="Cleaning">🧹</span>}
          {hasRepair   && <span title="Repair">🔧</span>}
          {hasComment  && <span title="Has comment" className="text-gray-400 text-sm">💬</span>}
        </div>
      </div>
    </button>
  )
}
