// Compute active reminder banners from the full list of week slots.
// Returns an array of reminder objects sorted by urgency (daysUntil asc).

// DEV ONLY — set to a date string to test reminders, e.g. '2026-04-22'
// Set to null before deploying
const DEV_DATE_OVERRIDE = null

const DAY_MS = 24 * 60 * 60 * 1000

function daysUntil(targetDate, today) {
  const diff = targetDate.getTime() - today.getTime()
  return Math.ceil(diff / DAY_MS)
}

function fmt(n) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n ?? 0)
}

function fmtDate(d) {
  return d instanceof Date
    ? d.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })
    : String(d)
}

function buildMailto(to, subject, body) {
  return `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
}

function isoDate(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function computeReminders(weeks) {
  const today = DEV_DATE_OVERRIDE
    ? new Date(DEV_DATE_OVERRIDE + 'T12:00:00')
    : new Date()
  const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  const reminders = []

  // Collect unique renter entries (skip vacant/owner-only weeks)
  const renterEntries = []
  for (const week of weeks) {
    if (week.type === 'split' && week.renters) {
      for (const r of week.renters) renterEntries.push(r)
    } else if (week.type === 'renter' && week.renterInfo) {
      renterEntries.push(week)
    }
  }

  // Deduplicate by name+startDate (a renter can appear in multiple week slots)
  const seen = new Set()
  const unique = renterEntries.filter(e => {
    const key = `${e.name}|${e.startDate?.toISOString()}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })

  // ── JAN 15 REMINDER ──────────────────────────────────────────────────────
  const jan15Renters = []
  for (const entry of unique) {
    if (!entry.payment2Owed || entry.payment2Owed <= 0) continue
    if (entry.payment2Actual?.amount > 0) continue  // already paid

    const leaseYear = entry.renterInfo?.dates?.start?.getFullYear() ?? todayMidnight.getFullYear()
    const jan15 = new Date(leaseYear, 0, 15)
    const days = daysUntil(jan15, todayMidnight)

    // Fire on Jan 13 or Jan 14 (2 days window before due)
    if (days >= 1 && days <= 2) {
      jan15Renters.push({ entry, days })
    }
  }

  if (jan15Renters.length > 0) {
    const minDays = Math.min(...jan15Renters.map(x => x.days))
    const names = jan15Renters.map(x => x.entry.name).join(', ')

    // Build per-renter mailto links
    const mailtoUrls = jan15Renters.map(({ entry }) => {
      const body = `Hi ${entry.name},\n\nJust a reminder that your second payment of ${fmt(entry.payment2Owed)} is due on January 15th.\n\nThank you!`
      return {
        name: entry.name,
        email: entry.email,
        url: buildMailto(entry.email, 'Cahoon - Payment Reminder', body),
      }
    })

    const jan15Year = jan15Renters[0].entry.renterInfo?.dates?.start?.getFullYear() ?? todayMidnight.getFullYear()
    reminders.push({
      type: 'JAN_15',
      reminderKey: `JAN_15_${jan15Year}`,
      renterName: names,
      email: jan15Renters[0].entry.email,
      message: `Jan 15 payment due in ${minDays} day${minDays === 1 ? '' : 's'} for: ${names}`,
      mailtoUrls,        // array for multi-renter
      mailtoUrl: mailtoUrls[0]?.url,
      daysUntil: minDays,
    })
  }

  // ── PER-RENTER REMINDERS ──────────────────────────────────────────────────
  for (const entry of unique) {
    const { name, email, renterInfo, finalOwed, finalActual, payment2Owed, payment2Actual, startDate } = entry
    const leaseStart = renterInfo?.dates?.start || startDate

    // FINAL_PAYMENT_REMINDER
    if (finalOwed > 0 && !(finalActual?.amount > 0) && leaseStart) {
      const finalDueDate = new Date(leaseStart.getTime() - 30 * DAY_MS)
      const days = daysUntil(finalDueDate, todayMidnight)

      if (days >= 0 && days <= 2) {
        const prevMethod = payment2Actual?.method || depositActual?.method || null
        const methodNote = prevMethod ? ` Please send via ${prevMethod}.` : ''
        const body = `Hi ${name},\n\nJust a reminder that your final payment of ${fmt(finalOwed)} is due on ${fmtDate(finalDueDate)}.${methodNote}\n\nThank you!`
        reminders.push({
          type: 'FINAL_PAYMENT',
          reminderKey: `FINAL_PAYMENT_${isoDate(leaseStart)}`,
          renterName: name,
          email,
          message: `${name}'s final payment of ${fmt(finalOwed)} is due in ${days} day${days === 1 ? '' : 's'}. Send reminder?`,
          mailtoUrl: buildMailto(email, 'Cahoon - Final Payment Reminder', body),
          daysUntil: days,
        })
      }
    }

    // WELCOME_EMAIL
    if (leaseStart) {
      const days = daysUntil(leaseStart, todayMidnight)
      if (days >= 0 && days <= 7) {
        const body = `Hi ${name},\n\nWe're looking forward to your arrival on ${fmtDate(leaseStart)}! Please don't hesitate to reach out if you have any questions.\n\nSee you soon!`
        reminders.push({
          type: 'WELCOME',
          reminderKey: `WELCOME_${isoDate(leaseStart)}`,
          renterName: name,
          email,
          message: `${name} arrives in ${days} day${days === 1 ? '' : 's'}. Send welcome email?`,
          mailtoUrl: buildMailto(email, 'Welcome to Cahoon Hollow!', body),
          daysUntil: days,
        })
      }
    }
  }

  // Sort by urgency
  return reminders.sort((a, b) => a.daysUntil - b.daysUntil)
}
