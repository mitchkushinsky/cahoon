import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { parseCSVEntries, toISODate } from '../lib/parseCSV'
import { migrate2026 } from '../lib/migrate2026'

// ─── Helpers ─────────────────────────────────────────────────────────────────

const SEASON_YEARS = [2022, 2023, 2024, 2025, 2026, 2027]

function fmtDate(isoStr) {
  if (!isoStr) return ''
  const [y, m, d] = isoStr.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function fmtMoney(n) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n ?? 0)
}

async function upsertRenterAndRental(entry, seasonYear, existingRentalId = null) {
  const email = (entry.email || '').toLowerCase().trim()
  let renterId

  if (email) {
    const { data: existing } = await supabase
      .from('renters').select('id').eq('email', email).maybeSingle()
    if (existing) {
      renterId = existing.id
    } else {
      const { data: created, error } = await supabase
        .from('renters')
        .insert({ name: entry.name, email, first_year_rented: seasonYear })
        .select('id').single()
      if (error) throw new Error(`Renter "${entry.name}": ${error.message}`)
      renterId = created.id
    }
  } else {
    const { data: created, error } = await supabase
      .from('renters')
      .insert({ name: entry.name, first_year_rented: seasonYear })
      .select('id').single()
    if (error) throw new Error(`Renter "${entry.name}": ${error.message}`)
    renterId = created.id
  }

  const row = {
    renter_id:       renterId,
    season_year:     seasonYear,
    start_date:      toISODate(entry.startDate),
    end_date:        toISODate(entry.endDate),
    total_rent:      entry.totalRent   || null,
    deposit_owed:    entry.depositOwed || null,
    lease_status:    entry.leaseStatus || null,
    balance_due:     entry.balanceDue  || null,
    payment1_owed:   entry.depositOwed   || null,
    payment1_amount: entry.depositActual?.amount  || null,
    payment1_date:   entry.depositActual?.date  ? toISODate(entry.depositActual.date)  : null,
    payment1_method: entry.depositActual?.method  || null,
    payment2_owed:   entry.payment2Owed  || null,
    payment2_amount: entry.payment2Actual?.amount || null,
    payment2_date:   entry.payment2Actual?.date ? toISODate(entry.payment2Actual.date) : null,
    payment2_method: entry.payment2Actual?.method || null,
    payment3_owed:   entry.finalOwed     || null,
    payment3_amount: entry.finalActual?.amount   || null,
    payment3_date:   entry.finalActual?.date   ? toISODate(entry.finalActual.date)   : null,
    payment3_method: entry.finalActual?.method   || null,
    lease_url:        entry.leaseUrl       || null,
    smart_lock_combo: entry.smartLockCombo || null,
    source:           'csv',
  }

  if (existingRentalId) {
    const { error } = await supabase.from('rentals').update(row).eq('id', existingRentalId)
    if (error) throw new Error(error.message)
  } else {
    const { error } = await supabase.from('rentals').insert(row)
    if (error) throw new Error(error.message)
  }
}

// ─── RentersTab ───────────────────────────────────────────────────────────────

function RenterForm({ initial = {}, onSave, onCancel, saving }) {
  const [name, setName]           = useState(initial.name || '')
  const [email, setEmail]         = useState(initial.email || '')
  const [firstYear, setFirstYear] = useState(initial.first_year_rented || '')

  return (
    <div className="border border-blue-200 rounded-xl p-4 space-y-3 bg-blue-50">
      <input
        type="text"
        placeholder="Name (required)"
        value={name}
        onChange={e => setName(e.target.value)}
        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400 bg-white"
      />
      <input
        type="email"
        placeholder="Email"
        value={email}
        onChange={e => setEmail(e.target.value)}
        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400 bg-white"
      />
      <input
        type="number"
        placeholder="First Year Rented"
        value={firstYear}
        onChange={e => setFirstYear(e.target.value)}
        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400 bg-white"
      />
      <div className="flex gap-2">
        <button
          onClick={onCancel}
          className="flex-1 py-2 rounded-lg text-sm text-gray-500 border border-gray-200 bg-white hover:bg-gray-50 transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={() => onSave({ name: name.trim(), email: email.trim() || null, first_year_rented: firstYear ? Number(firstYear) : null })}
          disabled={!name.trim() || saving}
          className="flex-1 py-2 rounded-lg text-sm font-medium bg-blue-600 text-white disabled:opacity-40 hover:bg-blue-700 transition-colors"
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
    </div>
  )
}

