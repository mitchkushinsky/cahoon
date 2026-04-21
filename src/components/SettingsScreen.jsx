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
  const [name, setName] = useState(initial.name || '')
  const [email, setEmail] = useState(initial.email || '')
  const [firstYear, setFirstYear] = useState(initial.first_year_rented || '')
  const [notes, setNotes] = useState(initial.notes || '')

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
      <textarea
        placeholder="Notes (optional)"
        value={notes}
        onChange={e => setNotes(e.target.value)}
        rows={2}
        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400 resize-none bg-white"
      />
      <div className="flex gap-2">
        <button
          onClick={onCancel}
          className="flex-1 py-2 rounded-lg text-sm text-gray-500 border border-gray-200 bg-white hover:bg-gray-50 transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={() => onSave({ name: name.trim(), email: email.trim() || null, first_year_rented: firstYear ? Number(firstYear) : null, notes: notes.trim() || null })}
          disabled={!name.trim() || saving}
          className="flex-1 py-2 rounded-lg text-sm font-medium bg-blue-600 text-white disabled:opacity-40 hover:bg-blue-700 transition-colors"
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
    </div>
  )
}

function RenterRow({ renter, onUpdated, onDeleted }) {
  const [editing, setEditing]           = useState(false)
  const [saving, setSaving]             = useState(false)
  const [checkingDelete, setChecking]   = useState(false)
  const [deleteError, setDeleteError]   = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [confirmArchive, setConfirmArchive] = useState(false)
  const [acting, setActing]             = useState(false)

  const isArchived = !!renter.archived_at

  const handleSave = async (fields) => {
    setSaving(true)
    const { error } = await supabase.from('renters').update(fields).eq('id', renter.id)
    setSaving(false)
    if (!error) { setEditing(false); onUpdated() }
  }

  const handleTrashClick = async () => {
    setDeleteError(null)
    setConfirmDelete(false)
    setConfirmArchive(false)
    setEditing(false)
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

  const handleRestore = async () => {
    setActing(true)
    await supabase.from('renters').update({ archived_at: null }).eq('id', renter.id)
    setActing(false)
    onUpdated()
  }

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden">
      {/* Row */}
      <div className="flex items-center px-4 py-3 gap-3">
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
          <div className="flex items-center gap-0.5 flex-shrink-0">
            <button
              onClick={() => { setEditing(v => !v); setConfirmDelete(false); setConfirmArchive(false); setDeleteError(null) }}
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

      {/* Edit form */}
      {editing && !isArchived && (
        <div className="border-t border-gray-100 px-4 pb-4 pt-3 bg-gray-50">
          <RenterForm
            initial={renter}
            onSave={handleSave}
            onCancel={() => setEditing(false)}
            saving={saving}
          />
        </div>
      )}

      {/* Delete error */}
      {deleteError && (
        <div className="border-t border-red-100 px-4 pb-4 pt-3 bg-red-50 space-y-2">
          <p className="text-sm text-red-700">{deleteError}</p>
          <button onClick={() => setDeleteError(null)} className="text-xs text-gray-500 hover:underline">
            Dismiss
          </button>
        </div>
      )}

      {/* Archive confirmation */}
      {confirmArchive && (
        <div className="border-t border-amber-100 px-4 pb-4 pt-3 bg-amber-50 space-y-3">
          <p className="text-sm text-amber-800">
            This renter has past rental records. Archive them instead of deleting?
          </p>
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

      {/* Hard delete confirmation */}
      {confirmDelete && (
        <div className="border-t border-red-100 px-4 pb-4 pt-3 bg-red-50 space-y-3">
          <p className="text-sm text-red-800">
            Delete {renter.name} permanently? This cannot be undone.
          </p>
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

function RentersTab() {
  const [renters, setRenters]         = useState([])
  const [loading, setLoading]         = useState(true)
  const [adding, setAdding]           = useState(false)
  const [saving, setSaving]           = useState(false)
  const [showArchived, setShowArchived] = useState(false)

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

  const activeRenters   = renters.filter(r => !r.archived_at)
  const archivedRenters = renters.filter(r => r.archived_at)

  return (
    <div className="px-4 py-4 space-y-3">
      {/* Toolbar */}
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
        <RenterForm
          onSave={handleAdd}
          onCancel={() => setAdding(false)}
          saving={saving}
        />
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
          <RenterRow key={r.id} renter={r} onUpdated={() => load(showArchived)} onDeleted={() => load(showArchived)} />
        ))}
      </div>

      {showArchived && archivedRenters.length > 0 && (
        <div className="space-y-2 pt-2">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Archived</p>
          {archivedRenters.map(r => (
            <RenterRow key={r.id} renter={r} onUpdated={() => load(showArchived)} onDeleted={() => load(showArchived)} />
          ))}
        </div>
      )}
    </div>
  )
}

// ─── ImportTab ────────────────────────────────────────────────────────────────

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
            { key: 'renters', label: 'Renters' },
            { key: 'import',  label: 'Import' },
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
            : <ImportTab csvUrl={csvUrl} onDataRefresh={() => { onDataRefresh(); handleClose() }} />
          }
        </div>
      </div>
    </div>
  )
}
