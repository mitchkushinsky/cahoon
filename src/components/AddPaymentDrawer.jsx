import { useState } from 'react'
import { supabase } from '../lib/supabase'

const METHODS = ['Venmo', 'Zelle', 'Paypal', 'Check']

function todayISO() {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export default function AddPaymentDrawer({ renterKey, milestone, milestoneNumber, onSave, onClose, isDemo, onDemoWrite }) {
  const [amount, setAmount] = useState(String(milestone.amountOwed || ''))
  const [date, setDate] = useState(todayISO())
  const [method, setMethod] = useState(METHODS[0])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const save = async () => {
    const amt = parseFloat(amount)
    if (!amt || isNaN(amt) || amt <= 0) { setError('Enter a valid amount'); return }
    if (isDemo) { onDemoWrite(); return }
    setSaving(true)
    setError(null)
    const { error: err } = await supabase.from('payment_records').upsert(
      { renter_key: renterKey, payment_number: milestoneNumber, amount: amt, date, method },
      { onConflict: 'renter_key,payment_number' }
    )
    setSaving(false)
    if (err) { setError(err.message); return }
    onSave()
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 flex items-end justify-center"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-white rounded-t-2xl w-full max-w-lg p-5 pb-10 space-y-4 shadow-2xl">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-gray-900">Record Payment</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none p-1">×</button>
        </div>

        <div className="bg-blue-50 rounded-xl px-4 py-2.5">
          <p className="text-xs text-blue-400 font-medium mb-0.5">Recording</p>
          <p className="text-sm font-semibold text-blue-900">
            Payment {milestoneNumber} — {milestone.label}
            <span className="font-normal text-blue-500 ml-1.5">({milestone.dueDateLabel})</span>
          </p>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-xs font-semibold text-gray-500 block mb-1">Amount</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
              <input
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                className="w-full border border-gray-200 rounded-xl pl-7 pr-3 py-2.5 text-sm focus:outline-none focus:border-blue-400"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-500 block mb-1">Date Received</label>
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-blue-400"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-500 block mb-1">Method</label>
            <select
              value={method}
              onChange={e => setMethod(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-blue-400 bg-white"
            >
              {METHODS.map(m => <option key={m}>{m}</option>)}
            </select>
          </div>
        </div>

        {error && <p className="text-xs text-red-600">{error}</p>}

        <div className="flex gap-3 pt-1">
          <button
            onClick={onClose}
            className="flex-1 text-sm font-medium border border-gray-200 text-gray-600 rounded-xl py-2.5 hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={save}
            disabled={saving}
            className="flex-1 text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-xl py-2.5 disabled:opacity-50 transition-colors"
          >
            {saving ? 'Saving…' : 'Save Payment'}
          </button>
        </div>
      </div>
    </div>
  )
}
