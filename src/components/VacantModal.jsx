import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { toISODate } from '../lib/parseCSV'
import AppointmentList from './AppointmentList'
import CaretakerNotes from './CaretakerNotes'

// ─── AssignRenterForm ─────────────────────────────────────────────────────────

function addDays(date, n) {
  const d = new Date(date)
  d.setDate(d.getDate() + n)
  return d
}

function AssignRenterForm({ weekStart, onSaved, onCancel, isDemo, onDemoWrite }) {
  const [renters, setRenters] = useState([])
  const [search, setSearch] = useState('')
  const [showDropdown, setShowDropdown] = useState(false)
  const [selectedRenter, setSelectedRenter] = useState(null) // null = add new
  const [addingNew, setAddingNew] = useState(false)
  const [newName, setNewName] = useState('')
  const [newEmail, setNewEmail] = useState('')

  const defaultStart = toISODate(weekStart)
  const defaultEnd   = toISODate(addDays(weekStart, 7))
  const [startDate, setStartDate] = useState(defaultStart)
  const [endDate, setEndDate]     = useState(defaultEnd)
  const [totalRent, setTotalRent]   = useState('')
  const [leaseStatus, setLeaseStatus] = useState('')
  const [leaseUrl, setLeaseUrl]     = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    supabase.from('renters').select('*').is('archived_at', null).order('name').then(({ data }) => {
      setRenters(data || [])
    })
  }, [])

  const filtered = renters.filter(r => {
    const q = search.toLowerCase()
    return r.name.toLowerCase().includes(q) || (r.email || '').toLowerCase().includes(q)
  })

  const pickRenter = (r) => {
    setSelectedRenter(r)
    setSearch(r.name)
    setShowDropdown(false)
    setAddingNew(false)
  }

  const pickAddNew = () => {
    setSelectedRenter(null)
    setAddingNew(true)
    setSearch('')
    setShowDropdown(false)
  }

  const handleSave = async () => {
    if (!startDate || !endDate) return
    if (isDemo) { onDemoWrite(); return }
    setSaving(true)
    setError(null)

    try {
      let renterId

      if (addingNew) {
        if (!newName.trim()) { setError('Name is required'); setSaving(false); return }
        const { data: created, error: rErr } = await supabase
          .from('renters')
          .insert({ name: newName.trim(), email: newEmail.trim() || null })
          .select('id').single()
        if (rErr) throw new Error(rErr.message)
        renterId = created.id
      } else if (selectedRenter) {
        renterId = selectedRenter.id
      } else {
        setError('Select a renter or add a new one')
        setSaving(false)
        return
      }

      const rent = Number(totalRent) || 0
      const deposit   = rent > 0 ? 500 : 0
      const payment2  = rent > 0 ? (rent - deposit) / 2 : 0
      const payment3  = rent > 0 ? rent - deposit - payment2 : 0

      const year = new Date(startDate).getFullYear()
      const { error: rnErr } = await supabase.from('rentals').insert({
        renter_id:    renterId,
        season_year:  year,
        start_date:   startDate,
        end_date:     endDate,
        total_rent:   rent || null,
        lease_status: leaseStatus.trim() || null,
        lease_url:    leaseUrl.trim() || null,
        payment1_owed: deposit || null,
        payment2_owed: payment2 || null,
        payment3_owed: payment3 || null,
        source:       'manual',
      })
      if (rnErr) throw new Error(rnErr.message)

      onSaved()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-3 border border-blue-200 rounded-xl p-4 bg-blue-50">
      <p className="text-sm font-medium text-blue-800">Assign Renter</p>

      {/* Renter picker */}
      {!addingNew ? (
        <div className="relative">
          <input
            type="text"
            placeholder="Search renters…"
            value={search}
            onChange={e => { setSearch(e.target.value); setShowDropdown(true); setSelectedRenter(null) }}
            onFocus={() => setShowDropdown(true)}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400 bg-white"
          />
          {showDropdown && (
            <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
              {filtered.map(r => (
                <button
                  key={r.id}
                  onMouseDown={() => pickRenter(r)}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 transition-colors"
                >
                  <span className="font-medium text-gray-900">{r.name}</span>
                  {r.email && <span className="text-gray-400 ml-2 text-xs">{r.email}</span>}
                </button>
              ))}
              <button
                onMouseDown={pickAddNew}
                className="w-full text-left px-3 py-2 text-sm text-blue-600 font-medium hover:bg-blue-50 border-t border-gray-100 transition-colors"
              >
                + Add New Renter
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-xs text-blue-700 font-medium">New Renter</p>
          <input
            type="text"
            placeholder="Name (required)"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400 bg-white"
          />
          <input
            type="email"
            placeholder="Email (optional)"
            value={newEmail}
            onChange={e => setNewEmail(e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400 bg-white"
          />
          <button
            onClick={() => setAddingNew(false)}
            className="text-xs text-gray-500 hover:underline"
          >
            ← Back to search
          </button>
        </div>
      )}

      {/* Dates */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Start Date</label>
          <input
            type="date"
            value={startDate}
            onChange={e => setStartDate(e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400 bg-white"
          />
        </div>
        <div>
          <label className="text-xs text-gray-500 mb-1 block">End Date</label>
          <input
            type="date"
            value={endDate}
            onChange={e => setEndDate(e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400 bg-white"
          />
        </div>
      </div>

      {/* Total Rent + Lease Status + Lease URL */}
      <input
        type="number"
        placeholder="Total Rent"
        value={totalRent}
        onChange={e => setTotalRent(e.target.value)}
        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400 bg-white"
      />
      <input
        type="text"
        placeholder="Lease Status"
        value={leaseStatus}
        onChange={e => setLeaseStatus(e.target.value)}
        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400 bg-white"
      />
      <div>
        <label className="text-xs text-gray-500 mb-1 block">Lease URL (Google Drive link)</label>
        <input
          type="text"
          placeholder="https://drive.google.com/…"
          value={leaseUrl}
          onChange={e => setLeaseUrl(e.target.value)}
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400 bg-white"
        />
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}

      <div className="flex gap-2">
        <button
          onClick={onCancel}
          className="flex-1 py-2 rounded-lg text-sm text-gray-500 border border-gray-200 bg-white hover:bg-gray-50 transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex-1 py-2 rounded-lg text-sm font-medium bg-blue-600 text-white disabled:opacity-40 hover:bg-blue-700 transition-colors"
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
    </div>
  )
}

// ─── VacantModal ──────────────────────────────────────────────────────────────

export default function VacantModal({ week, appointments, caretakerNote, isAdmin, onClose, onRefresh, isDemo, onDemoWrite }) {
  const { weekStart } = week
  const [action, setAction] = useState(null) // null | 'owner' | 'assign'
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  const weekAppts = appointments.filter(a => a.week_start === toISODate(weekStart))

  const saveOwnerUse = async () => {
    if (isDemo) { onDemoWrite(); return }
    setSaving(true)
    await supabase.from('owner_use').upsert(
      { week_start: toISODate(weekStart), notes: notes.trim() || null },
      { onConflict: 'week_start' }
    )
    setSaving(false)
    onRefresh()
    onClose()
  }

  return (
    <div className="p-5 space-y-5 pb-8">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-gray-900">Vacant Week</h2>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none p-1">×</button>
      </div>

      {isAdmin && (
        <>
          {action === null && (
            <div className="space-y-2">
              <button
                onClick={() => setAction('owner')}
                className="w-full py-3 rounded-xl bg-blue-50 border border-blue-200 text-blue-700 font-medium text-sm hover:bg-blue-100 transition-colors"
              >
                🏠 Mark as Owner Use
              </button>
              <button
                onClick={() => setAction('assign')}
                className="w-full py-3 rounded-xl bg-green-50 border border-green-200 text-green-700 font-medium text-sm hover:bg-green-100 transition-colors"
              >
                👤 Assign Renter
              </button>
            </div>
          )}

          {action === 'owner' && (
            <div className="space-y-3 border border-blue-200 rounded-xl p-4 bg-blue-50">
              <p className="text-sm font-medium text-blue-800">Mark as Owner Use</p>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                rows={3}
                placeholder="Notes (optional)"
                className="w-full border border-blue-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400 resize-none bg-white"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => setAction(null)}
                  className="flex-1 py-2 rounded-lg text-sm text-gray-500 border border-gray-200 bg-white hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={saveOwnerUse}
                  disabled={saving}
                  className="flex-1 py-2 rounded-lg text-sm font-medium bg-blue-600 text-white disabled:opacity-40 hover:bg-blue-700 transition-colors"
                >
                  {saving ? 'Saving…' : 'Confirm'}
                </button>
              </div>
            </div>
          )}

          {action === 'assign' && (
            <AssignRenterForm
              weekStart={weekStart}
              onSaved={() => { onRefresh(); onClose() }}
              onCancel={() => setAction(null)}
              isDemo={isDemo}
              onDemoWrite={onDemoWrite}
            />
          )}
        </>
      )}

      <CaretakerNotes weekStart={weekStart} caretakerNote={caretakerNote} isAdmin={isAdmin} onRefresh={onRefresh} isDemo={isDemo} onDemoWrite={onDemoWrite} />

      <AppointmentList appointments={weekAppts} weekStart={weekStart} onRefresh={onRefresh} isAdmin={isAdmin} isDemo={isDemo} onDemoWrite={onDemoWrite} />
    </div>
  )
}
