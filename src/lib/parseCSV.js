import Papa from 'papaparse'

const OWNER_NAMES = ['mitch & kathy', 'mitch and kathy']

// ─── Low-level helpers ────────────────────────────────────────────────────────

function parseAmount(val) {
  if (!val) return 0
  const cleaned = String(val).replace(/[$,\s]/g, '')
  const num = parseFloat(cleaned)
  return isNaN(num) ? 0 : num
}

// Always parse as local time — new Date("M/D/YYYY") string parses local,
// new Date("YYYY-MM-DD") would parse as UTC and shift by timezone offset.
function parseDate(val) {
  if (!val) return null
  const trimmed = String(val).trim()
  if (!trimmed) return null

  // M/D/YYYY or M/D/YY
  const mdy = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/)
  if (mdy) {
    let year = parseInt(mdy[3])
    if (year < 100) year += 2000
    return new Date(year, parseInt(mdy[1]) - 1, parseInt(mdy[2]))
  }

  // YYYY-MM-DD (force local)
  const iso = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (iso) return new Date(parseInt(iso[1]), parseInt(iso[2]) - 1, parseInt(iso[3]))

  return null
}

// 3-line actual payment cell: amount / date / method
function parseActualPayment(cellText) {
  if (!cellText || !cellText.trim()) return null
  const lines = cellText.split('\n').map(l => l.trim()).filter(Boolean)
  if (lines.length < 3) return null
  const amount = parseAmount(lines[0])
  return { amount, date: parseDate(lines[1]), method: lines[2] }
}

