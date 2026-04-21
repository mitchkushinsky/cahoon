import { buildCalendar } from './parseCSV'

function d(year, month, day) {
  return new Date(year, month - 1, day)
}

function actual(amount, date, method) {
  return amount ? { amount, date, method } : null
}

function renterEntry({ name, email, startDate, endDate, totalRent, leaseStatus, p1, p2 = null, p3 = null }) {
  const depositOwed  = 500
  const payment2Owed = (totalRent - 500) / 2
  const finalOwed    = totalRent - 500 - payment2Owed
  return {
    source: 'demo',
    name, email, startDate, endDate,
    comment: null, isOwnerUse: false,
    totalRent, depositSummary: depositOwed,
    leaseStatus, leaseUrl: null, smartLockCombo: null, balanceDue: 0,
    depositOwed,  depositActual:  p1,
    payment2Owed, payment2Actual: p2,
    finalOwed,    finalActual:    p3,
    renterInfo: { name, email, dates: { start: startDate, end: endDate }, smartLockCombo: null },
  }
}

function ownerEntry(startDate, endDate) {
  return {
    source: 'demo', name: 'Owner Use', email: '',
    startDate, endDate, comment: null, isOwnerUse: true,
    totalRent: 0, depositSummary: 0, leaseStatus: '',
    leaseUrl: null, smartLockCombo: null, balanceDue: 0,
    depositOwed: 0, depositActual: null,
    payment2Owed: 0, payment2Actual: null,
    finalOwed: 0, finalActual: null,
    renterInfo: { name: 'Owner Use', email: '', dates: { start: startDate, end: endDate }, smartLockCombo: null },
  }
}

export function getDemoData() {
  const entries = [
    renterEntry({
      name: 'Sarah & Tom Whitfield', email: 'swhitfield@gmail.com',
      startDate: d(2026, 6, 7), endDate: d(2026, 6, 14),
      totalRent: 2400, leaseStatus: 'Signed 10/1',
      p1: actual(500,  d(2025, 10,  1), 'Venmo'),
      p2: actual(950,  d(2026,  1, 15), 'Venmo'),
      p3: actual(950,  d(2026,  5,  7), 'Venmo'),
    }),
    renterEntry({
      name: 'The Delaney Family', email: 'mdelaney@yahoo.com',
      startDate: d(2026, 6, 14), endDate: d(2026, 6, 21),
      totalRent: 2400, leaseStatus: 'Signed 11/3',
      p1: actual(500,  d(2025, 11,  3), 'Check'),
    }),
    renterEntry({
      name: 'Robert Finch', email: 'rfinch@outlook.com',
      startDate: d(2026, 6, 21), endDate: d(2026, 6, 28),
      totalRent: 2200, leaseStatus: 'Signed 10/15',
      p1: actual(500,  d(2025, 10, 15), 'Zelle'),
      p2: actual(850,  d(2026,  1, 15), 'Zelle'),
    }),
    ownerEntry(d(2026, 6, 28), d(2026, 7, 12)),
    renterEntry({
      name: 'Patricia Okafor', email: 'pokafor@gmail.com',
      startDate: d(2026, 7, 12), endDate: d(2026, 7, 19),
      totalRent: 4500, leaseStatus: 'Signed 9/28',
      p1: actual(500,  d(2025,  9, 28), 'Venmo'),
      p2: actual(2000, d(2026,  1, 15), 'Venmo'),
      p3: actual(2000, d(2026,  6, 12), 'Venmo'),
    }),
    renterEntry({
      name: 'James & Lisa Nguyen', email: 'jnguyen@me.com',
      startDate: d(2026, 7, 19), endDate: d(2026, 7, 26),
      totalRent: 4500, leaseStatus: 'Signed 10/5',
      p1: actual(500,  d(2025, 10,  5), 'Venmo'),
      p2: actual(2000, d(2026,  1, 15), 'Venmo'),
    }),
    renterEntry({
      name: 'The Goldstein Group', email: 'dgoldstein@gmail.com',
      startDate: d(2026, 7, 26), endDate: d(2026, 8,  2),
      totalRent: 5000, leaseStatus: 'Signed 10/20',
      p1: actual(500,  d(2025, 10, 20), 'Check'),
      p2: actual(2250, d(2026,  1, 15), 'Check'),
    }),
    renterEntry({
      name: 'Carol Brennan', email: 'cbrennan@aol.com',
      startDate: d(2026, 8,  9), endDate: d(2026, 8, 16),
      totalRent: 4800, leaseStatus: 'Signed 11/1',
      p1: actual(500,  d(2025, 11,  1), 'Venmo'),
    }),
    renterEntry({
      name: 'Miguel & Rosa Santos', email: 'msantos@gmail.com',
      startDate: d(2026, 8, 16), endDate: d(2026, 8, 23),
      totalRent: 4800, leaseStatus: 'Signed 10/8',
      p1: actual(500,  d(2025, 10,  8), 'Zelle'),
      p2: actual(2150, d(2026,  1, 15), 'Zelle'),
      p3: actual(2150, d(2026,  7, 16), 'Zelle'),
    }),
    renterEntry({
      name: 'The Harrington Family', email: 'sharrington@gmail.com',
      startDate: d(2026, 8, 30), endDate: d(2026, 9,  6),
      totalRent: 3200, leaseStatus: 'Signed 12/1',
      p1: actual(500,  d(2025, 12,  1), 'Venmo'),
      p2: actual(1350, d(2026,  1, 15), 'Venmo'),
    }),
  ]

  const appointments = [
    { id: 'da-1',  week_start: '2026-06-14', date: '2026-06-14', type: 'cleaning', title: 'Cleaning Services', notes: null },
    { id: 'da-2',  week_start: '2026-06-21', date: '2026-06-21', type: 'cleaning', title: 'Cleaning Services', notes: null },
    { id: 'da-3',  week_start: '2026-06-28', date: '2026-06-28', type: 'cleaning', title: 'Cleaning Services', notes: null },
    { id: 'da-4',  week_start: '2026-07-12', date: '2026-07-12', type: 'cleaning', title: 'Cleaning Services', notes: null },
    { id: 'da-5',  week_start: '2026-07-19', date: '2026-07-19', type: 'cleaning', title: 'Cleaning Services', notes: null },
    { id: 'da-6',  week_start: '2026-07-26', date: '2026-07-26', type: 'cleaning', title: 'Cleaning Services', notes: null },
    { id: 'da-7',  week_start: '2026-08-02', date: '2026-08-02', type: 'cleaning', title: 'Cleaning Services', notes: null },
    { id: 'da-8',  week_start: '2026-08-09', date: '2026-08-09', type: 'cleaning', title: 'Cleaning Services', notes: null },
    { id: 'da-9',  week_start: '2026-08-09', date: '2026-08-09', type: 'repair',   title: 'Repair: Deck Railing', notes: null },
    { id: 'da-10', week_start: '2026-08-16', date: '2026-08-16', type: 'cleaning', title: 'Cleaning Services', notes: null },
    { id: 'da-11', week_start: '2026-08-23', date: '2026-08-23', type: 'cleaning', title: 'Cleaning Services', notes: null },
    { id: 'da-12', week_start: '2026-08-30', date: '2026-08-30', type: 'cleaning', title: 'Cleaning Services', notes: null },
  ]

  const weeks = buildCalendar(entries, appointments)
  return { weeks, appointments }
}
