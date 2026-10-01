import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import {
  eligibleRentalYears, getEligibleRenters, calculateProposal,
  STATUS_META, fmtDateRange, fmtMoney,
} from '../lib/seasonInvites'
import SeasonInviteModal from './SeasonInviteModal'

const NEXT_YEAR = new Date().getFullYear() + 1

// Not Returning renters sort last regardless of date — there's no date to
// act on anymore, so earliest-first stops being the useful order for them.
// Everyone else sorts ascending by proposed_start; the ISO "YYYY-MM-DD"
// strings compare correctly as plain strings. Shared by the initial load
// and by handleUpdated below (a status change to/from "Not Returning" needs
// the list to actually re-sort, not just the one row's data to change) so
// the two can't drift apart.
function compareRows(a, b) {
  const aLast = a.invite.status === 'not_returning'
  const bLast = b.invite.status === 'not_returning'
  if (aLast !== bLast) return aLast ? 1 : -1
  return (a.invite.proposed_start || '').localeCompare(b.invite.proposed_start || '')
}

function InviteRow({ renter, invite, onSelect }) {
  const statusMeta = STATUS_META[invite.status] || STATUS_META.not_sent
  return (
    <div
      onClick={() => onSelect(renter, invite)}
      className="flex items-center justify-between px-4 py-3 gap-3 border border-gray-200 rounded-xl cursor-pointer hover:bg-gray-50 transition-colors"
    >
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900">{renter.name}</p>
        <p className="text-xs text-gray-400 mt-0.5">
          {fmtDateRange(invite.proposed_start, invite.proposed_end)} · {fmtMoney(invite.proposed_rent)}
        </p>
      </div>
      <span className={`flex-shrink-0 inline-flex items-center max-w-[120px] px-2.5 py-1 rounded-full text-xs font-semibold truncate ${statusMeta.badgeClass}`}>
        {statusMeta.label}
      </span>
    </div>
  )
}

export default function SeasonInvitesTab() {
  const [rows, setRows] = useState([]) // [{ renter, invite }]
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [selected, setSelected] = useState(null) // { renter, invite }
  // Guards against StrictMode's dev-only double-invoke of mount effects:
  // load() ends with a conditional insert (auto-generate missing rows), and
  // there's no database-level uniqueness constraint on (renter_id,
  // season_year) backing it up (see schema.sql) — two overlapping calls can
  // both read "no existing row" before either insert lands, each inserting
  // its own copy. Caught live: a StrictMode double-mount during testing
  // produced exactly one duplicate per renter. This ref survives the
  // mount→cleanup→mount cycle (the component instance isn't actually
  // recreated), so the second call is skipped outright rather than racing.
  // Doesn't protect against two genuinely separate sessions loading this
  // screen at the same moment — only the missing database constraint would.
  const hasLoadedRef = useRef(false)

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const years = eligibleRentalYears()
      const [{ data: rentals, error: rentalsErr }, { data: renters, error: rentersErr }] = await Promise.all([
        supabase.from('rentals').select('*').in('season_year', years),
        supabase.from('renters').select('*').is('archived_at', null),
      ])
      if (rentalsErr) throw new Error(rentalsErr.message)
      if (rentersErr) throw new Error(rentersErr.message)

      const eligible = getEligibleRenters(rentals, renters)

      const { data: existingInvites, error: invitesErr } = await supabase
        .from('season_invites')
        .select('*')
        .eq('season_year', NEXT_YEAR)
      if (invitesErr) throw new Error(invitesErr.message)

      const inviteByRenter = Object.fromEntries((existingInvites || []).map(i => [i.renter_id, i]))

      // Auto-generate a row for any eligible renter that doesn't already
      // have one — never touching a renter's existing row.
      const toInsert = eligible
        .filter(({ renter }) => !inviteByRenter[renter.id])
        .map(({ renter, sourceRental }) => ({
          renter_id: renter.id,
          season_year: NEXT_YEAR,
          status: 'not_sent',
          ...calculateProposal(sourceRental),
        }))

      if (toInsert.length > 0) {
        const { data: inserted, error: insertErr } = await supabase
          .from('season_invites')
          .insert(toInsert)
          .select('*')
        if (insertErr) throw new Error(insertErr.message)
        for (const row of (inserted || [])) inviteByRenter[row.renter_id] = row
      }

      const combined = eligible
        .map(({ renter }) => ({ renter, invite: inviteByRenter[renter.id] }))
        .filter(r => r.invite)
        .sort(compareRows)

      setRows(combined)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (hasLoadedRef.current) return
    hasLoadedRef.current = true
    load()
  }, [])

  const handleUpdated = (patchedInvite) => {
    setRows(prev => prev
      .map(r => r.invite.id === patchedInvite.id ? { ...r, invite: patchedInvite } : r)
      .sort(compareRows))
    setSelected(prev => prev ? { ...prev, invite: patchedInvite } : prev)
  }

  return (
    <div className="px-4 py-4 space-y-3">
      <p className="text-xs text-gray-400">
        Renters who rented in {eligibleRentalYears().join(' or ')}, proposed one year ahead (52 weeks) at the same rent.
      </p>

      {loading && (
        <div className="flex justify-center py-8">
          <div className="w-6 h-6 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
        </div>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}

      {!loading && !error && rows.length === 0 && (
        <p className="text-sm text-gray-400 text-center py-8">No eligible renters found.</p>
      )}

      <div className="space-y-2">
        {rows.map(({ renter, invite }) => (
          <InviteRow
            key={invite.id}
            renter={renter}
            invite={invite}
            onSelect={(r, i) => setSelected({ renter: r, invite: i })}
          />
        ))}
      </div>

      {selected && (
        <SeasonInviteModal
          invite={selected.invite}
          renter={selected.renter}
          onClose={() => setSelected(null)}
          onUpdated={handleUpdated}
        />
      )}
    </div>
  )
}
