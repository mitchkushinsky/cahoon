// Compute active reminder banners from the full list of week slots.
// Returns an array of reminder objects sorted by urgency (daysUntil asc).

import { computePayment } from './paymentLogic'

// DEV ONLY — set to a date string to test reminders, e.g. '2026-04-22'
// Set to null before deploying
const DEV_DATE_OVERRIDE = null

const DAY_MS = 24 * 60 * 60 * 1000

// ── Mail merge helpers ────────────────────────────────────────────────────────

// Replace <FieldName> placeholders with values from the fields object.
export function mergeTemplate(template, fields) {
  return Object.entries(fields).reduce(
    (t, [key, val]) => t.replaceAll(`<${key}>`, val ?? ''),
    template
  )
}

// Convert **bold** markers to <strong> tags for HTML preview.
// Preserves all other content as-is (use with white-space: pre-wrap).
export function renderHtml(merged) {
  return merged.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
}

// Strip **bold** markers for plain text (clipboard / mailto body).
export function renderPlain(merged) {
  return merged.replace(/\*\*/g, '')
}

// ── Email templates ───────────────────────────────────────────────────────────

const JAN15_TEMPLATE = `Hi <Name>,

Just a reminder that your January 15 payment of <Payment2Amount> is almost due.

Please:

* Venmo (@Mitchell-Kushinsky)
* Zelle to mitch.kushinsky@gmail.com
* USPS to:
          215 W 91st Street
           Apt. 23
           New York, NY 10024

Thanks,
Mitch Kushinsky`

const FINAL_PAYMENT_TEMPLATE = `Hi <Name>,

It's only a month before your stay at Cahoon Drive. This is just a reminder that your final payment of <Payment3Amount> is almost due.

Please:

* Venmo (@Mitchell-Kushinsky)
* Zelle to mitch.kushinsky@gmail.com
* USPS to:
          215 W 91st Street
           Apt. 23
           New York, NY 10024

Thanks,
Mitch Kushinsky`

export const WELCOME_EMAIL_TEMPLATE = `Hi <Name>,

I hope you'll have a great week at 1105 Cahoon Hollow Road.

Here is some information that you'll need to know.

**Check in is 3:00 PM or after on <LeaseStartDate>**
**Check out is 10:00 AM on <LeaseEndDate>**

If you have any problems while you are here, please call our caretaker Jose with any major issues related to the house (plumbing, electrical, appliances) at 508-383-3134. For minor issues or questions email Jose at ocean.heart.cleaning@gmail.com. He will respond in a timely manner.

**Keys** - Your Key to the house will be left in a lock box which is located next to the first door by the locked basement/storage entrance. The combination is **3249**. Please return the key to the lockbox at checkout.

As a new security feature this year, we have added a Smart Lock to the front door. The combination for your week is **<SmartLockCombo>**.

The **WIFI** network is **1105Cahoon** and the password is **seals2023**.

**Garbage:**
Pickup is two times a week, which is Wednesday and Saturday morning. Recycling goes in the blue bin and is picked up on Monday.

The renovation is now complete. The one major change this year is the replacement of the old furnace. We also have new mattresses in the Queen and Twin Bedrooms.

Also, here are a few requests:
I hope your weather is perfect, but if there is a storm, please try to secure whatever is on the deck. And remember, the new countertops should only be cleaned with soap and water. Please don't put hot pans or pots directly on them.

Enjoy your vacation and please let me know if you have trouble finding anything.

Mitch Kushinsky`

// ── Internal helpers ──────────────────────────────────────────────────────────

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

