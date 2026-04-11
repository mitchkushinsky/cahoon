import Papa from 'papaparse'

const OWNER_NAMES = ['mitch & kathy', 'mitch and kathy']

// Parse "6/7 - /14" or "6/7 - 7/5" into { start, end } Date objects
function parseRentalDates(dateStr, year) {
  if (!dateStr) return null
  const parts = dateStr.trim().split(/\s*-\s*/)
  if (parts.length < 2) return null

  const startPart = parts[0].trim()
  const endPart = parts[1].trim()

  const startMatch = startPart.match(/^(\d{1,2})\/(\d{1,2})$/)
  if (!startMatch) return null
  const startMonth = parseInt(startMatch[1])
  const startDay = parseInt(startMatch[2])

  let endMonth, endDay
  const endFull = endPart.match(/^(\d{1,2})\/(\d{1,2})$/)
  const endSameMonth = endPart.match(/^\/(\d{1,2})$/)
  if (endFull) {
    endMonth = parseInt(endFull[1])
    endDay = parseInt(endFull[2])
  } else if (endSameMonth) {
    endMonth = startMonth
    endDay = parseInt(endSameMonth[1])
  } else {
    return null
  }

  return {
    start: new Date(year, startMonth - 1, startDay),
    end: new Date(year, endMonth - 1, endDay),
  }
}

// Parse renter cell (multi-line: name / email / dates)
function parseRenterCell(cell, weekStartDate) {
  if (!cell) return null
  const trimmed = cell.trim()
  if (!trimmed) return null

  // Owner use check
  if (OWNER_NAMES.some(n => trimmed.toLowerCase().includes(n))) {
    return { type: 'owner' }
  }

  const lines = trimmed.split(/\n/).map(l => l.trim()).filter(Boolean)
  if (lines.length < 2) return null

  const name = lines[0]
  const email = lines.find(l => l.includes('@'))
  const datesLine = lines.find(l => /\d+\/\d+\s*-\s*/.test(l))

  // If no valid email or dates, treat as continuation/wrapper row
  if (!email || !datesLine) return null

  const year = weekStartDate ? weekStartDate.getFullYear() : new Date().getFullYear()
  const dates = parseRentalDates(datesLine, year)

  return { type: 'renter', name, email, dates, rawDates: datesLine }
}

function parseAmount(val) {
  if (!val) return 0
  const cleaned = String(val).replace(/[$,\s]/g, '')
  const num = parseFloat(cleaned)
  return isNaN(num) ? 0 : num
}

function parseWeekDate(val) {
  if (!val) return null
  const trimmed = String(val).trim()
  if (!trimmed) return null

  // Try common date formats
  const d = new Date(trimmed)
  if (!isNaN(d.getTime())) return d

  // Try M/D/YYYY
  const m = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/)
  if (m) return new Date(parseInt(m[3]), parseInt(m[1]) - 1, parseInt(m[2]))

  return null
}

// Format date as ISO string (YYYY-MM-DD) for Supabase
export function toISODate(date) {
  if (!date) return null
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function parseCSV(csvText) {
  const { data: rows } = Papa.parse(csvText, {
    skipEmptyLines: true,
  })

  // Skip header row if first cell looks non-date
  const dataRows = rows.filter((_, i) => i > 0 || !isNaN(new Date(rows[0]?.[0]).getTime()))
    .filter(row => row.some(cell => cell?.trim()))

  // Group by week start date (column A)
  const weekMap = new Map()

  for (const row of dataRows) {
    const weekDate = parseWeekDate(row[0])
    if (!weekDate) continue

    const weekKey = toISODate(weekDate)
    const renterCell = row[1] || ''
    const comment = row[8] || ''
    const totalRent = parseAmount(row[9])
    const deposit = parseAmount(row[10]) || 500
    const leaseStatus = row[11] || ''
    const balanceDue = parseAmount(row[12])
    const paymentStatus = row[13] || ''

    const renterInfo = parseRenterCell(renterCell, weekDate)

    if (!weekMap.has(weekKey)) {
      weekMap.set(weekKey, {
        weekStart: weekDate,
        weekKey,
        renterInfo: renterInfo && renterInfo.type !== 'owner' ? renterInfo : null,
        isOwnerSheet: renterInfo?.type === 'owner',
        comment,
        totalRent,
        deposit,
        leaseStatus,
        balanceDue,
        paymentStatus,
      })
    } else {
      // Merge: if existing entry has no renter but this row does
      const existing = weekMap.get(weekKey)
      if (!existing.renterInfo && renterInfo?.type === 'renter') {
        existing.renterInfo = renterInfo
        existing.totalRent = totalRent || existing.totalRent
        existing.deposit = deposit || existing.deposit
        existing.leaseStatus = leaseStatus || existing.leaseStatus
        existing.balanceDue = balanceDue || existing.balanceDue
        existing.paymentStatus = paymentStatus || existing.paymentStatus
      }
      if (!existing.comment && comment) existing.comment = comment
      if (!existing.isOwnerSheet && renterInfo?.type === 'owner') existing.isOwnerSheet = true
    }
  }

  return Array.from(weekMap.values()).sort((a, b) => a.weekStart - b.weekStart)
}