export function toISODate(date) {
  if (!date) return null
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

// ─── Row parser ───────────────────────────────────────────────────────────────

// Column indices (0-based, after skipping header row 1):
// A=0  Name
// B=1  Email
// C=2  Start Date
// D=3  End Date
// E=4  Comment
// F=5  Total Rent
// G=6  Deposit Owed (summary display field)
// H=7  Lease Status
// I=8  Balance Due
// J=9  Payment 1 – Deposit Owed      ← maps to depositOwed  (paymentLogic)
// K=10 Payment 1 – Actual             ← maps to depositActual
// L=11 Payment 2 – Jan 15 Owed       ← maps to payment2Owed
// M=12 Payment 2 – Actual             ← maps to payment2Actual
// N=13 Payment 3 – 30 days Owed      ← maps to finalOwed
// O=14 Payment 3 – Actual             ← maps to finalActual
// P=15 Lease URL                      ← maps to leaseUrl
// Q=16 Smart Lock Combo               ← maps to smartLockCombo

function parseRow(row) {
  const name      = (row[0] || '').trim()
  const email     = (row[1] || '').trim()
  const startDate = parseDate(row[2])
  const endDate   = parseDate(row[3])

  if (!name || !startDate || !endDate) return null // skip unparseable rows

  const isOwnerUse  = OWNER_NAMES.some(n => name.toLowerCase().includes(n))
  const comment     = (row[4] || '').trim() || null
  const totalRent   = parseAmount(row[5])
  const depositSummary = parseAmount(row[6]) // col G — informational only
  const leaseStatus = (row[7] || '').trim()
  const balanceDue  = parseAmount(row[8])

  // Payment milestone fields — named to match paymentLogic.js expectations
  const depositOwed    = parseAmount(row[9])
  const depositActual  = parseActualPayment(row[10])
  const payment2Owed   = parseAmount(row[11])
  const payment2Actual = parseActualPayment(row[12])
  const finalOwed      = parseAmount(row[13])
  const finalActual    = parseActualPayment(row[14])
  const leaseUrl       = (row[15] || '').trim() || null  // col P
  const smartLockCombo = (row[16] || '').trim() || null  // col Q

  // Backward-compat wrapper so paymentLogic and modal components can reach
  // renterInfo.name, renterInfo.email, renterInfo.dates.{start,end}
  const renterInfo = {
    name,
    email,
    dates: { start: startDate, end: endDate },
    smartLockCombo,
  }

  return {
    name,
    email,
    startDate,
    endDate,
    comment,
    isOwnerUse,
    totalRent,
    depositSummary,
    leaseStatus,
    leaseUrl,
    smartLockCombo,
    balanceDue,
    depositOwed,
    depositActual,
    payment2Owed,
    payment2Actual,
    finalOwed,
    finalActual,
    renterInfo,
  }
}

// ─── Calendar generation ──────────────────────────────────────────────────────

// Return the Sunday on or before `date` at midnight local time
function prevSunday(date) {
  const d = new Date(date)
  d.setDate(d.getDate() - d.getDay()) // getDay() === 0 for Sunday
  d.setHours(0, 0, 0, 0)
  return d
}

function buildCalendar(entries) {
  const valid = entries.filter(e => e.startDate && e.endDate)
  if (!valid.length) return []

  const minStart = new Date(Math.min(...valid.map(e => e.startDate.getTime())))
  const maxEnd   = new Date(Math.max(...valid.map(e => e.endDate.getTime())))

  // Generate every Sunday from prevSunday(minStart) through prevSunday(maxEnd)
  const slots = []
  const cursor = prevSunday(minStart)
  while (cursor <= maxEnd) {
    slots.push(new Date(cursor))
    cursor.setDate(cursor.getDate() + 7)
  }

  return slots.map(weekStart => {
    const weekKey = toISODate(weekStart)
    const weekEnd = new Date(weekStart)
    weekEnd.setDate(weekEnd.getDate() + 7)
    weekEnd.setHours(0, 0, 0, 0) // keep at local midnight after DST transitions

    const wsMs  = weekStart.getTime()
    const weMs  = weekEnd.getTime()

    // Half-open interval [weekStart, weekEnd):
    // A rental belongs to this week if it starts before weekEnd AND ends AFTER weekStart.
    // endDate === weekStart (e.g. rental ends exactly on this Sunday) is excluded —
    // that rental belongs to the previous week only.
    const overlapping = valid.filter(e =>
      e.startDate.getTime() < weMs && e.endDate.getTime() > wsMs
    )

    if (overlapping.length === 0) {
      return { weekStart, weekKey, type: 'vacant', isOwnerSheet: false, comment: null }
    }

    if (overlapping.length === 1) {
      const rental = overlapping[0]
      if (rental.isOwnerUse) {
        return { weekStart, weekKey, type: 'owner', isOwnerSheet: true,
          comment: rental.comment, ...rental }
      }
      return { weekStart, weekKey, type: 'renter', isOwnerSheet: false,
        comment: rental.comment, ...rental }
    }

    // Multiple overlapping entries
    const ownerEntries  = overlapping.filter(e =>  e.isOwnerUse)
    const renterEntries = overlapping.filter(e => !e.isOwnerUse)

    // All owner-use (rare edge case)
    if (renterEntries.length === 0) {
      return { weekStart, weekKey, type: 'owner', isOwnerSheet: true,
        comment: ownerEntries[0].comment, ...ownerEntries[0] }
    }

    // Split: one or more renters (owner-use + renter overlap treated as split too)
    const splitRenters = renterEntries.length > 0 ? renterEntries : overlapping
    const comment = splitRenters.find(r => r.comment)?.comment || null
    console.log('[parseCSV] split week', weekKey, splitRenters.map(r => r.name))
    return {
      weekStart, weekKey, type: 'split', isOwnerSheet: false, comment,
      renters: splitRenters,
    }
  })
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function parseCSV(csvText) {
  const { data: rows } = Papa.parse(csvText, { skipEmptyLines: true })

  // Row 0 is the header — skip it
  const dataRows = rows.slice(1).filter(row => row.some(cell => cell?.trim()))

  const entries = dataRows.map(parseRow).filter(Boolean)

  return buildCalendar(entries)
}