function RenterRow({ renter, onSelect, onUpdated, onDeleted }) {
  const [checkingDelete, setChecking]     = useState(false)
  const [deleteError, setDeleteError]     = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [confirmArchive, setConfirmArchive] = useState(false)
  const [acting, setActing]               = useState(false)

  const isArchived = !!renter.archived_at

  const handleTrashClick = async (e) => {
    e.stopPropagation()
    setDeleteError(null)
    setConfirmDelete(false)
    setConfirmArchive(false)
    setChecking(true)
    try {
      const today = new Date().toISOString().split('T')[0]
      const { data: futureRentals } = await supabase
        .from('rentals').select('id').eq('renter_id', renter.id).gte('end_date', today).limit(1)
      if (futureRentals?.length > 0) {
        setDeleteError('This renter has an upcoming rental and cannot be deleted.')
        return
      }
      const { data: anyRentals } = await supabase
        .from('rentals').select('id').eq('renter_id', renter.id).limit(1)
      if (anyRentals?.length > 0) {
        setConfirmArchive(true)
      } else {
        setConfirmDelete(true)
      }
    } finally {
      setChecking(false)
    }
  }

  const handleArchive = async () => {
    setActing(true)
    await supabase.from('renters').update({ archived_at: new Date().toISOString() }).eq('id', renter.id)
    setActing(false)
    onDeleted()
  }

  const handleDelete = async () => {
    setActing(true)
    await supabase.from('renters').delete().eq('id', renter.id)
    setActing(false)
    onDeleted()
  }

  const handleRestore = async (e) => {
    e.stopPropagation()
    setActing(true)
    await supabase.from('renters').update({ archived_at: null }).eq('id', renter.id)
    setActing(false)
    onUpdated()
  }

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden">
      <div
        className={`flex items-center px-4 py-3 gap-3 ${!isArchived ? 'cursor-pointer hover:bg-gray-50' : ''} transition-colors`}
        onClick={() => !isArchived && onSelect(renter, false)}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-medium text-gray-900">{renter.name}</p>
            {isArchived && (
              <span className="text-xs font-medium bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">Archived</span>
            )}
          </div>
          <p className="text-xs text-gray-400 mt-0.5">
            {renter.email || 'No email'}
            {renter.first_year_rented ? ` · Since ${renter.first_year_rented}` : ''}
          </p>
        </div>

        {isArchived ? (
          <button
            onClick={handleRestore}
            disabled={acting}
            className="text-xs font-medium text-blue-600 border border-blue-200 rounded-lg px-3 py-1.5 hover:bg-blue-50 transition-colors disabled:opacity-40 flex-shrink-0"
          >
            {acting ? '…' : 'Restore'}
          </button>
        ) : (
          <div className="flex items-center gap-0.5 flex-shrink-0" onClick={e => e.stopPropagation()}>
            <button
              onClick={() => onSelect(renter, true)}
              className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
              title="Edit renter"
            >
              ✏️
            </button>
            <button
              onClick={handleTrashClick}
              disabled={checkingDelete}
              className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-40"
              title="Delete renter"
            >
              🗑️
            </button>
          </div>
        )}
      </div>

      {deleteError && (
        <div className="border-t border-red-100 px-4 pb-4 pt-3 bg-red-50 space-y-2">
          <p className="text-sm text-red-700">{deleteError}</p>
          <button onClick={() => setDeleteError(null)} className="text-xs text-gray-500 hover:underline">Dismiss</button>
        </div>
      )}

      {confirmArchive && (
        <div className="border-t border-amber-100 px-4 pb-4 pt-3 bg-amber-50 space-y-3">
          <p className="text-sm text-amber-800">This renter has past rental records. Archive them instead of deleting?</p>
          <div className="flex gap-2">
            <button
              onClick={() => setConfirmArchive(false)}
              className="flex-1 py-2 rounded-lg text-sm border border-gray-200 bg-white text-gray-500 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleArchive}
              disabled={acting}
              className="flex-1 py-2 rounded-lg text-sm font-medium bg-amber-600 text-white disabled:opacity-40 hover:bg-amber-700 transition-colors"
            >
              {acting ? 'Archiving…' : 'Archive'}
            </button>
          </div>
        </div>
      )}

      {confirmDelete && (
        <div className="border-t border-red-100 px-4 pb-4 pt-3 bg-red-50 space-y-3">
          <p className="text-sm text-red-800">Delete {renter.name} permanently? This cannot be undone.</p>
          <div className="flex gap-2">
            <button
              onClick={() => setConfirmDelete(false)}
              className="flex-1 py-2 rounded-lg text-sm border border-gray-200 bg-white text-gray-500 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleDelete}
              disabled={acting}
              className="flex-1 py-2 rounded-lg text-sm font-medium bg-red-600 text-white disabled:opacity-40 hover:bg-red-700 transition-colors"
            >
              {acting ? 'Deleting…' : 'Delete'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function RenterProfile({ renter: initialRenter, startInEditMode, onBack, onUpdated }) {
  const [renter, setRenter]               = useState(initialRenter)
  const [rentals, setRentals]             = useState([])
  const [comments, setComments]           = useState({})
  const [loading, setLoading]             = useState(true)
  const [editing, setEditing]             = useState(startInEditMode || false)
  const [saving, setSaving]               = useState(false)
  const [notes, setNotes]                 = useState(initialRenter.notes || '')
  const [notesSaved, setNotesSaved]       = useState(false)
  const [expandedYears, setExpandedYears] = useState(new Set())

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      const { data: rd } = await supabase
        .from('rentals')
        .select('*')
        .eq('renter_id', renter.id)
        .order('season_year', { ascending: false })
      if (cancelled) return
      const rows = rd || []
      const startDates = rows.map(r => r.start_date).filter(Boolean)
      let commentMap = {}
      if (startDates.length > 0) {
        const { data: cd } = await supabase
          .from('comment_overrides')
          .select('week_start, comment')
          .in('week_start', startDates)
        for (const c of (cd || [])) {
          if (c.comment) commentMap[c.week_start] = c.comment
        }
      }
      if (!cancelled) { setRentals(rows); setComments(commentMap); setLoading(false) }
    }
    load()
    return () => { cancelled = true }
  }, [renter.id])

  const handleEditSave = async (fields) => {
    setSaving(true)
    await supabase.from('renters').update(fields).eq('id', renter.id)
    const updated = { ...renter, ...fields }
    setRenter(updated)
    setSaving(false)
    setEditing(false)
    onUpdated(updated)
  }

  const saveNotes = async () => {
    const trimmed = notes.trim() || null
    await supabase.from('renters').update({ notes: trimmed }).eq('id', renter.id)
    setNotesSaved(true)
    setTimeout(() => setNotesSaved(false), 2000)
    onUpdated({ ...renter, notes: trimmed })
  }

  const toggleYear = year => setExpandedYears(prev => {
    const next = new Set(prev)
    next.has(year) ? next.delete(year) : next.add(year)
    return next
  })

  const rentalsByYear = {}
  for (const r of rentals) {
    if (!rentalsByYear[r.season_year]) rentalsByYear[r.season_year] = []
    rentalsByYear[r.season_year].push(r)
  }
  const yearsWithComments = Object.entries(rentalsByYear)
    .filter(([, rs]) => rs.some(r => comments[r.start_date]))
    .map(([y]) => Number(y))
    .sort((a, b) => b - a)

  const totalRent   = rentals.reduce((s, r) => s + Number(r.total_rent || 0), 0)
  const seasonCount = new Set(rentals.map(r => r.season_year)).size

  return (
    <div className="px-4 py-4 space-y-6">
      <button onClick={onBack} className="text-blue-600 text-sm font-medium hover:text-blue-800 flex items-center gap-1">
        ← All Renters
      </button>

      {editing ? (
        <RenterForm initial={renter} onSave={handleEditSave} onCancel={() => setEditing(false)} saving={saving} />
      ) : (
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 leading-tight">{renter.name}</h2>
            {renter.email && (
              <a href={`mailto:${renter.email}`} className="text-sm text-blue-600 hover:underline block mt-0.5">
                {renter.email}
              </a>
            )}
            {renter.first_year_rented && (
              <p className="text-sm text-gray-500 mt-0.5">Since {renter.first_year_rented}</p>
            )}
          </div>
          <button
            onClick={() => setEditing(true)}
            className="text-gray-400 hover:text-blue-600 p-1.5 rounded-lg hover:bg-blue-50 transition-colors flex-shrink-0 mt-1"
          >
            ✏️
          </button>
        </div>
      )}

      {/* Rental History */}
      <div>
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Rental History</h3>
        {loading ? (
          <div className="flex justify-center py-4">
            <div className="w-5 h-5 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
          </div>
        ) : rentals.length === 0 ? (
          <p className="text-sm text-gray-400">No rental history found.</p>
        ) : (
          <div className="bg-gray-50 rounded-xl overflow-hidden">
            {rentals.map((r, i) => (
              <div key={r.id} className={`flex items-center gap-3 px-4 py-2.5 text-sm ${i > 0 ? 'border-t border-gray-100' : ''}`}>
                <span className="text-gray-400 w-10 flex-shrink-0">{r.season_year}</span>
                <span className="flex-1 text-gray-700">
                  {r.start_date && r.end_date ? `${fmtDate(r.start_date)} – ${fmtDate(r.end_date)}` : '—'}
                </span>
                <span className="font-medium text-gray-900">{r.total_rent ? fmtMoney(r.total_rent) : '—'}</span>
              </div>
            ))}
            <div className="border-t border-gray-200 px-4 py-2.5 flex items-center justify-between text-sm bg-white">
              <span className="text-gray-500">{seasonCount} season{seasonCount !== 1 ? 's' : ''}</span>
              <span className="font-semibold text-gray-900">{fmtMoney(totalRent)} total rent</span>
            </div>
          </div>
        )}
      </div>

      {/* Per-Year Comments */}
      {!loading && yearsWithComments.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Notes by Year</h3>
          <div className="space-y-1.5">
            {yearsWithComments.map(year => {
              const comment = (rentalsByYear[year] || []).map(r => comments[r.start_date]).find(Boolean) || ''
              const isExpanded = expandedYears.has(year)
              return (
                <div key={year} className="border border-gray-200 rounded-xl overflow-hidden">
                  <button
                    onClick={() => toggleYear(year)}
                    className="w-full flex items-center gap-2 px-3 py-2.5 text-left hover:bg-gray-50 transition-colors"
                  >
                    <span className="text-xs text-gray-400 w-3 flex-shrink-0">{isExpanded ? '▼' : '▶'}</span>
                    <span className="text-sm font-medium text-gray-800 flex-shrink-0 w-12">{year}</span>
                    {!isExpanded && <span className="text-sm text-gray-400 truncate">— "{comment}"</span>}
                  </button>
                  {isExpanded && (
                    <div className="px-3 pb-3">
                      <p className="text-sm text-gray-700 bg-gray-50 rounded-lg px-3 py-2">{comment}</p>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Renter Notes */}
      <div>
        <h3 className="text-sm font-semibold text-gray-700 mb-2">Renter Notes</h3>
        <textarea
          value={notes}
          onChange={e => { setNotes(e.target.value); setNotesSaved(false) }}
          rows={3}
          placeholder="Notes about this renter across all seasons…"
          className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-400 resize-none"
        />
        <button onClick={saveNotes} className="text-sm font-medium text-blue-600 hover:underline mt-1">
          {notesSaved ? '✓ Saved' : 'Save Notes'}
        </button>
      </div>
    </div>
  )
}

function RentersTab() {
  const [renters, setRenters]           = useState([])
  const [loading, setLoading]           = useState(true)
  const [adding, setAdding]             = useState(false)
  const [saving, setSaving]             = useState(false)
  const [showArchived, setShowArchived] = useState(false)
  const [selected, setSelected]         = useState(null) // { renter, editMode }

  const load = async (archived) => {
    setLoading(true)
    let query = supabase.from('renters').select('*').order('name')
    if (!archived) query = query.is('archived_at', null)
    const { data } = await query
    setRenters(data || [])
    setLoading(false)
  }

  useEffect(() => { load(showArchived) }, [showArchived])

  const handleAdd = async (fields) => {
    setSaving(true)
    await supabase.from('renters').insert(fields)
    setSaving(false)
    setAdding(false)
    load(showArchived)
  }

  const handleUpdated = (updatedRenter) => {
    load(showArchived)
    if (selected && updatedRenter) {
      setSelected(prev => ({ ...prev, renter: updatedRenter }))
    }
  }

  if (selected) {
    return (
      <RenterProfile
        renter={selected.renter}
        startInEditMode={selected.editMode}
        onBack={() => setSelected(null)}
        onUpdated={handleUpdated}
      />
    )
  }

  const activeRenters   = renters.filter(r => !r.archived_at)
  const archivedRenters = renters.filter(r => r.archived_at)

  return (
    <div className="px-4 py-4 space-y-3">
      <div className="flex items-center justify-end">
        <button
          onClick={() => setShowArchived(v => !v)}
          className={`text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors ${
            showArchived
              ? 'bg-gray-700 text-white border-gray-700'
              : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'
          }`}
        >
          {showArchived ? 'Hide Archived' : 'Show Archived'}
        </button>
      </div>

      {!adding && (
        <button
          onClick={() => setAdding(true)}
          className="w-full py-2.5 rounded-xl border-2 border-dashed border-gray-200 text-sm text-blue-600 font-medium hover:border-blue-300 hover:bg-blue-50 transition-colors"
        >
          + Add Renter
        </button>
      )}

      {adding && (
        <RenterForm onSave={handleAdd} onCancel={() => setAdding(false)} saving={saving} />
      )}

      {loading && (
        <div className="flex justify-center py-8">
          <div className="w-6 h-6 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
        </div>
      )}

      {!loading && activeRenters.length === 0 && !adding && (
        <p className="text-sm text-gray-400 text-center py-8">No renters yet.</p>
      )}

      <div className="space-y-2">
        {activeRenters.map(r => (
          <RenterRow
            key={r.id}
            renter={r}
            onSelect={(renter, editMode) => setSelected({ renter, editMode })}
            onUpdated={() => load(showArchived)}
            onDeleted={() => load(showArchived)}
          />
        ))}
      </div>

      {showArchived && archivedRenters.length > 0 && (
        <div className="space-y-2 pt-2">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Archived</p>
          {archivedRenters.map(r => (
            <RenterRow
              key={r.id}
              renter={r}
              onSelect={(renter, editMode) => setSelected({ renter, editMode })}
              onUpdated={() => load(showArchived)}
              onDeleted={() => load(showArchived)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ─── ImportTab ────────────────────────────────────────────────────────────────

const PAST_IMPORT_YEARS = [2022, 2023, 2024, 2025]

function PastSeasonImportSection() {
  const [year, setYear]             = useState(2025)
  const [csvUrl, setCsvUrl]         = useState('')
  const [status, setStatus]         = useState('idle') // idle | fetching | preview | importing | done | error
  const [previewItems, setPreviewItems] = useState([])
  const [result, setResult]         = useState(null)
  const [errorMsg, setErrorMsg]     = useState('')

  const reset = () => {
    setStatus('idle')
    setPreviewItems([])
    setResult(null)
    setErrorMsg('')
    setCsvUrl('')
  }

  const fmtRange = (entry) =>
    `${fmtDate(toISODate(entry.startDate))}–${fmtDate(toISODate(entry.endDate))}`

  const handleFetch = async () => {
    if (!csvUrl.trim()) return
    setStatus('fetching')
    setErrorMsg('')
    try {
      const resp = await fetch(csvUrl.trim())
      if (!resp.ok) throw new Error(`Failed to fetch CSV (${resp.status})`)
      const text = await resp.text()
      const allEntries = parseCSVEntries(text).filter(e => e.name && e.startDate)

      const { data: existingRentals } = await supabase
        .from('rentals')
        .select('start_date, renters(email, name)')
        .eq('season_year', year)

      const existingSet = new Set()
      for (const r of (existingRentals || [])) {
        const email = r.renters?.email?.toLowerCase().trim()
        const name  = r.renters?.name?.toLowerCase().trim()
        if (email) existingSet.add(`e:${email}:${r.start_date}`)
        else if (name) existingSet.add(`n:${name}:${r.start_date}`)
      }

      const items = allEntries.map(entry => {
        if (entry.isOwnerUse) return { entry, type: 'owner' }
        const email    = (entry.email || '').toLowerCase().trim()
        const startIso = toISODate(entry.startDate)
        const isDupe   = (email && existingSet.has(`e:${email}:${startIso}`)) ||
                         existingSet.has(`n:${entry.name.toLowerCase().trim()}:${startIso}`)
        return { entry, type: isDupe ? 'duplicate' : 'new' }
      })

      setPreviewItems(items)
      setStatus('preview')
    } catch (err) {
      setErrorMsg(err.message || 'Unknown error')
      setStatus('error')
    }
  }

  const newCount = previewItems.filter(i => i.type === 'new').length

  const handleImport = async () => {
    setStatus('importing')
    let inserted = 0
    let skipped  = 0
    const errors = []

    for (const { entry } of previewItems.filter(i => i.type === 'new')) {
      try {
        const email    = (entry.email || '').toLowerCase().trim()
        const startIso = toISODate(entry.startDate)
        let renterId

        if (email) {
          const { data: existing } = await supabase
            .from('renters').select('id').eq('email', email).maybeSingle()
          if (existing) {
            renterId = existing.id
          } else {
            const { data: created, error } = await supabase
              .from('renters')
              .insert({ name: entry.name, email, first_year_rented: year })
              .select('id').single()
            if (error) throw new Error(`Renter "${entry.name}": ${error.message}`)
            renterId = created.id
          }
        } else {
          const { data: existing } = await supabase
            .from('renters').select('id').ilike('name', entry.name.trim()).maybeSingle()
          if (existing) {
            renterId = existing.id
          } else {
            const { data: created, error } = await supabase
              .from('renters')
              .insert({ name: entry.name, first_year_rented: year })
              .select('id').single()
            if (error) throw new Error(`Renter "${entry.name}": ${error.message}`)
            renterId = created.id
          }
        }

        const { data: existingRental } = await supabase
          .from('rentals').select('id')
          .eq('renter_id', renterId).eq('season_year', year).eq('start_date', startIso)
          .maybeSingle()

        if (existingRental) { skipped++; continue }

        const { error: rentalErr } = await supabase.from('rentals').insert({
          renter_id:       renterId,
          season_year:     year,
          start_date:      startIso,
          end_date:        toISODate(entry.endDate),
          total_rent:      entry.totalRent    || null,
          deposit_owed:    entry.depositOwed  || null,
          lease_status:    entry.leaseStatus  || null,
          balance_due:     entry.balanceDue   || null,
          payment1_owed:   entry.depositOwed   || null,
          payment1_amount: entry.depositActual?.amount  || null,
          payment1_date:   entry.depositActual?.date  ? toISODate(entry.depositActual.date)  : null,
          payment1_method: entry.depositActual?.method  || null,
          payment2_owed:   entry.payment2Owed  || null,
          payment2_amount: entry.payment2Actual?.amount || null,
          payment2_date:   entry.payment2Actual?.date ? toISODate(entry.payment2Actual.date) : null,
          payment2_method: entry.payment2Actual?.method || null,
          payment3_owed:   entry.finalOwed     || null,
          payment3_amount: entry.finalActual?.amount   || null,
          payment3_date:   entry.finalActual?.date   ? toISODate(entry.finalActual.date)   : null,
          payment3_method: entry.finalActual?.method   || null,
          lease_url:        entry.leaseUrl || null,
          smart_lock_combo: null,
          source:           'csv',
        })

        if (rentalErr) errors.push(`"${entry.name}" ${startIso}: ${rentalErr.message}`)
        else inserted++
      } catch (err) {
        errors.push(err.message)
      }
    }

    setResult({ inserted, skipped, errors })
    setStatus('done')
  }

  return (
    <div className="border border-gray-200 rounded-xl p-4 space-y-4">
      <div>
        <p className="text-sm font-semibold text-gray-900">Import Past Season</p>
        <p className="text-xs text-gray-500 mt-0.5">
          Import historical rentals from a published Google Sheets CSV URL.
        </p>
      </div>

      {(status === 'idle' || status === 'error') && (
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <label className="text-sm text-gray-600 w-24 flex-shrink-0">Season Year</label>
            <select
              value={year}
              onChange={e => { setYear(Number(e.target.value)); setErrorMsg('') }}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
            >
              {PAST_IMPORT_YEARS.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-xs text-gray-500">CSV URL</label>
            <input
              type="url"
              placeholder="https://docs.google.com/…&output=csv"
              value={csvUrl}
              onChange={e => setCsvUrl(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
            />
          </div>

          {status === 'error' && (
            <p className="text-sm text-red-600">{errorMsg}</p>
          )}

          <button
            onClick={handleFetch}
            disabled={!csvUrl.trim()}
            className="w-full py-2.5 rounded-lg text-sm font-medium bg-gray-700 text-white disabled:opacity-40 hover:bg-gray-800 transition-colors"
          >
            Fetch &amp; Preview
          </button>
        </div>
      )}

      {status === 'fetching' && (
        <div className="flex items-center gap-2 py-2">
          <div className="w-4 h-4 border-2 border-gray-200 border-t-gray-600 rounded-full animate-spin" />
          <span className="text-sm text-gray-500">Fetching CSV…</span>
        </div>
      )}

      {(status === 'preview' || status === 'importing') && (
        <div className="space-y-3">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
            Found {previewItems.filter(i => i.type !== 'owner').length} rentals for {year}
          </p>

          <div className="space-y-0.5 max-h-64 overflow-y-auto text-sm">
            {previewItems.map((item, i) => {
              if (item.type === 'owner') return (
                <div key={i} className="flex items-baseline gap-2 text-gray-400 py-0.5">
                  <span className="flex-shrink-0">🏠</span>
                  <span>{item.entry.name} · {fmtRange(item.entry)} (skipped)</span>
                </div>
              )
              if (item.type === 'duplicate') return (
                <div key={i} className="flex items-baseline gap-2 text-amber-600 py-0.5">
                  <span className="flex-shrink-0">⚠️</span>
                  <span>
                    {item.entry.name} · {fmtRange(item.entry)}
                    {item.entry.totalRent ? ` · $${item.entry.totalRent.toLocaleString()}` : ''}
                    {' '}
                    <span className="text-amber-500 text-xs">Already exists (will skip)</span>
                  </span>
                </div>
              )
              return (
                <div key={i} className="flex items-baseline gap-2 text-gray-700 py-0.5">
                  <span className="flex-shrink-0 text-green-600">✅</span>
                  <span>
                    {item.entry.name} · {fmtRange(item.entry)}
                    {item.entry.totalRent ? ` · $${item.entry.totalRent.toLocaleString()}` : ''}
                  </span>
                </div>
              )
            })}
          </div>

          <div className="flex gap-2 pt-1">
            <button
              onClick={reset}
              className="px-4 py-2.5 text-sm text-gray-500 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleImport}
              disabled={newCount === 0 || status === 'importing'}
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-blue-600 text-white disabled:opacity-40 hover:bg-blue-700 transition-colors"
            >
              {status === 'importing'
                ? 'Importing…'
                : `Import ${newCount} rental${newCount !== 1 ? 's' : ''}`}
            </button>
          </div>
        </div>
      )}

      {status === 'done' && result && (
        <div className="space-y-3">
          <p className="text-sm text-green-700 font-medium">
            Imported {result.inserted} rental{result.inserted !== 1 ? 's' : ''} for {year}.
            {result.skipped > 0 ? ` ${result.skipped} skipped (already existed).` : ''}
          </p>
          {result.errors.length > 0 && (
            <div className="text-xs text-red-600 space-y-0.5">
              {result.errors.map((e, i) => <p key={i}>{e}</p>)}
            </div>
          )}
          <button
            onClick={reset}
            className="w-full py-2.5 rounded-xl text-sm font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
          >
            Import Another Season
          </button>
        </div>
      )}
    </div>
  )
}

function MigrateSection({ csvUrl, onDone }) {
  const [rentersEmpty, setRentersEmpty] = useState(null)
  const [status, setStatus] = useState('idle') // idle | running | done | error
  const [progress, setProgress] = useState(null)
  const [result, setResult] = useState(null)

  useEffect(() => {
    supabase
      .from('renters')
      .select('id', { count: 'exact', head: true })
      .then(({ count }) => setRentersEmpty(count === 0))
  }, [])

  const handleMigrate = async () => {
    setStatus('running')
    try {
      const resp = await fetch(csvUrl)
      if (!resp.ok) throw new Error('Failed to fetch CSV')
      const text = await resp.text()
      const entries = parseCSVEntries(text)
      const res = await migrate2026(entries, supabase, (p) => setProgress(p))
      setResult(res)
      setStatus('done')
      if (res.inserted > 0) onDone()
    } catch (err) {
      setResult({ errors: [err.message] })
      setStatus('error')
    }
  }

  if (rentersEmpty === null) return null
  if (!rentersEmpty && status === 'idle') return null

  return (
    <div className="border border-amber-200 rounded-xl p-4 space-y-3 bg-amber-50">
      <div>
        <p className="text-sm font-semibold text-amber-900">Migrate 2026 Data</p>
        <p className="text-xs text-amber-700 mt-0.5">
          Import all 2026 rentals from Google Sheets into Supabase. Only runs once — skips any rows already present.
        </p>
      </div>

      {status === 'idle' && (
        <button
          onClick={handleMigrate}
          className="w-full py-2.5 rounded-lg text-sm font-medium bg-amber-600 text-white hover:bg-amber-700 transition-colors"
        >
          Migrate 2026 Data
        </button>
      )}

      {status === 'running' && (
        <div className="flex items-center gap-2 py-1">
          <div className="w-4 h-4 border-2 border-amber-300 border-t-amber-700 rounded-full animate-spin flex-shrink-0" />
          <span className="text-sm text-amber-800">
            {progress ? `${progress.message} (${progress.done}/${progress.total})` : 'Starting…'}
          </span>
        </div>
      )}

      {status === 'done' && result && (
        <div className="text-sm text-green-800 space-y-1">
          <p className="font-medium">Migration complete</p>
          <p>{result.inserted} inserted · {result.skipped} skipped</p>
          {result.errors.length > 0 && (
            <div className="mt-1 text-red-700 text-xs space-y-0.5">
              {result.errors.map((e, i) => <p key={i}>{e}</p>)}
            </div>
          )}
        </div>
      )}

      {status === 'error' && result && (
        <div className="text-sm text-red-700 space-y-1">
          <p className="font-medium">Migration failed</p>
          {result.errors.map((e, i) => <p key={i} className="text-xs">{e}</p>)}
          <button
            onClick={() => { setStatus('idle'); setResult(null) }}
            className="text-xs font-medium text-red-600 hover:underline"
          >
            Try again
          </button>
        </div>
      )}
    </div>
  )
}

function ImportTab({ csvUrl, onDataRefresh }) {
  const [seasonYear, setSeasonYear] = useState(2026)
  const [parseStatus, setParseStatus] = useState('idle') // idle | checking | preview | importing | done | error
  const [cleanEntries, setCleanEntries] = useState([])
  const [conflicts, setConflicts] = useState([]) // [{ entry, existingRental, existingRenter }]
  const [choices, setChoices] = useState({}) // { [index]: 'keep' | 'incoming' | 'skip' }
  const [importMsg, setImportMsg] = useState('')
  const fileRef = useRef()

  const reset = () => {
    setParseStatus('idle')
    setCleanEntries([])
    setConflicts([])
    setChoices({})
    setImportMsg('')
    if (fileRef.current) fileRef.current.value = ''
  }

  const handleFile = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setParseStatus('checking')

    try {
      const text = await file.text()
      const entries = parseCSVEntries(text).filter(en => !en.isOwnerUse && en.startDate && en.endDate)

      // Collect all start dates to batch-query Supabase
      const startDates = entries.map(en => toISODate(en.startDate))
      const { data: existingRentals } = await supabase
        .from('rentals')
        .select('*, renters(id, name, email)')
        .eq('season_year', seasonYear)
        .in('start_date', startDates)

      const existingByDate = {}
      for (const r of (existingRentals || [])) {
        existingByDate[r.start_date] = r
      }

      const clean = []
      const conflictList = []
      for (const en of entries) {
        const key = toISODate(en.startDate)
        if (existingByDate[key]) {
          conflictList.push({ entry: en, existingRental: existingByDate[key] })
        } else {
          clean.push(en)
        }
      }

      setCleanEntries(clean)
      setConflicts(conflictList)
      setChoices({})
      setParseStatus('preview')
    } catch (err) {
      setImportMsg('Failed to parse CSV: ' + (err.message || 'Unknown error'))
      setParseStatus('error')
    }
  }

  const allResolved = conflicts.length === 0 || conflicts.every((_, i) => choices[i] !== undefined)

  const handleImport = async () => {
    setParseStatus('importing')
    try {
      // Clean imports
      for (const entry of cleanEntries) {
        await upsertRenterAndRental(entry, seasonYear)
      }
      // Conflict resolutions
      for (let i = 0; i < conflicts.length; i++) {
        const choice = choices[i]
        if (choice === 'incoming') {
          await upsertRenterAndRental(conflicts[i].entry, seasonYear, conflicts[i].existingRental.id)
        }
        // 'keep' and 'skip' → do nothing
      }
      const total = cleanEntries.length + conflicts.filter((_, i) => choices[i] === 'incoming').length
      setImportMsg(`Imported ${total} rental${total !== 1 ? 's' : ''}`)
      setParseStatus('done')
      onDataRefresh()
    } catch (err) {
      setImportMsg('Import failed: ' + (err.message || 'Unknown error'))
      setParseStatus('error')
    }
  }

  const setChoice = (i, val) => setChoices(prev => ({ ...prev, [i]: val }))

  return (
    <div className="px-4 py-4 space-y-4">
      <MigrateSection csvUrl={csvUrl} onDone={onDataRefresh} />

      <div className="border border-gray-200 rounded-xl p-4 space-y-4">
        <p className="text-sm font-semibold text-gray-900">Import CSV</p>

        {/* Year selector */}
        <div className="flex items-center gap-3">
          <label className="text-sm text-gray-600 w-24 flex-shrink-0">Season Year</label>
          <select
            value={seasonYear}
            onChange={e => { setSeasonYear(Number(e.target.value)); reset() }}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
          >
            {SEASON_YEARS.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>

        {/* File input */}
        {(parseStatus === 'idle' || parseStatus === 'error') && (
          <>
            <button
              onClick={() => fileRef.current?.click()}
              className="w-full py-2.5 rounded-xl border-2 border-dashed border-gray-200 text-sm text-blue-600 font-medium hover:border-blue-300 hover:bg-blue-50 transition-colors"
            >
              Choose CSV file
            </button>
            <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleFile} />
            {parseStatus === 'error' && (
              <p className="text-sm text-red-600">{importMsg}</p>
            )}
          </>
        )}

        {/* Checking spinner */}
        {parseStatus === 'checking' && (
          <div className="flex items-center gap-2 py-2">
            <div className="w-4 h-4 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
            <span className="text-sm text-gray-500">Checking for conflicts…</span>
          </div>
        )}

        {/* Preview */}
        {(parseStatus === 'preview' || parseStatus === 'importing') && (
          <div className="space-y-4">
            {/* Clean imports */}
            {cleanEntries.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                  Clean Imports ({cleanEntries.length})
                </p>
                <div className="space-y-1 max-h-40 overflow-y-auto">
                  {cleanEntries.map((en, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm text-gray-700 py-0.5">
                      <span className="text-green-600">✅</span>
                      <span>
                        {fmtDate(toISODate(en.startDate))}–{fmtDate(toISODate(en.endDate))} · {en.name}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Conflicts */}
            {conflicts.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                  Conflicts ({conflicts.length})
                </p>
                <div className="space-y-3">
                  {conflicts.map((c, i) => (
                    <div key={i} className="border border-amber-200 rounded-xl p-3 bg-amber-50 space-y-2">
                      <p className="text-xs font-semibold text-amber-900">
                        ⚠️ Week of {fmtDate(toISODate(c.entry.startDate))}
                      </p>
                      <div className="text-xs text-gray-700 space-y-0.5">
                        <p>
                          <span className="font-medium">Current:</span>{' '}
                          {c.existingRental.renters?.name || 'Unknown'}{' '}
                          {c.existingRental.renters?.email ? `· ${c.existingRental.renters.email}` : ''}
                        </p>
                        <p>
                          <span className="font-medium">Incoming:</span>{' '}
                          {c.entry.name}{c.entry.email ? ` · ${c.entry.email}` : ''}
                        </p>
                      </div>
                      <div className="flex gap-1.5">
                        {[
                          { val: 'keep',     label: 'Keep Current' },
                          { val: 'incoming', label: 'Use Incoming' },
                          { val: 'skip',     label: 'Skip' },
                        ].map(({ val, label }) => (
                          <button
                            key={val}
                            onClick={() => setChoice(i, val)}
                            className={`flex-1 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                              choices[i] === val
                                ? val === 'incoming'
                                  ? 'bg-blue-600 text-white border-blue-600'
                                  : 'bg-gray-700 text-white border-gray-700'
                                : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
                            }`}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2 pt-1">
              <button
                onClick={reset}
                className="px-4 py-2.5 text-sm text-gray-500 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleImport}
                disabled={!allResolved || parseStatus === 'importing'}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-blue-600 text-white disabled:opacity-40 hover:bg-blue-700 transition-colors"
              >
                {parseStatus === 'importing'
                  ? 'Importing…'
                  : `Import ${cleanEntries.length + conflicts.filter((_, i) => choices[i] === 'incoming').length} week${(cleanEntries.length + conflicts.filter((_, i) => choices[i] === 'incoming').length) !== 1 ? 's' : ''}`
                }
              </button>
            </div>
          </div>
        )}

        {/* Done */}
        {parseStatus === 'done' && (
          <div className="space-y-3">
            <p className="text-sm text-green-700 font-medium">{importMsg}</p>
            <button
              onClick={reset}
              className="w-full py-2.5 rounded-xl text-sm font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
            >
              Import Another
            </button>
          </div>
        )}
      </div>

      <PastSeasonImportSection />
    </div>
  )
}

// ─── PropertyTab ─────────────────────────────────────────────────────────────

function PropertyTab() {
  const [lockCode, setLockCode]       = useState('')
  const [lockboxCode, setLockboxCode] = useState('')
  const [loaded, setLoaded]           = useState(false)
  const [editing, setEditing]         = useState(false)
  const [draftLock, setDraftLock]     = useState('')
  const [draftLockbox, setDraftLockbox] = useState('')
  const [saving, setSaving]           = useState(false)

  useEffect(() => {
    supabase
      .from('property_settings')
      .select('key, value')
      .in('key', ['owner_lock_code', 'lockbox_code'])
      .then(({ data }) => {
        const byKey = Object.fromEntries((data || []).map(r => [r.key, r.value]))
        setLockCode(byKey['owner_lock_code'] || '')
        setLockboxCode(byKey['lockbox_code'] || '')
        setLoaded(true)
      })
  }, [])

  const startEdit = () => {
    setDraftLock(lockCode)
    setDraftLockbox(lockboxCode)
    setEditing(true)
  }

  const handleCancel = () => setEditing(false)

  const handleSave = async () => {
    setSaving(true)
    const now = new Date().toISOString()
    await supabase.from('property_settings').upsert([
      { key: 'owner_lock_code', value: draftLock.trim(),    updated_at: now },
      { key: 'lockbox_code',    value: draftLockbox.trim(), updated_at: now },
    ], { onConflict: 'key' })
    setLockCode(draftLock.trim())
    setLockboxCode(draftLockbox.trim())
    setSaving(false)
    setEditing(false)
  }

  if (!loaded) return (
    <div className="flex justify-center py-8">
      <div className="w-6 h-6 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="px-4 py-4 space-y-4">
      <div className="border border-gray-200 rounded-xl p-4 space-y-4">
        {/* Header row */}
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-gray-900">Access Codes</p>
          {!editing && (
            <button
              onClick={startEdit}
              className="text-xs font-medium text-blue-600 hover:text-blue-800 flex items-center gap-1"
            >
              ✏️ Edit
            </button>
          )}
        </div>

        {editing ? (
          <>
            <div className="space-y-1">
              <p className="text-sm font-medium text-gray-700">Owner Smart Lock Code</p>
              <p className="text-xs text-gray-500">Your personal entry code when the house is in owner use</p>
              <input
                type="text"
                inputMode="numeric"
                maxLength={8}
                placeholder="e.g. 2193"
                value={draftLock}
                onChange={e => setDraftLock(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400 mt-1"
              />
            </div>

            <div className="border-t border-gray-100 pt-3 space-y-1">
              <p className="text-sm font-medium text-gray-700">Lock Box Code</p>
              <p className="text-xs text-gray-500">Permanent backup lock box combination</p>
              <input
                type="text"
                inputMode="numeric"
                maxLength={8}
                placeholder="e.g. 4872"
                value={draftLockbox}
                onChange={e => setDraftLockbox(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400 mt-1"
              />
            </div>

            <div className="flex gap-2 pt-1">
              <button
                onClick={handleCancel}
                className="flex-1 py-2 rounded-lg text-sm text-gray-500 border border-gray-200 hover:bg-gray-50 transition-colors"
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
          </>
        ) : (
          <>
            <div className="space-y-0.5">
              <p className="text-xs font-medium text-gray-500">Owner Smart Lock Code</p>
              <p className="text-xs text-gray-400">Your personal entry code when the house is in owner use</p>
              <p className={`text-sm font-mono mt-1 ${lockCode ? 'font-semibold text-gray-900 tracking-widest' : 'text-gray-400 italic'}`}>
                {lockCode || 'Not set'}
              </p>
            </div>

            <div className="border-t border-gray-100 pt-3 space-y-0.5">
              <p className="text-xs font-medium text-gray-500">Lock Box Code</p>
              <p className="text-xs text-gray-400">Permanent backup lock box combination</p>
              <p className={`text-sm font-mono mt-1 ${lockboxCode ? 'font-semibold text-gray-900 tracking-widest' : 'text-gray-400 italic'}`}>
                {lockboxCode || 'Not set'}
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ─── SettingsScreen ───────────────────────────────────────────────────────────

export default function SettingsScreen({ onClose, onDataRefresh, csvUrl }) {
  const [tab, setTab] = useState('renters')
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true))
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  const handleClose = () => {
    setVisible(false)
    setTimeout(onClose, 250)
  }

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
            className="text-blue-600 font-medium text-sm hover:text-blue-800 transition-colors flex items-center gap-1"
          >
            ← Back
          </button>
          <h2 className="text-base font-semibold text-gray-900 flex-1">Settings</h2>
        </div>
      </header>

      {/* Tabs */}
      <div className="border-b border-gray-100 flex-shrink-0">
        <div className="max-w-2xl mx-auto px-4 flex">
          {[
            { key: 'renters',  label: 'Renters' },
            { key: 'import',   label: 'Import' },
            { key: 'property', label: 'Property' },
          ].map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`py-3 mr-6 text-sm font-medium border-b-2 transition-colors ${
                tab === key
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto">
          {tab === 'renters'
            ? <RentersTab />
            : tab === 'import'
              ? <ImportTab csvUrl={csvUrl} onDataRefresh={() => { onDataRefresh(); handleClose() }} />
              : <PropertyTab />
          }
        </div>
      </div>
    </div>
  )
}
