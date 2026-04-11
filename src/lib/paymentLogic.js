// Compute structured milestone data from a week object.
// Returns everything needed for both the card badge and the detail modal.
export function computePayment(week, today = new Date()) {
  const {
    totalRent = 0,
    depositOwed = 0,
    depositActual = null,
    payment2Owed = 0,
    payment2Actual = null,
    finalOwed = 0,
    finalActual = null,
    renterInfo = null,
  } = week

  const leaseStart = renterInfo?.dates?.start || null
  const leaseYear = leaseStart ? leaseStart.getFullYear() : today.getFullYear()

  // Due dates
  const jan15 = new Date(leaseYear, 0, 15)
  const finalDueDate = leaseStart
    ? new Date(leaseStart.getTime() - 30 * 24 * 60 * 60 * 1000)
    : null

  // Raw paid amounts
  const paid1 = depositActual?.amount  || 0
  const paid2 = payment2Actual?.amount || 0
  const paid3 = finalActual?.amount    || 0
  const totalPaid = paid1 + paid2 + paid3

  // Overpayment credit: excess from milestone 1 flows into milestone 2,
  // then excess from milestones 1+2 flows into milestone 3
  const credit1 = Math.max(0, paid1 - depositOwed)
  const m2DueAdjusted = Math.max(0, payment2Owed - credit1)
  const credit2 = Math.max(0, paid1 + paid2 - depositOwed - payment2Owed)
  const m3DueAdjusted = Math.max(0, finalOwed - credit2)
  const totalCredit = credit1 + credit2

  // Which milestones are due as of today
  const m1Due = true // always due on signing
  const m2Due = today >= jan15
  const m3Due = finalDueDate ? today >= finalDueDate : false

  const milestones = [
    {
      label: 'Deposit',
      dueDateLabel: 'On signing',
      dueDate: null,
      amountOwed: depositOwed,
      amountDueNow: depositOwed, // always due
      actual: depositActual,
      isDue: m1Due,
    },
    {
      label: '2nd Payment',
      dueDateLabel: `Jan 15, ${leaseYear}`,
      dueDate: jan15,
      amountOwed: payment2Owed,
      amountDueNow: m2Due ? m2DueAdjusted : 0,
      actual: payment2Actual,
      isDue: m2Due,
    },
    {
      label: 'Final Payment',
      dueDateLabel: finalDueDate
        ? finalDueDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
        : '—',
      dueDate: finalDueDate,
      amountOwed: finalOwed,
      amountDueNow: m3Due ? m3DueAdjusted : 0,
      actual: finalActual,
      isDue: m3Due,
    },
  ]

  // Total owed now
  const totalDueNow = milestones.reduce((s, m) => s + m.amountDueNow, 0)

  // Mismatch check: col J should = col O + col Q + col S
  const sumOwed = depositOwed + payment2Owed + finalOwed
  const hasMismatch = totalRent > 0 && Math.abs(totalRent - sumOwed) > 0.01

  // Overall badge
  const badge = computeBadge(totalPaid, totalDueNow, totalRent, milestones, today)

  return {
    milestones,
    totalPaid,
    totalDueNow,
    totalCredit,
    hasMismatch,
    sumOwed,
    badge,
  }
}

function computeBadge(totalPaid, totalDueNow, totalRent, milestones, today) {
  if (totalRent > 0 && totalPaid >= totalRent) {
    return { emoji: '✅', label: 'Paid in Full', color: 'green' }
  }
  // Check if any due milestone is entirely unpaid
  const anyOverdue = milestones.some(m => m.isDue && m.amountDueNow > 0 && (m.actual?.amount || 0) === 0)
  if (anyOverdue) return { emoji: '🔴', label: 'Overdue', color: 'red' }
  if (totalPaid >= totalDueNow && totalDueNow > 0) {
    return { emoji: '🟢', label: 'Current', color: 'green' }
  }
  if (totalPaid > 0) return { emoji: '🟡', label: 'Partial', color: 'yellow' }
  if (totalDueNow > 0) return { emoji: '🔴', label: 'Overdue', color: 'red' }
  return { emoji: '⚪', label: 'Pending', color: 'gray' }
}

// Per-row milestone status emoji
export function milestoneStatus(milestone) {
  const paid = milestone.actual?.amount || 0
  const owed = milestone.amountOwed
  if (owed === 0) return '—'
  if (paid >= owed) return '✅'
  if (!milestone.isDue) return '⏳'
  if (paid > 0) return '🟡'
  return '🔴'
}
