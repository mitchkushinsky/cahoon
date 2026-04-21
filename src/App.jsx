import { useState, useEffect, useCallback } from 'react'
import { parseCSV, toISODate } from './lib/parseCSV'
import { buildSupabaseCalendar } from './lib/supabaseRentals'
import { computeReminders } from './lib/reminders'
import { resolveWeeksPayments } from './lib/resolvePayments'
import { seedPaymentsFromCSV } from './lib/seedPayments'
import { supabase } from './lib/supabase'
import WeekCard from './components/WeekCard'
import Modal from './components/Modal'
import RenterModal from './components/RenterModal'
import SplitRenterModal from './components/SplitRenterModal'
import VacantModal from './components/VacantModal'
import OwnerUseModal from './components/OwnerUseModal'
import ReminderBanner from './components/ReminderBanner'
import WelcomeEmailModal from './components/WelcomeEmailModal'
import ICSImportModal from './components/ICSImportModal'
import SettingsScreen from './components/SettingsScreen'

const CSV_URL =
  'https://docs.google.com/spreadsheets/d/e/2PACX-1vQ30InqobRxfZ7haOcmosYtzDonv6hxaF5W74QX6KAm4PB5eYJ9W3Pb5zFGtcFR21xnh8GgC8l54TP2/pub?gid=572457704&single=true&output=csv'

// Switch to true after 2026 data has been migrated to Supabase.
// When true: calendar is built from Supabase rentals table (CSV fetch is skipped).
// When false: existing CSV-based behavior (safe fallback / testing).
const USE_SUPABASE_RENTALS = true

const isAdmin = new URLSearchParams(window.location.search).get('mode') !== 'caretaker'

