import { supabase } from './supabase'
import { toISODate } from './parseCSV'
import { buildRenterKey } from './resolvePayments'

function entryToSeeds(entry) {
  const renterKey = buildRenterKey(entry)
  const seeds = []

  if (entry.depositActual?.amount > 0) {
    seeds.push({
      renter_key: renterKey,
      payment_number: 1,
      amount: entry.depositActual.amount,
      date: entry.depositActual.date ? toISODate(entry.depositActual.date) : null,
      method: entry.depositActual.method || null,
    })
  }
  if (entry.payment2Actual?.amount > 0) {
    seeds.push({
      renter_key: renterKey,
      payment_number: 2,
      amount: entry.payment2Actual.amount,
      date: entry.payment2Actual.date ? toISODate(entry.payment2Actual.date) : null,
      method: entry.payment2Actual.method || null,
    })
  }
  if (entry.finalActual?.amount > 0) {
    seeds.push({
      renter_key: renterKey,
      payment_number: 3,
      amount: entry.finalActual.amount,
      date: entry.finalActual.date ? toISODate(entry.finalActual.date) : null,
      method: entry.finalActual.method || null,
    })
  }
  return seeds
}

// One-time migration: for each renter that has CSV payment data but no
// Supabase records yet, insert the CSV payments as seed data.
// Silently no-ops for any renter that already has records.
export async function seedPaymentsFromCSV(weeks, existingPaymentRecords) {
  const existingKeys = new Set(existingPaymentRecords.map(r => r.renter_key))
  const seen = new Set()
  const allSeeds = []

  for (const week of weeks) {
    if (week.type === 'vacant' || week.type === 'owner') continue

    const candidates = week.type === 'split' ? (week.renters || []) : [week]
    for (const entry of candidates) {
      if (!entry.email || !entry.startDate) continue
      const key = buildRenterKey(entry)
      if (seen.has(key) || existingKeys.has(key)) continue
      seen.add(key)
      allSeeds.push(...entryToSeeds(entry))
    }
  }

  if (allSeeds.length > 0) {
    await supabase.from('payment_records').insert(allSeeds)
  }
}
