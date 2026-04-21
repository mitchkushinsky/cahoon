import { buildCalendar } from './parseCSV'

function toActual(amount, date, method) {
  if (!amount) return null
  return {
    amount: Number(amount),
    date: date ? new Date(date + 'T12:00:00') : null,
    method: method || null,
  }
}

function parseLocalDate(isoStr) {
  const [y, m, d] = isoStr.split('-').map(Number)
  return new Date(y, m - 1, d)
}

function rentalToEntry(rental, renter) {
  if (!rental.start_date || !rental.end_date) return null

  const startDate = parseLocalDate(rental.start_date)
  const endDate   = parseLocalDate(rental.end_date)
  const name      = renter?.name  || 'Unknown'
  const email     = renter?.email || ''

  return {
    rentalId: rental.id,
    source:   rental.source || null,
    name,
    email,
    startDate,
    endDate,
    comment: null,
    isOwnerUse: false,
    totalRent:      Number(rental.total_rent)   || 0,
    depositSummary: Number(rental.deposit_owed) || 0,
    leaseStatus:    rental.lease_status         || '',
    leaseUrl:       rental.lease_url            || null,
    smartLockCombo: rental.smart_lock_combo     || null,
    balanceDue:     Number(rental.balance_due)  || 0,

    depositOwed:    Number(rental.payment1_owed) || Number(rental.deposit_owed) || 0,
    depositActual:  toActual(rental.payment1_amount, rental.payment1_date, rental.payment1_method),

    payment2Owed:   Number(rental.payment2_owed) || 0,
    payment2Actual: toActual(rental.payment2_amount, rental.payment2_date, rental.payment2_method),

    finalOwed:      Number(rental.payment3_owed) || 0,
    finalActual:    toActual(rental.payment3_amount, rental.payment3_date, rental.payment3_method),

    renterInfo: {
      name,
      email,
      dates: { start: startDate, end: endDate },
      smartLockCombo: rental.smart_lock_combo || null,
    },
  }
}

/**
 * Convert Supabase rentals + renters rows into calendar weeks using the same
 * buildCalendar() logic as the CSV path.
 *
 * @param {Array} rentals      - Rows from the rentals table
 * @param {Array} renters      - Rows from the renters table
 * @param {Array} appointments - Rows from the appointments table (for week range)
 * @returns {Array}            - Same week-array shape as parseCSV()
 */
export function buildSupabaseCalendar(rentals, renters, appointments = []) {
  const renterMap = Object.fromEntries((renters || []).map(r => [r.id, r]))
  const entries = (rentals || [])
    .map(r => rentalToEntry(r, renterMap[r.renter_id]))
    .filter(Boolean)
  return buildCalendar(entries, appointments)
}
