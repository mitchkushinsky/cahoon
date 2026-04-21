import { toISODate } from './parseCSV'

/**
 * Migrate 2026 CSV entries into Supabase renters + rentals tables.
 * Skips owner-use rows and rows that already exist (no overwrite).
 * Reads from payment_records (already seeded) to populate payment fields.
 *
 * @param {Array}    csvEntries  - Raw parsed entries from parseCSVEntries()
 * @param {Object}   supabase    - Supabase client
 * @param {Function} onProgress  - Called with { done, total, message } updates
 * @returns {{ inserted, skipped, errors }}
 */
export async function migrate2026(csvEntries, supabase, onProgress) {
  const rentalEntries = csvEntries.filter(
    e => !e.isOwnerUse && e.name && e.startDate && e.endDate
  )
  const total = rentalEntries.length
  let done = 0
  const results = { inserted: 0, skipped: 0, errors: [] }

  // Load payment_records (already seeded from CSV) keyed by renter_key + payment_number
  const { data: paymentRecords } = await supabase.from('payment_records').select('*')
  const prMap = {}
  for (const pr of (paymentRecords || [])) {
    if (!prMap[pr.renter_key]) prMap[pr.renter_key] = {}
    prMap[pr.renter_key][pr.payment_number] = pr
  }

  for (const entry of rentalEntries) {
    done++
    onProgress?.({ done, total, message: `Processing ${entry.name}…` })

    const email = (entry.email || '').toLowerCase().trim()
    const startIso = toISODate(entry.startDate)
    let renterId

    // 1. Find or create renter by email
    if (email) {
      const { data: existing } = await supabase
        .from('renters')
        .select('id')
        .eq('email', email)
        .maybeSingle()

      if (existing) {
        renterId = existing.id
      } else {
        const { data: created, error } = await supabase
          .from('renters')
          .insert({ name: entry.name, email, first_year_rented: 2026 })
          .select('id')
          .single()
        if (error) {
          results.errors.push(`Renter "${entry.name}": ${error.message}`)
          continue
        }
        renterId = created.id
      }
    } else {
      const { data: created, error } = await supabase
        .from('renters')
        .insert({ name: entry.name, first_year_rented: 2026 })
        .select('id')
        .single()
      if (error) {
        results.errors.push(`Renter "${entry.name}": ${error.message}`)
        continue
      }
      renterId = created.id
    }

    // 2. Skip if rental already exists for this renter in 2026 at this start date
    const { data: existingRental } = await supabase
      .from('rentals')
      .select('id')
      .eq('renter_id', renterId)
      .eq('season_year', 2026)
      .eq('start_date', startIso)
      .maybeSingle()

    if (existingRental) {
      results.skipped++
      continue
    }

    // 3. Pull payment amounts/dates/methods from already-seeded payment_records
    const renterKey = `${email}_${startIso}`
    const p1 = prMap[renterKey]?.[1]
    const p2 = prMap[renterKey]?.[2]
    const p3 = prMap[renterKey]?.[3]

    // 4. Insert rental row with all fields
    const { error: rentalErr } = await supabase.from('rentals').insert({
      renter_id:      renterId,
      season_year:    2026,
      start_date:     startIso,
      end_date:       toISODate(entry.endDate),
      total_rent:     entry.totalRent    || null,
      deposit_owed:   entry.depositOwed  || null,
      lease_status:   entry.leaseStatus  || null,
      balance_due:    entry.balanceDue   || null,

      payment1_owed:   entry.depositOwed   || null,
      payment1_amount: p1?.amount          ?? (entry.depositActual?.amount  || null),
      payment1_date:   p1?.date            ?? (entry.depositActual?.date  ? toISODate(entry.depositActual.date)  : null),
      payment1_method: p1?.method          ?? entry.depositActual?.method  ?? null,

      payment2_owed:   entry.payment2Owed  || null,
      payment2_amount: p2?.amount          ?? (entry.payment2Actual?.amount || null),
      payment2_date:   p2?.date            ?? (entry.payment2Actual?.date ? toISODate(entry.payment2Actual.date) : null),
      payment2_method: p2?.method          ?? entry.payment2Actual?.method ?? null,

      payment3_owed:   entry.finalOwed     || null,
      payment3_amount: p3?.amount          ?? (entry.finalActual?.amount   || null),
      payment3_date:   p3?.date            ?? (entry.finalActual?.date   ? toISODate(entry.finalActual.date)   : null),
      payment3_method: p3?.method          ?? entry.finalActual?.method   ?? null,

      lease_url:        entry.leaseUrl       || null,
      smart_lock_combo: entry.smartLockCombo || null,
      source:           'csv',
    })

    if (rentalErr) {
      results.errors.push(`Rental "${entry.name}" ${startIso}: ${rentalErr.message}`)
    } else {
      results.inserted++
    }
  }

  return results
}
