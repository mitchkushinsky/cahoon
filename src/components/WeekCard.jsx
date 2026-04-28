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

// Compute proportional position/width for a rental within a 7-day week slot.
// All inputs are Date objects. Returns { leftPct, widthPct }.
function ganttMetrics(weekStart, startDate, endDate) {
  const WEEK_MS = 7 * 24 * 60 * 60 * 1000
  const weekEnd = new Date(weekStart.getTime() + WEEK_MS)

  const clampedStart = new Date(Math.max(startDate.getTime(), weekStart.getTime()))
  const clampedEnd   = new Date(Math.min(endDate.getTime(),   weekEnd.getTime()))

  const leftPct  = (clampedStart.getTime() - weekStart.getTime()) / WEEK_MS * 100
  const widthPct = (clampedEnd.getTime()   - clampedStart.getTime()) / WEEK_MS * 100

  return { leftPct, widthPct }
}

// A single proportional pill. Hides name text when pill is very narrow.
function GanttPill({ name, dates, badge, weekStart, colorClass }) {
  const { leftPct, widthPct } = ganttMetrics(weekStart, dates.start, dates.end)

  const isNarrow   = widthPct < 30
  const isVeryNarrow = widthPct < 20

  return (
    <div className="relative w-full h-7">
      <span
        className={`absolute inset-y-0 flex items-center rounded-full text-xs font-semibold overflow-hidden ${colorClass}`}
        style={{ left: `${leftPct}%`, width: `${widthPct}%`, minWidth: '1.25rem' }}
        title={`${name}${dates ? ` · ${inlineDates(dates)}` : ''}`}
      >
        {isVeryNarrow ? (
          <span className="mx-auto flex-shrink-0 leading-none">{badge?.emoji}</span>
        ) : (
          <span className="flex items-center gap-1 px-2 min-w-0">
            {!isNarrow && <span className="truncate">{name}</span>}
            {!isNarrow && dates?.start && (
              <span className="opacity-70 whitespace-nowrap flex-shrink-0">
                · {inlineDates(dates)}
              </span>
            )}
            {isNarrow && <span className="truncate">{name}</span>}
            <span className="flex-shrink-0 ml-auto pl-0.5">{badge?.emoji}</span>
          </span>
        )}
      </span>
    </div>
  )
}

function RenterChip({ renter, weekStart }) {
  const { badge } = computePayment(renter)
  const dates = renter.renterInfo?.dates
  if (!dates?.start || !dates?.end) {
    // Fallback: full-width pill if no dates
    return (
      <div className="relative w-full h-7">
        <span className="absolute inset-0 flex items-center gap-1 px-2.5 rounded-full text-xs font-semibold bg-green-100 text-green-700">
          <span className="truncate">{renter.renterInfo.name}</span>
          <span className="flex-shrink-0 ml-auto">{badge.emoji}</span>
        </span>
      </div>
    )
  }
  return (
    <GanttPill
      name={renter.renterInfo.name}
      dates={dates}
      badge={badge}
      weekStart={weekStart}
      colorClass="bg-green-100 text-green-700"
    />
  )
}

export default function WeekCard({ week, ownerUseRow, appointments, commentOverride, caretakerNote, isAdmin, onClick }) {
  const { weekStart, type, isOwnerSheet, comment, renterInfo, totalRent, renters, startDate, endDate } = week
  const weekKey     = toISODate(weekStart)
  const isOwner     = isOwnerSheet || !!ownerUseRow
  const resolvedType = isOwner ? 'owner' : type

  const weekAppts         = appointments.filter(a => a.week_start === weekKey)
  const hasComment        = !!(commentOverride?.comment ?? comment)
  const hasCaretakerNote  = !!(caretakerNote?.note)

  const apptIcon = (type) => type === 'cleaning' ? '🧹' : type === 'exterminator' ? '🦟' : type === 'other' ? '📌' : '🔨'
  const fmtApptDate = (dateStr) => {
    const [y, m, d] = dateStr.split('-').map(Number)
    return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  const visibleAppts  = weekAppts.slice(0, 3)
  const extraApptCount = weekAppts.length - 2
  const showOverflow  = weekAppts.length > 3

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

          {resolvedType === 'renter' && renterInfo?.dates?.start && renterInfo?.dates?.end ? (
            <GanttPill
              name={renterInfo.name}
              dates={renterInfo.dates}
              badge={singleBadge}
              weekStart={weekStart}
              colorClass="bg-green-100 text-green-700"
            />
          ) : resolvedType === 'renter' && (
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-sm font-semibold bg-green-100 text-green-700">
                <span className="truncate max-w-[160px]">{renterInfo?.name}</span>
              </span>
              {singleBadge && (
                <span className="text-base flex-shrink-0" title={singleBadge.label}>{singleBadge.emoji}</span>
              )}
            </div>
          )}

          {resolvedType === 'split' && renters && (
            <div className="flex flex-col gap-1 mt-0.5">
              {renters.map((r, i) => <RenterChip key={i} renter={r} weekStart={weekStart} />)}
            </div>
          )}
        </div>

        <div className="flex items-center gap-1.5 flex-shrink-0 mt-0.5">
          {isAdmin && hasComment      && <span title="Owner comment" className="text-gray-400 text-sm">💬</span>}
          {hasCaretakerNote           && <span title={isAdmin ? "Caretaker note" : "Note"} className="text-gray-400 text-sm">📋</span>}
        </div>
      </div>

      {weekAppts.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1.5">
          {(showOverflow ? weekAppts.slice(0, 2) : visibleAppts).map((appt, i) => (
            <span key={i} className="text-xs text-gray-500">
              {apptIcon(appt.type)} {fmtApptDate(appt.date)}
            </span>
          ))}
          {showOverflow && (
            <span className="text-xs text-gray-400">+{extraApptCount} more</span>
          )}
        </div>
      )}
    </button>
  )
}
