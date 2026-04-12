import { toISODate } from './parseCSV'

// Build the unique key for a renter's rental period.
// Format: "email_YYYY-MM-DD" using the lease start date.
export function buildRenterKey(entry) {
  const email = (entry.email || '').toLowerCase().trim()
  const startDate = entry.startDate
  return `${email}_${toISODate(startDate)}`
}

// Convert a payment_records row into the { amount, date, method } shape
// that computePayment() expects.
function recordToActual(record) {
  if (!record) return null
  return {
    amount: Number(record.amount),
    // Supabase date is YYYY-MM-DD; parse as local noon to avoid UTC shift
    date: record.date ? new Date(record.date + 'T12:00:00') : null,
    method: record.method,
  }
}

function resolveEntryPayments(entry, paymentRecords) {
  const key = buildRenterKey(entry)
  const records = paymentRecords.filter(r => r.renter_key === key)
  // If no Supabase records exist for this renter, use CSV data as-is
  if (records.length === 0) return entry

  const p1 = records.find(r => r.payment_number === 1) ?? null
  const p2 = records.find(r => r.payment_number === 2) ?? null
  const p3 = records.find(r => r.payment_number === 3) ?? null

  return {
    ...entry,
    depositActual:  recordToActual(p1),
    payment2Actual: recordToActual(p2),
    finalActual:    recordToActual(p3),
  }
}

// Return a new weeks array with payment actuals overridden from Supabase
// where records exist, falling back to CSV data otherwise.
export function resolveWeeksPayments(weeks, paymentRecords) {
  if (!paymentRecords || paymentRecords.length === 0) return weeks
  return weeks.map(week => {
    if (week.type === 'vacant' || week.type === 'owner') return week
    if (week.type === 'split') {
      return { ...week, renters: week.renters.map(r => resolveEntryPayments(r, paymentRecords)) }
    }
    return resolveEntryPayments(week, paymentRecords)
  })
}
