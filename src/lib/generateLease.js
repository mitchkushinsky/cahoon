// Pure, environment-agnostic math and merge-text for lease generation — no
// Google API calls here. Those live in api/generate-lease.js (needs the
// service account secret, which must never reach the browser bundle); this
// file is imported by that endpoint for the numbers and replacement text,
// and is safe to import from the frontend too since it has no side effects.

// Same formula as FinancialsScreen.jsx's taxForEntry — MA short-term rental
// occupancy tax: taxable rent = total rent / 1.1445.
const TAX_DIVISOR = 1.1445

export function calculateOccupancyTax(totalRent) {
  const rent = Number(totalRent) || 0
  const taxable = rent / TAX_DIVISOR
  return Math.round((rent - taxable) * 100) / 100
}

// Deposit is fixed; the remaining balance splits into two equal
// installments. For every real rent this project actually uses (whole
// dollars — confirmed against live data), the remainder splits evenly and
// both installments come out identical, matching "thirty_days_prior_payment
// = installment" exactly as given. thirtyDaysPriorPayment is computed as
// the leftover (totalRent - deposit - january15Payment) rather than reusing
// january15Payment's rounded value a second time, though — caught in
// testing with a deliberately odd-cent rent ($999.99): reusing one rounded
// half twice can land a cent off the true total when the remainder doesn't
// split evenly (249.995 rounds one way, doubling it doesn't recover the
// original 499.99). Taking the remainder instead guarantees deposit + both
// payments always sums to exactly totalRent, the same remainder-absorption
// pattern RenterModal.jsx's calcMilestones already uses for the unrelated
// regular-rental payment schedule.
export function calculatePaymentSchedule(totalRent) {
  const rent = Number(totalRent) || 0
  const deposit = 500
  const january15Payment = Math.round(((rent - deposit) / 2) * 100) / 100
  const thirtyDaysPriorPayment = Math.round((rent - deposit - january15Payment) * 100) / 100
  return {
    deposit,
    installment: january15Payment,
    january15Payment,
    thirtyDaysPriorPayment,
  }
}

export function fmtDollars(n) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2,
  }).format(n ?? 0)
}

function parseLocalISODate(isoStr) {
  if (!isoStr) return null
  const [y, m, d] = isoStr.split('-').map(Number)
  return new Date(y, m - 1, d)
}

// "October 15, 2026"
export function formatDateCreated(date = new Date()) {
  return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}

// "Sunday, July 6, 2027"
export function formatDateWithWeekday(isoStr) {
  const date = parseLocalISODate(isoStr)
  if (!date) return ''
  return date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
}

export function rentalYear(isoStr) {
  const date = parseLocalISODate(isoStr)
  return date ? String(date.getFullYear()) : ''
}

// Builds everything api/generate-lease.js needs for one renter: the full
// replaceAllText merge map (<token> -> replacement text) plus a few derived
// values the caller needs outside the document body (the rental year, for
// the lease's own filename).
//
// <Total Rent> and <Total Rent due> are two distinct template tokens that
// happen to carry the same dollar figure — the brief notes <Total Rent>
// "appears twice" in the document; replaceAllText already replaces every
// occurrence of a given token on its own, so each token is listed once here
// regardless of how many places it actually appears.
export function buildLeaseData({ name, email, start_date, end_date, proposed_rent }) {
  const totalRent = Number(proposed_rent) || 0
  const schedule = calculatePaymentSchedule(totalRent)
  const occupancyTax = calculateOccupancyTax(totalRent)
  const totalRentFmt = fmtDollars(totalRent)
  const year = rentalYear(start_date)

  const mergeFields = {
    '<Date Created>': formatDateCreated(),
    '<Renters full name>': name || '',
    '<Renters email address>': email || '',
    '<start date>': formatDateWithWeekday(start_date),
    '<end date>': formatDateWithWeekday(end_date),
    '<Total Rent due>': totalRentFmt,
    '<Total Rent>': totalRentFmt,
    '<January 15th Payment>': fmtDollars(schedule.january15Payment),
    '<Rental Year>': year,
    '<30 Days Prior Payment>': fmtDollars(schedule.thirtyDaysPriorPayment),
    '<Occupancy Tax Owed>': fmtDollars(occupancyTax),
  }

  return { mergeFields, year, totalRent, occupancyTax, schedule }
}
