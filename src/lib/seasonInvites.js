import { mergeTemplate, renderHtml, renderPlain } from './reminders'

// Shared between the list row badge and the detail modal's status selector
// so the two never drift out of sync on label/color.
export const STATUS_META = {
  not_sent:  { label: 'Not Sent',  badgeClass: 'bg-gray-100 text-gray-500' },
  sent:      { label: 'Sent',      badgeClass: 'bg-yellow-100 text-yellow-700' },
  confirmed: { label: 'Confirmed', badgeClass: 'bg-green-100 text-green-700' },
  declined:  { label: 'Declined', badgeClass: 'bg-red-100 text-red-700' },
}
export const STATUS_OPTIONS = ['not_sent', 'sent', 'confirmed', 'declined']

// ─── Date helpers ────────────────────────────────────────────────────────────

// Supabase returns `date` columns as "YYYY-MM-DD" strings. new Date(isoStr)
// parses that as UTC and can shift a day depending on the viewer's timezone —
// same pitfall parseCSV.js and supabaseRentals.js already guard against.
// Always parse/format these as local dates.
function parseLocalISODate(isoStr) {
  if (!isoStr) return null
  const [y, m, d] = isoStr.split('-').map(Number)
  return new Date(y, m - 1, d)
}

function toISODate(date) {
  if (!date) return null
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

// 364 days = exactly 52 weeks, so a given day of week lands on the same day
// of week one year later — the Date constructor's day-overflow handling
// rolls months/years correctly on its own.
function addDays(date, days) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days)
}

// A renter whose most recent eligible rental is two eligible-years back
// (e.g. 2025, when the target is 2027 and they skipped 2026) lands one
// 364-day cycle short of the target season on the first pass — eligibility
// only looks back to current-year-minus-1, so a single correction here is
// always enough to reach the target year, never more than one.
export function nextSeasonDates(startIso, endIso) {
  const start = parseLocalISODate(startIso)
  const end = parseLocalISODate(endIso)
  if (!start || !end) return { proposedStart: null, proposedEnd: null }
  let proposedStart = addDays(start, 364)
  let proposedEnd = addDays(end, 364)
  const targetYearStart = new Date(new Date().getFullYear() + 1, 0, 1)
  if (proposedStart < targetYearStart) {
    proposedStart = addDays(proposedStart, 364)
    proposedEnd = addDays(proposedEnd, 364)
  }
  return {
    proposedStart: toISODate(proposedStart),
    proposedEnd: toISODate(proposedEnd),
  }
}

export function fmtDateRange(startIso, endIso) {
  const start = parseLocalISODate(startIso)
  const end = parseLocalISODate(endIso)
  if (!start || !end) return '—'
  const startLabel = start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  const endLabel = end.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  return `${startLabel}–${endLabel}, ${end.getFullYear()}`
}

// "July 6, 2027" — the email body's own date format, distinct from the list
// row's abbreviated range above.
export function fmtLongDate(isoStr) {
  const date = parseLocalISODate(isoStr)
  if (!date) return ''
  return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}

export function fmtMoney(n) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n ?? 0)
}

function firstName(fullName) {
  return (fullName || '').split(/\s+/)[0]
}

// ─── Eligibility ─────────────────────────────────────────────────────────────

// "2025 or 2026" in the brief is this year and last year, relative to when
// this screen is opened — kept dynamic (not hardcoded) so it doesn't need a
// code change every season, same reasoning the brief itself uses for the
// "[current year + 1] Invites" tab label.
export function eligibleRentalYears() {
  const currentYear = new Date().getFullYear()
  return [currentYear - 1, currentYear]
}

// One rental per eligible renter — their most recent among the eligible
// years (e.g. 2026 over 2025 if they rented both) — joined with renter info.
// Archived renters are excluded: an archived renter is someone Mitch has
// already marked as no longer an active relationship, so auto-inviting them
// to next season would contradict that.
export function getEligibleRenters(rentals, renters) {
  const years = eligibleRentalYears()
  const renterMap = Object.fromEntries((renters || []).map(r => [r.id, r]))

  const byRenter = {}
  for (const rental of (rentals || [])) {
    if (!years.includes(rental.season_year)) continue
    const renter = renterMap[rental.renter_id]
    if (!renter || renter.archived_at) continue
    const existing = byRenter[rental.renter_id]
    if (!existing || rental.season_year > existing.season_year) {
      byRenter[rental.renter_id] = rental
    }
  }

  return Object.entries(byRenter).map(([renterId, sourceRental]) => ({
    renter: renterMap[renterId],
    sourceRental,
  }))
}

export function calculateProposal(sourceRental) {
  const { proposedStart, proposedEnd } = nextSeasonDates(sourceRental.start_date, sourceRental.end_date)
  return {
    proposed_start: proposedStart,
    proposed_end: proposedEnd,
    proposed_rent: sourceRental.total_rent ?? null,
  }
}

// ─── Email template ──────────────────────────────────────────────────────────

export const SEASON_INVITE_SUBJECT_TEMPLATE = '1105 Cahoon Hollow Road — <NextYear> Rental Interest'

export const SEASON_INVITE_EMAIL_TEMPLATE = `Hi <FirstName>,

As summer turns to fall, it's time to think about <NextYear> in Wellfleet. Leases for next year will be sent out in November.

Once again, we are leaving the rent unchanged for next year.

Let me know if you're interested in the week of <StartDate> to <EndDate> and I'll create a lease for you.

If you want a different date, we can work together to make that happen. Also, if you are not interested, please let me know.

Thanks and enjoy the season.

Mitch`

export function buildInviteMergeFields(invite, renter) {
  const nextYear = new Date().getFullYear() + 1
  return {
    FirstName: firstName(renter?.name),
    NextYear: String(nextYear),
    StartDate: fmtLongDate(invite.proposed_start),
    EndDate: fmtLongDate(invite.proposed_end),
  }
}

export function buildInviteEmailPreview(invite, renter) {
  const mergeFields = buildInviteMergeFields(invite, renter)
  const subject = mergeTemplate(SEASON_INVITE_SUBJECT_TEMPLATE, mergeFields)
  const merged = mergeTemplate(SEASON_INVITE_EMAIL_TEMPLATE, mergeFields)
  return {
    email: renter?.email || '',
    subject,
    html: renderHtml(merged),
    plain: renderPlain(merged),
  }
}