function fmtLongDate(d) {
  return d instanceof Date
    ? d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
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

function firstName(fullName) {
  return (fullName || '').split(/\s+/)[0]
}

// ── Main export ───────────────────────────────────────────────────────────────

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

    // Build per-renter mailto links using the template
    const mailtoUrls = jan15Renters.map(({ entry }) => {
      const body = renderPlain(mergeTemplate(JAN15_TEMPLATE, {
        Name: firstName(entry.name),
        Payment2Amount: fmt(entry.payment2Owed),
      }))
      return {
        name: entry.name,
        email: entry.email,
        url: buildMailto(entry.email, 'Cahoon - January 15 Payment Reminder', body),
      }
    })

    const jan15Year = jan15Renters[0].entry.renterInfo?.dates?.start?.getFullYear() ?? todayMidnight.getFullYear()
    reminders.push({
      type: 'JAN_15',
      reminderKey: `JAN_15_${jan15Year}`,
      renterName: names,
      email: jan15Renters[0].entry.email,
      message: `Jan 15 payment due in ${minDays} day${minDays === 1 ? '' : 's'} for: ${names}`,
      mailtoUrls,
      mailtoUrl: mailtoUrls[0]?.url,
      daysUntil: minDays,
    })
  }

  // ── PER-RENTER REMINDERS ──────────────────────────────────────────────────
  for (const entry of unique) {
    const { name, email, renterInfo, finalOwed, finalActual, payment2Owed, payment2Actual, startDate, smartLockCombo } = entry
    const leaseStart = renterInfo?.dates?.start || startDate
    const leaseEnd   = renterInfo?.dates?.end   || entry.endDate

    // FINAL_PAYMENT_REMINDER
    if (leaseStart) {
      const computed = computePayment(entry, todayMidnight)
      const finalMilestone = computed.milestones[2]

      // Credit from overpayments on milestones 1+2 that flows into final payment
      const depositOwed  = entry.depositOwed  || 0
      const payment2Owed = entry.payment2Owed || 0
      const paid1 = entry.depositActual?.amount  || 0
      const paid2 = entry.payment2Actual?.amount || 0
      const credit2 = Math.max(0, paid1 + paid2 - depositOwed - payment2Owed)
      const netFinalOwed = Math.max(0, finalMilestone.amountOwed - credit2)
      const paid3 = finalMilestone.actual?.amount || 0

      if (netFinalOwed > 0 && paid3 < netFinalOwed) {
        const finalDueDate = new Date(leaseStart.getTime() - 30 * DAY_MS)
        const days = daysUntil(finalDueDate, todayMidnight)

        if (days >= 0 && days <= 2) {
          const amountDue = netFinalOwed - paid3
          const body = renderPlain(mergeTemplate(FINAL_PAYMENT_TEMPLATE, {
            Name: firstName(name),
            Payment3Amount: fmt(amountDue),
          }))
          reminders.push({
            type: 'FINAL_PAYMENT',
            reminderKey: `FINAL_PAYMENT_${isoDate(leaseStart)}`,
            renterName: name,
            email,
            message: `${name}'s final payment of ${fmt(amountDue)} is due in ${days} day${days === 1 ? '' : 's'}. Send reminder?`,
            mailtoUrl: buildMailto(email, 'Cahoon - Final Payment Reminder', body),
            daysUntil: days,
          })
        }
      }
    }

    // WELCOME_EMAIL
    if (leaseStart) {
      const days = daysUntil(leaseStart, todayMidnight)
      if (days >= 0 && days <= 7) {
        const computed = computePayment(entry, todayMidnight)
        const outstandingBalance = Math.max(0, (entry.totalRent || 0) - computed.totalPaid)
        const balanceNote = outstandingBalance > 0 ? ` · ${fmt(outstandingBalance)} balance outstanding` : ''

        const mergeFields = {
          Name: firstName(name),
          LeaseStartDate: fmtLongDate(leaseStart),
          LeaseEndDate: leaseEnd ? fmtLongDate(leaseEnd) : '[end date]',
          SmartLockCombo: smartLockCombo || '[combo not set]',
        }
        reminders.push({
          type: 'WELCOME',
          reminderKey: `WELCOME_${isoDate(leaseStart)}`,
          renterName: name,
          email,
          message: `${name} arrives in ${days} day${days === 1 ? '' : 's'}. Send welcome email?${balanceNote}`,
          emailSubject: 'Welcome to 1105 Cahoon Hollow Road!',
          emailTemplate: WELCOME_EMAIL_TEMPLATE,
          mergeFields,
          daysUntil: days,
        })
      }
    }
  }

  // Sort by urgency
  return reminders.sort((a, b) => a.daysUntil - b.daysUntil)
}
