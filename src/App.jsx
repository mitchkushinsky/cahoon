import { useState, useEffect, useCallback } from 'react'
import { parseCSV, toISODate } from './lib/parseCSV'
import { computeReminders } from './lib/reminders'
import { supabase } from './lib/supabase'
import WeekCard from './components/WeekCard'
import Modal from './components/Modal'
import RenterModal from './components/RenterModal'
import SplitRenterModal from './components/SplitRenterModal'
import VacantModal from './components/VacantModal'
import OwnerUseModal from './components/OwnerUseModal'
import ReminderBanner from './components/ReminderBanner'
import WelcomeEmailModal from './components/WelcomeEmailModal'

const CSV_URL =
  'https://docs.google.com/spreadsheets/d/e/2PACX-1vQ30InqobRxfZ7haOcmosYtzDonv6hxaF5W74QX6KAm4PB5eYJ9W3Pb5zFGtcFR21xnh8GgC8l54TP2/pub?gid=572457704&single=true&output=csv'

export default function App() {
  const [weeks, setWeeks] = useState([])
  const [ownerUse, setOwnerUse] = useState([])
  const [appointments, setAppointments] = useState([])
  const [commentOverrides, setCommentOverrides] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [selected, setSelected] = useState(null)
  const [sessionDismissed, setSessionDismissed] = useState([])       // keys dismissed this session
  const [permanentDismissals, setPermanentDismissals] = useState([])  // keys from Supabase
  const [previewReminder, setPreviewReminder] = useState(null)        // welcome email preview

  const loadData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [csvResp, ouResp, apptResp, coResp, rdResp] = await Promise.all([
        fetch(CSV_URL).then(r => {
          if (!r.ok) throw new Error('Failed to fetch schedule from Google Sheets')
          return r.text()
        }),
        supabase.from('owner_use').select('*'),
        supabase.from('appointments').select('*'),
        supabase.from('comment_overrides').select('*'),
        supabase.from('reminder_dismissals').select('reminder_key'),
      ])
      setWeeks(parseCSV(csvResp))
      setOwnerUse(ouResp.data || [])
      setAppointments(apptResp.data || [])
      setCommentOverrides(coResp.data || [])
      setPermanentDismissals((rdResp.data || []).map(r => r.reminder_key))
    } catch (err) {
      setError(err.message || 'Something went wrong loading the schedule.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadData() }, [loadData])

  const refreshSupabase = useCallback(async () => {
    const [ouResp, apptResp, coResp] = await Promise.all([
      supabase.from('owner_use').select('*'),
      supabase.from('appointments').select('*'),
      supabase.from('comment_overrides').select('*'),
    ])
    setOwnerUse(ouResp.data || [])
    setAppointments(apptResp.data || [])
    setCommentOverrides(coResp.data || [])
  }, [])

  const getOwnerUseRow = (weekStart) =>
    ownerUse.find(r => r.week_start === toISODate(weekStart))

  const getCommentOverride = (weekStart) =>
    commentOverrides.find(r => r.week_start === toISODate(weekStart))

  const closeModal = () => setSelected(null)

  const handleRefresh = () => { refreshSupabase(); closeModal() }
  const handleRefreshKeepOpen = () => refreshSupabase()

  // Compute reminders, filtering out session and permanently dismissed
  const allReminders = weeks.length > 0 ? computeReminders(weeks) : []
  const visibleReminders = allReminders.filter(r =>
    !sessionDismissed.includes(r.reminderKey) &&
    !permanentDismissals.includes(r.reminderKey)
  )

  const sessionDismiss = (reminder) => {
    setSessionDismissed(prev => [...prev, reminder.reminderKey])
  }

  const permanentDismiss = async (reminder) => {
    // Optimistically hide immediately
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

  const selectedOwnerUse = selected ? getOwnerUseRow(selected.weekStart) : null
  const selectedIsOwner  = selected ? (selected.isOwnerSheet || !!selectedOwnerUse) : false
  const selectedIsSplit  = selected?.type === 'split' && !selectedIsOwner
  const selectedIsRenter = selected?.type === 'renter' && !selectedIsOwner

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
          <button
            onClick={loadData}
            disabled={loading}
            className="text-sm text-blue-600 font-medium hover:underline disabled:opacity-40"
          >
            {loading ? 'Loading…' : 'Refresh'}
          </button>
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

        {visibleReminders.length > 0 && (
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

        {weeks.length > 0 && (
          <div className="space-y-2">
            {weeks.map(week => (
              <WeekCard
                key={week.weekKey}
                week={week}
                ownerUseRow={getOwnerUseRow(week.weekStart)}
                appointments={appointments}
                commentOverride={getCommentOverride(week.weekStart)}
                onClick={() => setSelected(week)}
              />
            ))}
          </div>
        )}
      </main>

      {/* Welcome email preview modal */}
      {previewReminder && (
        <WelcomeEmailModal
          reminder={previewReminder}
          onClose={() => setPreviewReminder(null)}
        />
      )}

      {/* Modal */}
      {selected && (
        <Modal onClose={closeModal}>
          {({ onClose }) =>
            selectedIsSplit ? (
              <SplitRenterModal
                week={selected}
                appointments={appointments}
                commentOverride={getCommentOverride(selected.weekStart)}
                onClose={onClose}
                onRefresh={handleRefreshKeepOpen}
              />
            ) : selectedIsRenter ? (
              <RenterModal
                week={selected}
                appointments={appointments}
                commentOverride={getCommentOverride(selected.weekStart)}
                onClose={onClose}
                onRefresh={handleRefreshKeepOpen}
              />
            ) : selectedIsOwner ? (
              <OwnerUseModal
                week={selected}
                ownerUseRow={selectedOwnerUse}
                appointments={appointments}
                onClose={onClose}
                onRefresh={handleRefresh}
              />
            ) : (
              <VacantModal
                week={selected}
                appointments={appointments}
                onClose={onClose}
                onRefresh={handleRefresh}
              />
            )
          }
        </Modal>
      )}
    </div>
  )
}
