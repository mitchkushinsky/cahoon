// Calculate payment milestones and status for a renter week

export function calculateMilestones(totalRent, deposit, leaseStart) {
  const remaining = totalRent - deposit
  const half = Math.round(remaining / 2 * 100) / 100
  const year = leaseStart ? leaseStart.getFullYear() : new Date().getFullYear()

  const thirtyBefore = leaseStart ? new Date(leaseStart) : null
  if (thirtyBefore) thirtyBefore.setDate(thirtyBefore.getDate() - 30)

  return [
    { label: 'Deposit', amount: deposit, due: null }, // due on signing
    { label: '50% of balance', amount: half, due: new Date(year, 0, 15) }, // Jan 15
    { label: 'Remaining balance', amount: remaining - half, due: thirtyBefore }, // 30 days before
  ]
}

export function amountDueByNow(totalRent, deposit, leaseStart, today = new Date()) {
  const milestones = calculateMilestones(totalRent, deposit, leaseStart)
  // Deposit (milestone 0) always counts as past due
  let due = milestones[0].amount
  if (milestones[1].due && milestones[1].due <= today) due += milestones[1].amount
  if (milestones[2].due && milestones[2].due <= today) due += milestones[2].amount
  return Math.min(due, totalRent)
}

// Parse column N free text to extract amount paid
export function parseAmountPaid(paymentText, totalRent) {
  if (!paymentText) return 0
  const text = paymentText.toLowerCase()

  if (text.includes('paid in full') || text.includes('balance paid')) return totalRent

  // "deposit + $X"
  const depositPlusMatch = text.match(/deposit\s*\+\s*\$?([\d,]+)/)
  if (depositPlusMatch) return 500 + parseFloat(depositPlusMatch[1].replace(/,/g, ''))

  // "$X paid" or "received $X" or "paid $X"
  const dollarMatch = text.match(/\$?([\d,]+(?:\.\d{2})?)\s*(paid|received|deposit)/)
    || text.match(/(paid|received)\s*\$?([\d,]+(?:\.\d{2})?)/)
  if (dollarMatch) {
    const raw = dollarMatch[1] || dollarMatch[2]
    const amount = parseFloat(raw.replace(/,/g, ''))
    if (!isNaN(amount) && amount > 0) return amount
  }

  // "deposit received" or "deposit paid" → $500
  if (text.includes('deposit')) return 500

  return 0
}

export function getPaymentBadge(amountPaid, amountDueNow, totalRent) {
  if (amountPaid >= totalRent) return { label: 'Paid in Full', emoji: '✅', color: 'green' }
  if (amountPaid >= amountDueNow) return { label: 'Current', emoji: '🟢', color: 'green' }
  if (amountPaid > 0) return { label: 'Partial', emoji: '🟡', color: 'yellow' }
  if (amountDueNow > 0) return { label: 'Overdue', emoji: '🔴', color: 'red' }
  return { label: 'Pending', emoji: '⚪', color: 'gray' }
}
