import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

// ─── Constants ────────────────────────────────────────────────────────────────

const EXPENSE_CATEGORIES = [
  'Utilities',
  'Cleaning',
  'Property Tax',
  'Repairs',
  'Landscaping',
  'Advertising',
  'Travel',
  'Occupancy Tax',
  'Miscellaneous',
  'Long Term Capital Improvements',
]

// MA short-term rental occupancy tax: taxableRent = totalRent / 1.1445
const TAX_DIVISOR = 1.1445

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n ?? 0)
}

function fmtDate(iso) {
  if (!iso) return ''
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function taxForEntry(entry) {
  const rent = entry.totalRent || 0
  return rent - rent / TAX_DIVISOR
}

// Collect unique renter entries across all week slots (deduped by name+startDate)
function getRenterEntries(weeks) {
  const raw = []
  for (const week of weeks) {
    if (week.type === 'renter' && week.renterInfo) {
      raw.push(week)
    } else if (week.type === 'split' && week.renters) {
      for (const r of week.renters) raw.push(r)
    }
  }
  const seen = new Set()
  return raw.filter(e => {
    const key = `${e.name}|${e.startDate?.toISOString()}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

// Group entries by month (YYYY-MM) of their rental end date, filtered to a year
function groupByMonth(entries, year) {
  const groups = {}
  for (const entry of entries) {
    const endDate = entry.renterInfo?.dates?.end || entry.endDate
    if (!endDate) continue
    const d = endDate instanceof Date ? endDate : new Date(endDate)
    if (d.getFullYear() !== year) continue
    const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    if (!groups[monthKey]) groups[monthKey] = []
    groups[monthKey].push(entry)
  }
  return groups
}

function monthLabel(monthKey) {
  const [y, m] = monthKey.split('-').map(Number)
  return new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}

// ─── ExpensesTab ───────────────────────────────────────────────────────────────

function currentMonthKey() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

function ExpensesTab({ expenses, selectedYear, onRefresh }) {
  const [showAdd, setShowAdd] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleteId, setDeleteId] = useState(null)
  const [filterCategory, setFilterCategory] = useState('All')
  const [csvError, setCsvError] = useState(null)
  const [form, setForm] = useState({ date: '', description: '', paid_to: '', amount: '', category: 'Utilities' })

  // Months expanded state — current month open by default, past months closed
  const [expandedMonths, setExpandedMonths] = useState(() => new Set([currentMonthKey()]))

  function toggleMonth(mk) {
    setExpandedMonths(prev => {
      const next = new Set(prev)
      next.has(mk) ? next.delete(mk) : next.add(mk)
      return next
    })
  }

  // Filter by year + category, then group by month descending
  const filtered = expenses.filter(e => {
    const year = e.date ? parseInt(e.date.split('-')[0]) : 0
    return year === selectedYear && (filterCategory === 'All' || e.category === filterCategory)
  })

  const grouped = {}
  for (const exp of filtered) {
    const [y, m] = exp.date.split('-')
    const mk = `${y}-${m}`
    if (!grouped[mk]) grouped[mk] = []
    grouped[mk].push(exp)
  }
  // Sort each month's expenses by date ascending
  for (const mk of Object.keys(grouped)) {
    grouped[mk].sort((a, b) => (a.date < b.date ? -1 : 1))
  }
  const months = Object.keys(grouped).sort().reverse() // most recent first

  const grandTotal = filtered.reduce((s, e) => s + (Number(e.amount) || 0), 0)

  async function handleAdd() {
    if (!form.date || !form.amount) return
    setSaving(true)
    const { error } = await supabase.from('expenses').insert({
      date:        form.date,
      description: form.description.trim() || null,
      paid_to:     form.paid_to.trim() || null,
      amount:      parseFloat(form.amount),
      category:    form.category,
    })
    setSaving(false)
    if (!error) {
      setForm({ date: '', description: '', paid_to: '', amount: '', category: 'Utilities' })
      setShowAdd(false)
      // Expand the month of the newly added expense
      const [y, m] = form.date.split('-')
      setExpandedMonths(prev => new Set([...prev, `${y}-${m}`]))
      onRefresh()
    }
  }

  async function handleDelete(id) {
    await supabase.from('expenses').delete().eq('id', id)
    setDeleteId(null)
    onRefresh()
  }

  async function handleCSV(e) {
    setCsvError(null)
    const file = e.target.files?.[0]
    if (!file) return
    const text = await file.text()
    const lines = text.trim().split('\n')
    if (lines.length < 2) { setCsvError('CSV is empty.'); return }
    const cols = lines[0].split(',').map(c => c.trim().toLowerCase().replace(/"/g, ''))
    const dateIdx   = cols.indexOf('date')
    const descIdx   = cols.indexOf('description')
    const amtIdx    = cols.indexOf('amount')
    const catIdx    = cols.indexOf('category')
    const paidToIdx = cols.findIndex(c => c === 'paid to' || c === 'paid_to' || c === 'payee')
    if (dateIdx < 0 || amtIdx < 0) {
      setCsvError('CSV must have at minimum "date" and "amount" columns.')
      return
    }
    const rows = []
    for (let i = 1; i < lines.length; i++) {
      const vals = lines[i].split(',').map(v => v.trim().replace(/"/g, ''))
      const row = {
        date:        vals[dateIdx] || '',
        description: descIdx   >= 0 ? (vals[descIdx]   || null) : null,
        paid_to:     paidToIdx >= 0 ? (vals[paidToIdx] || null) : null,
        amount:      parseFloat(vals[amtIdx]),
        category:    catIdx >= 0 ? (vals[catIdx] || 'Miscellaneous') : 'Miscellaneous',
      }
      if (!row.date || isNaN(row.amount)) continue
      rows.push(row)
    }
    if (rows.length === 0) { setCsvError('No valid rows found in CSV.'); return }
    const existing = new Set(expenses.map(e => `${e.date}|${e.description}|${e.amount}`))
    const toInsert = rows.filter(r => !existing.has(`${r.date}|${r.description}|${r.amount}`))
    if (toInsert.length === 0) {
      setCsvError('No new expenses to import — all rows already exist.')
      e.target.value = ''
      return
    }
    const { error } = await supabase.from('expenses').insert(toInsert)
    if (error) { setCsvError(error.message); return }
    e.target.value = ''
    onRefresh()
  }

  return (
    <div>
      {/* Controls */}
      <div className="flex items-center gap-2 mb-4">
        <select
          value={filterCategory}
          onChange={e => setFilterCategory(e.target.value)}
          className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white"
        >
          <option value="All">All Categories</option>
          {EXPENSE_CATEGORIES.map(c => <option key={c}>{c}</option>)}
        </select>
        <div className="flex-1" />
        <label className="text-sm text-blue-600 font-medium cursor-pointer hover:underline">
          Import CSV
          <input type="file" accept=".csv" className="sr-only" onChange={handleCSV} />
        </label>
        <button
          onClick={() => setShowAdd(v => !v)}
          className="text-sm bg-blue-600 text-white font-medium px-3 py-1.5 rounded-lg hover:bg-blue-700"
        >
          + Add
        </button>
      </div>

      {csvError && (
        <div className="mb-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {csvError}
        </div>
      )}

      {/* Add form */}
      {showAdd && (
        <div className="mb-4 bg-white border border-gray-200 rounded-xl p-4 space-y-3">
          <p className="text-sm font-semibold text-gray-800">New Expense</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Date</label>
              <input
                type="date"
                value={form.date}
                onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-1.5"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Amount ($)</label>
              <input
                type="number"
                step="0.01"
                placeholder="0.00"
                value={form.amount}
                onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-1.5"
              />
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Paid To</label>
            <input
              type="text"
              placeholder="e.g. Xfinity, Ocean Heart"
              value={form.paid_to}
              onChange={e => setForm(f => ({ ...f, paid_to: e.target.value }))}
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-1.5"
            />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Description <span className="text-gray-400 font-normal">(optional)</span></label>
            <input
              type="text"
              placeholder="e.g. Monthly internet service"
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-1.5"
            />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Category</label>
            <select
              value={form.category}
              onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white"
            >
              {EXPENSE_CATEGORIES.map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div className="flex gap-2 pt-1">
            <button
              onClick={handleAdd}
              disabled={saving || !form.date || !form.amount}
              className="text-sm bg-blue-600 text-white font-medium px-4 py-1.5 rounded-lg hover:bg-blue-700 disabled:opacity-40"
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
            <button onClick={() => setShowAdd(false)} className="text-sm text-gray-500 hover:text-gray-700">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Monthly grouped expense list */}
      {months.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-8">No expenses for {selectedYear}</p>
      ) : (
        <div className="space-y-2">
          {months.map(mk => {
            const monthExps = grouped[mk]
            const monthTotal = monthExps.reduce((s, e) => s + Number(e.amount || 0), 0)
            const isOpen = expandedMonths.has(mk)

            return (
              <div key={mk} className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                {/* Month header — tap to collapse/expand */}
                <button
                  onClick={() => toggleMonth(mk)}
                  className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-gray-900">{monthLabel(mk)}</span>
                    <span className="text-xs text-gray-400">{monthExps.length} item{monthExps.length !== 1 ? 's' : ''}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-semibold text-gray-700">{fmt(monthTotal)}</span>
                    <span className="text-gray-400 text-xs">{isOpen ? '▲' : '▼'}</span>
                  </div>
                </button>

                {/* Expense rows */}
                {isOpen && (
                  <div className="border-t border-gray-100">
                    {monthExps.map(exp => (
                      <div key={exp.id} className="flex items-start gap-3 px-4 py-2.5 border-b border-gray-50 last:border-b-0">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-gray-900 truncate">
                            {exp.description || exp.paid_to || '(no description)'}
                          </p>
                          <p className="text-xs text-gray-400 mt-0.5">
                            {fmtDate(exp.date)} · {exp.category}
                            {exp.paid_to ? ` · ${exp.paid_to}` : ''}
                          </p>
                        </div>
                        <span className="text-sm font-medium text-gray-800 shrink-0">{fmt(exp.amount)}</span>
                        {deleteId === exp.id ? (
                          <div className="flex items-center gap-2 shrink-0">
                            <button onClick={() => handleDelete(exp.id)} className="text-xs text-red-600 font-medium">Delete</button>
                            <button onClick={() => setDeleteId(null)} className="text-xs text-gray-400">Cancel</button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setDeleteId(exp.id)}
                            className="text-base leading-none text-gray-300 hover:text-red-400 shrink-0 transition-colors"
                          >
                            🗑
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Grand total */}
      {months.length > 0 && (
        <div className="mt-4 flex justify-between items-center px-4 py-3 bg-gray-100 rounded-xl">
          <span className="text-sm font-semibold text-gray-700">
            Total {filterCategory === 'All' ? '' : filterCategory + ' '}Expenses
          </span>
          <span className="text-sm font-bold text-gray-900">{fmt(grandTotal)}</span>
        </div>
      )}
    </div>
  )
}

// ─── OccupancyTaxTab ──────────────────────────────────────────────────────────

function OccupancyTaxTab({ weeks, selectedYear, taxPayments, onRefresh }) {
  const entries = getRenterEntries(weeks)
  const monthGroups = groupByMonth(entries, selectedYear)
  const months = Object.keys(monthGroups).sort()

  const [recordingMonth, setRecordingMonth] = useState(null)
  const [breakdownMonth, setBreakdownMonth] = useState(null)
  const [payForm, setPayForm] = useState({ amount: '', paid_date: '', notes: '' })
  const [saving, setSaving] = useState(false)

  function paymentForMonth(mk) {
    return taxPayments.find(p => p.period_month === mk + '-01')
  }

  function openRecord(mk) {
    const taxOwed = (monthGroups[mk] || []).reduce((s, e) => s + taxForEntry(e), 0)
    setPayForm({ amount: taxOwed.toFixed(2), paid_date: '', notes: '' })
    setRecordingMonth(mk)
  }

  async function handleRecordPayment() {
    if (!payForm.amount || !payForm.paid_date || !recordingMonth) return
    setSaving(true)
    const taxOwed = (monthGroups[recordingMonth] || []).reduce((s, e) => s + taxForEntry(e), 0)
    const { error } = await supabase.from('occupancy_tax_payments').upsert(
      {
        period_month: recordingMonth + '-01',
        amount_paid:  parseFloat(payForm.amount),
        paid_date:    payForm.paid_date,
        tax_owed:     taxOwed,
        notes:        payForm.notes || null,
      },
      { onConflict: 'period_month' }
    )
    setSaving(false)
    if (!error) {
      setRecordingMonth(null)
      setPayForm({ amount: '', paid_date: '', notes: '' })
      onRefresh()
    }
  }

  const totalTaxOwed = months.reduce((s, mk) => s + (monthGroups[mk] || []).reduce((s2, e) => s2 + taxForEntry(e), 0), 0)
  const totalPaid    = months.reduce((s, mk) => s + Number(paymentForMonth(mk)?.amount_paid || 0), 0)

  if (months.length === 0) {
    return <p className="text-sm text-gray-400 text-center py-8">No rentals found for {selectedYear}</p>
  }

  return (
    <div>
      {/* Month cards */}
      <div className="space-y-2 mb-4">
        {months.map(mk => {
          const monthEntries = monthGroups[mk] || []
          const taxOwed = monthEntries.reduce((s, e) => s + taxForEntry(e), 0)
          const payment = paymentForMonth(mk)

          return (
            <div key={mk} className="bg-white border border-gray-100 rounded-xl px-4 py-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-900">{monthLabel(mk)}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {monthEntries.length} rental{monthEntries.length !== 1 ? 's' : ''} · Tax owed {fmt(taxOwed)}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {payment ? (
                    <span className="text-xs text-green-700 bg-green-50 border border-green-100 rounded-full px-2.5 py-1 font-medium whitespace-nowrap">
                      ✓ Paid {fmtDate(payment.paid_date)}
                    </span>
                  ) : (
                    <button
                      onClick={() => openRecord(mk)}
                      className="text-xs text-blue-600 font-medium hover:underline whitespace-nowrap"
                    >
                      Record Payment
                    </button>
                  )}
                  <button
                    onClick={() => setBreakdownMonth(mk)}
                    className="text-xs text-gray-400 hover:text-gray-600 font-medium"
                  >
                    Details
                  </button>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Summary */}
      <div className="space-y-1">
        <div className="flex justify-between items-center px-4 py-3 bg-gray-100 rounded-xl">
          <span className="text-sm font-semibold text-gray-700">Total Tax Owed {selectedYear}</span>
          <span className="text-sm font-bold text-gray-900">{fmt(totalTaxOwed)}</span>
        </div>
        <div className="flex justify-between items-center px-4 py-2">
          <span className="text-sm text-gray-500">Total Paid</span>
          <span className="text-sm font-medium text-gray-700">{fmt(totalPaid)}</span>
        </div>
        {totalTaxOwed - totalPaid > 0.01 && (
          <div className="flex justify-between items-center px-4 py-2">
            <span className="text-sm text-red-600">Remaining</span>
            <span className="text-sm font-medium text-red-600">{fmt(totalTaxOwed - totalPaid)}</span>
          </div>
        )}
      </div>

      {/* Breakdown sheet */}
      {breakdownMonth && (
        <div
          className="fixed inset-0 z-50 bg-black/40 flex items-end justify-center"
          onClick={() => setBreakdownMonth(null)}
        >
          <div
            className="bg-white rounded-t-2xl w-full max-w-lg p-5 pb-10"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <p className="font-semibold text-gray-900">{monthLabel(breakdownMonth)} — Tax Breakdown</p>
              <button
                onClick={() => setBreakdownMonth(null)}
                className="text-gray-400 hover:text-gray-600 text-lg leading-none"
              >
                ✕
              </button>
            </div>
            <div className="space-y-3">
              {(monthGroups[breakdownMonth] || []).map((entry, i) => {
                const rent    = entry.totalRent || 0
                const taxable = rent / TAX_DIVISOR
                const tax     = rent - taxable
                return (
                  <div key={i}>
                    <div className="flex justify-between text-sm font-medium text-gray-800">
                      <span>{entry.name}</span>
                      <span>{fmt(tax)}</span>
                    </div>
                    <div className="flex justify-between text-xs text-gray-400 mt-0.5">
                      <span>Total rent {fmt(rent)}</span>
                      <span>Taxable {fmt(taxable)}</span>
                    </div>
                  </div>
                )
              })}
              <div className="pt-2 border-t border-gray-100 flex justify-between text-sm font-semibold text-gray-900">
                <span>Total Tax Owed</span>
                <span>{fmt((monthGroups[breakdownMonth] || []).reduce((s, e) => s + taxForEntry(e), 0))}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Record payment sheet */}
      {recordingMonth && (
        <div
          className="fixed inset-0 z-50 bg-black/40 flex items-end justify-center"
          onClick={() => setRecordingMonth(null)}
        >
          <div
            className="bg-white rounded-t-2xl w-full max-w-lg p-5 pb-10"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <p className="font-semibold text-gray-900">Record Payment — {monthLabel(recordingMonth)}</p>
              <button
                onClick={() => setRecordingMonth(null)}
                className="text-gray-400 hover:text-gray-600 text-lg leading-none"
              >
                ✕
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Amount Paid ($)</label>
                <input
                  type="number"
                  step="0.01"
                  value={payForm.amount}
                  onChange={e => setPayForm(f => ({ ...f, amount: e.target.value }))}
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Payment Date</label>
                <input
                  type="date"
                  value={payForm.paid_date}
                  onChange={e => setPayForm(f => ({ ...f, paid_date: e.target.value }))}
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Notes (optional)</label>
                <input
                  type="text"
                  placeholder="e.g. paid via MassTaxConnect"
                  value={payForm.notes}
                  onChange={e => setPayForm(f => ({ ...f, notes: e.target.value }))}
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2"
                />
              </div>
              <div className="flex gap-2 pt-1">
                <button
                  onClick={handleRecordPayment}
                  disabled={saving || !payForm.amount || !payForm.paid_date}
                  className="text-sm bg-blue-600 text-white font-medium px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-40"
                >
                  {saving ? 'Saving…' : 'Record Payment'}
                </button>
                <button
                  onClick={() => setRecordingMonth(null)}
                  className="text-sm text-gray-500 hover:text-gray-700"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── YearEndReportTab ──────────────────────────────────────────────────────────

function YearEndReportTab({ weeks, expenses, selectedYear, taxPayments }) {
  const allEntries = getRenterEntries(weeks)
  const yearEntries = allEntries.filter(e => {
    const end = e.renterInfo?.dates?.end || e.endDate
    if (!end) return false
    const d = end instanceof Date ? end : new Date(end)
    return d.getFullYear() === selectedYear
  })

  const yearExpenses = expenses.filter(e => {
    return e.date ? parseInt(e.date.split('-')[0]) === selectedYear : false
  })

  const revenueContracted = yearEntries.reduce((s, e) => s + (e.totalRent || 0), 0)
  const revenueCollected  = yearEntries.reduce((s, e) => {
    const paid1 = e.depositActual?.amount  || 0
    const paid2 = e.payment2Actual?.amount || 0
    const paid3 = e.finalActual?.amount    || 0
    return s + paid1 + paid2 + paid3
  }, 0)
  const outstandingBalance = revenueContracted - revenueCollected
  const totalTax      = yearEntries.reduce((s, e) => s + taxForEntry(e), 0)
  const totalExpenses = yearExpenses.reduce((s, e) => s + Number(e.amount || 0), 0)
  const netIncome     = revenueCollected - totalTax - totalExpenses

  // Expenses grouped by category
  const byCategory = {}
  for (const exp of yearExpenses) {
    const cat = exp.category || 'Other'
    byCategory[cat] = (byCategory[cat] || 0) + Number(exp.amount)
  }

  function exportCSV() {
    const rows = [
      ['Type', 'Description', 'Amount'],
      ['Income', 'Revenue Contracted', revenueContracted.toFixed(2)],
      ['Income', 'Revenue Collected', revenueCollected.toFixed(2)],
      ['Income', 'Outstanding Balance', outstandingBalance.toFixed(2)],
      ['Tax', 'Occupancy Tax', (-totalTax).toFixed(2)],
      ...Object.entries(byCategory).sort((a, b) => b[1] - a[1]).map(([cat, amt]) => (
        ['Expense', cat, (-amt).toFixed(2)]
      )),
      ['Net', 'Net Income', netIncome.toFixed(2)],
    ]
    const csv = rows.map(r => r.map(v => `"${v}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `cahoon-${selectedYear}-report.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div>
      <div className="flex justify-end mb-4">
        <button
          onClick={exportCSV}
          className="text-sm text-blue-600 font-medium hover:underline"
        >
          Export CSV
        </button>
      </div>

      {/* Income */}
      <div className="bg-white border border-gray-100 rounded-xl overflow-hidden mb-3">
        <div className="px-4 py-3 bg-gray-50 border-b border-gray-100">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">Rental Income</p>
        </div>
        {yearEntries.length === 0 ? (
          <p className="px-4 py-3 text-sm text-gray-400">No rentals for {selectedYear}</p>
        ) : (
          <>
            {yearEntries.map((e, i) => {
              const start = e.renterInfo?.dates?.start
              const end   = e.renterInfo?.dates?.end
              const collected = (e.depositActual?.amount || 0) + (e.payment2Actual?.amount || 0) + (e.finalActual?.amount || 0)
              return (
                <div key={i} className="px-4 py-2.5 border-b border-gray-50 last:border-b-0 flex justify-between items-baseline">
                  <div>
                    <p className="text-sm text-gray-800">{e.name}</p>
                    <p className="text-xs text-gray-400">
                      {start instanceof Date ? start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''}
                      {' – '}
                      {end instanceof Date ? end.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-gray-900">{fmt(e.totalRent)}</p>
                    {collected < (e.totalRent || 0) && (
                      <p className="text-xs text-gray-400">{fmt(collected)} collected</p>
                    )}
                  </div>
                </div>
              )
            })}
            <div className="border-t border-gray-100">
              <div className="px-4 py-2.5 flex justify-between items-baseline">
                <span className="text-sm text-gray-600">Revenue Contracted</span>
                <span className="text-sm font-medium text-gray-900">{fmt(revenueContracted)}</span>
              </div>
              <div className="px-4 py-2.5 flex justify-between items-baseline">
                <span className="text-sm text-gray-600">Revenue Collected</span>
                <span className="text-sm font-medium text-gray-900">{fmt(revenueCollected)}</span>
              </div>
              {outstandingBalance > 0.01 && (
                <div className="px-4 py-2.5 flex justify-between items-baseline">
                  <span className="text-sm text-red-600">Outstanding Balance</span>
                  <span className="text-sm font-medium text-red-600">{fmt(outstandingBalance)}</span>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Occupancy Tax */}
      <div className="bg-white border border-gray-100 rounded-xl overflow-hidden mb-3">
        <div className="px-4 py-3 bg-gray-50 border-b border-gray-100 flex justify-between items-center">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">Occupancy Tax</p>
          <span className="text-sm font-bold text-gray-900">{fmt(totalTax)}</span>
        </div>
        <p className="px-4 py-2.5 text-xs text-gray-400">
          {((1 - 1 / TAX_DIVISOR) * 100).toFixed(2)}% of gross rent (taxable = rent ÷ {TAX_DIVISOR})
        </p>
      </div>

      {/* Expenses by category */}
      <div className="bg-white border border-gray-100 rounded-xl overflow-hidden mb-3">
        <div className="px-4 py-3 bg-gray-50 border-b border-gray-100">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">Expenses by Category</p>
        </div>
        {Object.keys(byCategory).length === 0 ? (
          <p className="px-4 py-3 text-sm text-gray-400">No expenses for {selectedYear}</p>
        ) : (
          <>
            {Object.entries(byCategory).sort((a, b) => b[1] - a[1]).map(([cat, amt]) => (
              <div key={cat} className="px-4 py-2.5 border-b border-gray-50 last:border-b-0 flex justify-between">
                <span className="text-sm text-gray-800">{cat}</span>
                <span className="text-sm font-medium text-gray-900">{fmt(amt)}</span>
              </div>
            ))}
            <div className="px-4 py-3 bg-gray-50 border-t border-gray-100 flex justify-between">
              <span className="text-sm font-semibold text-gray-700">Total Expenses</span>
              <span className="text-sm font-bold text-gray-900">{fmt(totalExpenses)}</span>
            </div>
          </>
        )}
      </div>

      {/* Net Income */}
      <div className={`rounded-xl px-4 py-4 flex justify-between items-center ${netIncome >= 0 ? 'bg-green-50 border border-green-100' : 'bg-red-50 border border-red-100'}`}>
        <span className={`text-sm font-bold ${netIncome >= 0 ? 'text-green-800' : 'text-red-800'}`}>
          Net Income {selectedYear}
        </span>
        <span className={`text-base font-bold ${netIncome >= 0 ? 'text-green-900' : 'text-red-900'}`}>
          {fmt(netIncome)}
        </span>
      </div>
    </div>
  )
}

// ─── FinancialsScreen ──────────────────────────────────────────────────────────

export default function FinancialsScreen({ onClose, weeks, expenses, taxPayments, onRefreshFinancials }) {
  const [visible, setVisible] = useState(false)
  const [activeTab, setActiveTab] = useState('expenses')

  // Derive available years from rentals and expenses
  const years = [...new Set([
    ...getRenterEntries(weeks).map(e => {
      const d = e.renterInfo?.dates?.end || e.endDate
      return d instanceof Date ? d.getFullYear() : (d ? new Date(d).getFullYear() : null)
    }).filter(Boolean),
    ...expenses.map(e => e.date ? parseInt(e.date.split('-')[0]) : null).filter(Boolean),
  ])].sort((a, b) => b - a)

  const [selectedYear, setSelectedYear] = useState(() => {
    if (years.length > 0) return years[0]
    return new Date().getFullYear()
  })

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true))
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  const handleClose = () => {
    setVisible(false)
    setTimeout(onClose, 250)
  }

  const TABS = [
    { id: 'expenses', label: 'Expenses' },
    { id: 'tax',      label: 'Occupancy Tax' },
    { id: 'report',   label: 'Year-End Report' },
  ]

  return (
    <div
      className="fixed inset-0 z-50 bg-white flex flex-col"
      style={{
        transform: visible ? 'translateX(0)' : 'translateX(100%)',
        transition: 'transform 0.25s ease-out',
        paddingTop: 'env(safe-area-inset-top)',
      }}
    >
      {/* Header */}
      <header className="bg-white border-b border-gray-100 shadow-sm flex-shrink-0">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <button
            onClick={handleClose}
            className="text-blue-600 font-medium text-sm hover:text-blue-800 transition-colors"
          >
            ← Back
          </button>
          <h2 className="text-base font-semibold text-gray-900 flex-1">Financials</h2>
          <select
            value={selectedYear}
            onChange={e => setSelectedYear(Number(e.target.value))}
            className="text-sm border border-gray-200 rounded-lg px-2 py-1.5 bg-white"
          >
            {(years.length > 0 ? years : [new Date().getFullYear()]).map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>

        {/* Tab bar */}
        <div className="max-w-2xl mx-auto px-4 flex border-t border-gray-100">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`text-sm font-medium px-3 py-2.5 border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </header>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-4 py-4 pb-10">
          {activeTab === 'expenses' && (
            <ExpensesTab
              expenses={expenses}
              selectedYear={selectedYear}
              onRefresh={onRefreshFinancials}
            />
          )}
          {activeTab === 'tax' && (
            <OccupancyTaxTab
              weeks={weeks}
              selectedYear={selectedYear}
              taxPayments={taxPayments}
              onRefresh={onRefreshFinancials}
            />
          )}
          {activeTab === 'report' && (
            <YearEndReportTab
              weeks={weeks}
              expenses={expenses}
              selectedYear={selectedYear}
              taxPayments={taxPayments}
            />
          )}
        </div>
      </div>
    </div>
  )
}