export default function App() {
  const [weeks, setWeeks] = useState([])
  const [ownerUse, setOwnerUse] = useState([])
  const [appointments, setAppointments] = useState([])
  const [commentOverrides, setCommentOverrides] = useState([])
  const [caretakerNotes, setCaretakerNotes] = useState([])
  const [paymentRecords, setPaymentRecords] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [selected, setSelected] = useState(null)
  const [sessionDismissed, setSessionDismissed] = useState([])
  const [permanentDismissals, setPermanentDismissals] = useState([])
  const [previewReminder, setPreviewReminder] = useState(null)
  const [showICSImport, setShowICSImport] = useState(false)
  const [showSettings, setShowSettings] = useState(false)

  const loadData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      if (USE_SUPABASE_RENTALS) {
        const [rentalsResp, rentersResp, apptResp, ouResp, coResp, cnResp, prResp, rdResp] =
          await Promise.all([
            supabase.from('rentals').select('*'),
            supabase.from('renters').select('*'),
            supabase.from('appointments').select('*'),
            supabase.from('owner_use').select('*'),
            supabase.from('comment_overrides').select('*'),
            supabase.from('caretaker_notes').select('*'),
            supabase.from('payment_records').select('*'),
            supabase.from('reminder_dismissals').select('reminder_key'),
          ])

        const parsedWeeks = buildSupabaseCalendar(
          rentalsResp.data || [],
          rentersResp.data || [],
          apptResp.data   || []
        )

        setWeeks(parsedWeeks)
        setOwnerUse(ouResp.data || [])
        setAppointments(apptResp.data || [])
        setCommentOverrides(coResp.data || [])
        setCaretakerNotes(cnResp.data || [])
        setPaymentRecords(prResp.data || [])
        setPermanentDismissals((rdResp.data || []).map(r => r.reminder_key))
      } else {
        // CSV fallback path
        const [csvResp, ouResp, apptResp, coResp, cnResp, prResp, rdResp] = await Promise.all([
          fetch(CSV_URL).then(r => {
            if (!r.ok) throw new Error('Failed to fetch schedule from Google Sheets')
            return r.text()
          }),
          supabase.from('owner_use').select('*'),
          supabase.from('appointments').select('*'),
          supabase.from('comment_overrides').select('*'),
          supabase.from('caretaker_notes').select('*'),
          supabase.from('payment_records').select('*'),
          supabase.from('reminder_dismissals').select('reminder_key'),
        ])

        const parsedWeeks = parseCSV(csvResp, apptResp.data || [])
        const initialPaymentRecords = prResp.data || []

        await seedPaymentsFromCSV(parsedWeeks, initialPaymentRecords)

        const { data: freshPR } = await supabase.from('payment_records').select('*')

        setWeeks(parsedWeeks)
        setOwnerUse(ouResp.data || [])
        setAppointments(apptResp.data || [])
        setCommentOverrides(coResp.data || [])
        setCaretakerNotes(cnResp.data || [])
        setPaymentRecords(freshPR || [])
        setPermanentDismissals((rdResp.data || []).map(r => r.reminder_key))
      }
    } catch (err) {
      setError(err.message || 'Something went wrong loading the schedule.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadData() }, [loadData])

  // Refreshes only ancillary Supabase tables (payments, appointments, notes).
  // Used when the calendar structure hasn't changed — e.g. adding a payment.
  const refreshSupabase = useCallback(async () => {
    const [ouResp, apptResp, coResp, cnResp, prResp] = await Promise.all([
      supabase.from('owner_use').select('*'),
      supabase.from('appointments').select('*'),
      supabase.from('comment_overrides').select('*'),
      supabase.from('caretaker_notes').select('*'),
      supabase.from('payment_records').select('*'),
    ])
    setOwnerUse(ouResp.data || [])
    setAppointments(apptResp.data || [])
    setCommentOverrides(coResp.data || [])
    setCaretakerNotes(cnResp.data || [])
    setPaymentRecords(prResp.data || [])
  }, [])

  const getOwnerUseRow    = (weekStart) => ownerUse.find(r => r.week_start === toISODate(weekStart))
  const getCommentOverride = (weekStart) => commentOverrides.find(r => r.week_start === toISODate(weekStart))
  const getCaretakerNote   = (weekStart) => caretakerNotes.find(r => r.week_start === toISODate(weekStart))

  const closeModal = () => setSelected(null)

  // Full reload + close modal. Used when calendar structure may have changed
  // (owner use marked, renter assigned, etc.)
  const handleRefresh = () => { loadData(); closeModal() }

  // Ancillary-only refresh, keeps modal open. Used for payment/note updates.
  const handleRefreshKeepOpen = () => refreshSupabase()

  // Merge Supabase payment records into weeks (Supabase takes precedence over embedded data)
  const resolvedWeeks = resolveWeeksPayments(weeks, paymentRecords)

  const resolvedSelected = selected
    ? resolvedWeeks.find(w => w.weekKey === selected.weekKey) ?? selected
    : null

  const allReminders = resolvedWeeks.length > 0 ? computeReminders(resolvedWeeks) : []
  const visibleReminders = allReminders.filter(r =>
    !sessionDismissed.includes(r.reminderKey) &&
    !permanentDismissals.includes(r.reminderKey)
  )

  const sessionDismiss = (reminder) => {
    setSessionDismissed(prev => [...prev, reminder.reminderKey])
  }

  const permanentDismiss = async (reminder) => {
    setPermanentDismissals(prev => [...prev, reminder.reminderKey])
    await supabase.from('reminder_dismissals').upsert(
      { reminder_key: reminder.reminderKey },
      { onConflict: 'reminder_key' }
    )
  }

  // PWA badge count
  useEffect(() => {
    const count = visibleReminders.length
    try {
      if (count > 0 && 'setAppBadge' in navigator) {
        navigator.setAppBadge(count).catch(() => {})
      } else if (count === 0 && 'clearAppBadge' in navigator) {
        navigator.clearAppBadge().catch(() => {})
      }
    } catch {}
  }, [visibleReminders.length])

  const selectedOwnerUse = resolvedSelected ? getOwnerUseRow(resolvedSelected.weekStart) : null
  const selectedIsOwner  = resolvedSelected ? (resolvedSelected.isOwnerSheet || !!selectedOwnerUse) : false
  const selectedIsSplit  = resolvedSelected?.type === 'split' && !selectedIsOwner
  const selectedIsRenter = resolvedSelected?.type === 'renter' && !selectedIsOwner

  return (
    <div className="min-h-dvh bg-gray-50">
      {/* Header */}
      <header
        className="bg-white border-b border-gray-100 shadow-sm sticky top-0 z-40"
        style={{ paddingTop: 'env(safe-area-inset-top)' }}
      >
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900 leading-tight">Cahoon</h1>
            <p className="text-xs text-gray-400 leading-tight">Rental Property Manager</p>
          </div>
          <div className="flex items-center gap-3">
            {isAdmin && (
              <button
                onClick={() => setShowICSImport(true)}
                className="text-sm text-gray-500 font-medium hover:text-gray-700"
              >
                Import Calendar
              </button>
            )}
            <button
              onClick={loadData}
              disabled={loading}
              className="text-sm text-blue-600 font-medium hover:underline disabled:opacity-40"
            >
              {loading ? 'Loading…' : 'Refresh'}
            </button>
            {isAdmin && (
              <button
                onClick={() => setShowSettings(true)}
                className="text-xl text-gray-400 hover:text-gray-700 transition-colors leading-none"
                title="Settings"
              >
                ⚙️
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-2xl mx-auto px-4 py-4 pb-10">
        {loading && weeks.length === 0 && (
          <div className="flex flex-col items-center justify-center py-24 gap-3">
            <div className="w-8 h-8 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
            <p className="text-sm text-gray-400">Loading schedule…</p>
          </div>
        )}

        {!loading && error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">
            <p className="font-semibold">Couldn't load schedule</p>
            <p className="mt-1 text-red-500">{error}</p>
            <button onClick={loadData} className="mt-2 font-medium text-red-600 hover:underline">Try again</button>
          </div>
        )}

        {isAdmin && visibleReminders.length > 0 && (
          <div className="space-y-2 mb-4">
            {visibleReminders.map((r, i) => (
              <ReminderBanner
                key={r.reminderKey ?? i}
                reminder={r}
                onSessionDismiss={sessionDismiss}
                onPermanentDismiss={permanentDismiss}
                onPreview={setPreviewReminder}
              />
            ))}
          </div>
        )}

        {resolvedWeeks.length > 0 && (
          <div className="space-y-2">
            {resolvedWeeks.map(week => (
              <WeekCard
                key={week.weekKey}
                week={week}
                ownerUseRow={getOwnerUseRow(week.weekStart)}
                appointments={appointments}
                commentOverride={getCommentOverride(week.weekStart)}
                caretakerNote={getCaretakerNote(week.weekStart)}
                isAdmin={isAdmin}
                onClick={() => setSelected(week)}
              />
            ))}
          </div>
        )}
      </main>

      {/* ICS import modal */}
      {showICSImport && (
        <ICSImportModal
          onClose={() => setShowICSImport(false)}
          onImported={() => { refreshSupabase(); setShowICSImport(false) }}
        />
      )}

      {/* Welcome email preview modal */}
      {previewReminder && (
        <WelcomeEmailModal
          reminder={previewReminder}
          onClose={() => setPreviewReminder(null)}
        />
      )}

      {/* Week detail modal */}
      {resolvedSelected && (
        <Modal onClose={closeModal}>
          {({ onClose }) =>
            selectedIsSplit ? (
              <SplitRenterModal
                week={resolvedSelected}
                appointments={appointments}
                commentOverride={getCommentOverride(resolvedSelected.weekStart)}
                caretakerNote={getCaretakerNote(resolvedSelected.weekStart)}
                isAdmin={isAdmin}
                onClose={onClose}
                onRefresh={handleRefreshKeepOpen}
              />
            ) : selectedIsRenter ? (
              <RenterModal
                week={resolvedSelected}
                appointments={appointments}
                commentOverride={getCommentOverride(resolvedSelected.weekStart)}
                caretakerNote={getCaretakerNote(resolvedSelected.weekStart)}
                isAdmin={isAdmin}
                onClose={onClose}
                onRefresh={handleRefreshKeepOpen}
                onFullRefresh={handleRefresh}
              />
            ) : selectedIsOwner ? (
              <OwnerUseModal
                week={resolvedSelected}
                ownerUseRow={selectedOwnerUse}
                appointments={appointments}
                caretakerNote={getCaretakerNote(resolvedSelected.weekStart)}
                isAdmin={isAdmin}
                onClose={onClose}
                onRefresh={handleRefresh}
              />
            ) : (
              <VacantModal
                week={resolvedSelected}
                appointments={appointments}
                caretakerNote={getCaretakerNote(resolvedSelected.weekStart)}
                isAdmin={isAdmin}
                onClose={onClose}
                onRefresh={handleRefresh}
              />
            )
          }
        </Modal>
      )}

      {/* Settings screen — slides in from right */}
      {showSettings && (
        <SettingsScreen
          csvUrl={CSV_URL}
          onClose={() => setShowSettings(false)}
          onDataRefresh={loadData}
        />
      )}
    </div>
  )
}
