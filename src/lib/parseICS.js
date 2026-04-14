// Determines whether a UTC date falls in EDT (UTC-4) or EST (UTC-5)
function utcToEastern(utcDate) {
  const year = utcDate.getUTCFullYear()
  // DST in US: second Sunday in March → first Sunday in November
  const dstStart = nthSundayOfMonth(year, 2, 2) // March = month index 2
  const dstEnd   = nthSundayOfMonth(year, 10, 1) // November = month index 10
  const offsetHours = utcDate >= dstStart && utcDate < dstEnd ? 4 : 5
  return new Date(utcDate.getTime() - offsetHours * 60 * 60 * 1000)
}

function nthSundayOfMonth(year, month, n) {
  // month: 0-based JS month index
  const d = new Date(Date.UTC(year, month, 1))
  // Advance to first Sunday
  d.setUTCDate(1 + ((7 - d.getUTCDay()) % 7))
  // Advance (n-1) more weeks
  d.setUTCDate(d.getUTCDate() + (n - 1) * 7)
  return d
}

function parseDTSTART(value) {
  // Strip any TZID prefix (e.g. "TZID=America/New_York:20260628T110000")
  const raw = value.includes(':') ? value.split(':').pop() : value
  if (raw.endsWith('Z')) {
    // UTC timestamp — convert to Eastern
    const year  = parseInt(raw.slice(0, 4), 10)
    const month = parseInt(raw.slice(4, 6), 10) - 1
    const day   = parseInt(raw.slice(6, 8), 10)
    const hour  = parseInt(raw.slice(9, 11), 10)
    const min   = parseInt(raw.slice(11, 13), 10)
    const sec   = parseInt(raw.slice(13, 15), 10)
    const utc = new Date(Date.UTC(year, month, day, hour, min, sec))
    return utcToEastern(utc)
  }
  // Date-only (e.g. 20260628) or floating local time — treat as-is
  const year  = parseInt(raw.slice(0, 4), 10)
  const month = parseInt(raw.slice(4, 6), 10) - 1
  const day   = parseInt(raw.slice(6, 8), 10)
  return new Date(year, month, day)
}

function toYMD(d) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function mostRecentSunday(d) {
  const copy = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  copy.setDate(copy.getDate() - copy.getDay()) // getDay() 0=Sun
  return copy
}

export function parseICS(text) {
  // Unfold continuation lines (RFC 5545: CRLF + whitespace = continuation)
  const unfolded = text.replace(/\r?\n[ \t]/g, '')

  // Split into VEVENT blocks
  const eventBlocks = []
  const lines = unfolded.split(/\r?\n/)
  let inEvent = false
  let current = []
  for (const line of lines) {
    if (line === 'BEGIN:VEVENT') { inEvent = true; current = []; continue }
    if (line === 'END:VEVENT')   { inEvent = false; eventBlocks.push(current); continue }
    if (inEvent) current.push(line)
  }

  const parsed = []
  for (const block of eventBlocks) {
    const get = (key) => {
      // Match "KEY:" or "KEY;..." lines
      const re = new RegExp(`^${key}(?:;[^:]*)?:(.*)$`)
      for (const line of block) {
        const m = line.match(re)
        if (m) return m[1].trim()
      }
      return null
    }

    const status  = get('STATUS')
    if (status === 'CANCELLED') continue

    const summary = get('SUMMARY')
    const dtstart = get('DTSTART')
    if (!summary || !dtstart) continue

    const localDate = parseDTSTART(dtstart)
    const dateStr   = toYMD(localDate)
    const title     = summary

    const lc = title.toLowerCase()
    const type = lc.includes('cleaning')
      ? 'cleaning'
      : (lc.includes('mosquito') || lc.includes('exterminator') || lc.includes('pest'))
        ? 'exterminator'
        : 'repair'
    const weekStartDate = mostRecentSunday(localDate)
    const week_start    = toYMD(weekStartDate)

    parsed.push({ week_start, type, title, date: dateStr, notes: '' })
  }

  // Deduplicate by (date + title), keep first occurrence
  const seen = new Set()
  const deduped = []
  for (const appt of parsed) {
    const key = `${appt.date}|${appt.title}`
    if (!seen.has(key)) {
      seen.add(key)
      deduped.push(appt)
    }
  }

  return deduped
}
