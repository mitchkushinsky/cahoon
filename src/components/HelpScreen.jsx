import { useState, useEffect } from 'react'

function Section({ icon, title, children }) {
  return (
    <div className="py-5 border-b border-gray-100 last:border-b-0">
      <h2 className="text-base font-bold text-gray-900 mb-3 flex items-center gap-2">
        <span>{icon}</span>
        <span>{title}</span>
      </h2>
      <div className="space-y-2 text-sm text-gray-700 leading-relaxed">
        {children}
      </div>
    </div>
  )
}

function Sub({ children }) {
  return <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wide mt-4 mb-1.5">{children}</h3>
}

function Row({ icon, children }) {
  return (
    <div className="flex items-baseline gap-2">
      <span className="flex-shrink-0 w-5 text-center">{icon}</span>
      <span>{children}</span>
    </div>
  )
}

function P({ children }) {
  return <p>{children}</p>
}

function B({ children }) {
  return <strong className="font-semibold text-gray-900">{children}</strong>
}

function Code({ children }) {
  return <code className="font-mono text-xs bg-gray-100 px-1.5 py-0.5 rounded text-gray-700">{children}</code>
}

export default function HelpScreen({ onClose, isAdmin }) {
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
          <h2 className="text-base font-semibold text-gray-900 flex-1">Help</h2>
        </div>
      </header>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-4">

          <Section icon="🏠" title="Welcome to Cahoon">
            <P>A rental property manager that shows your full season at a glance — who's renting, what's been paid, and what's coming up.</P>
          </Section>

          <Section icon="📅" title="The Season Calendar">
            <P>The main screen shows every week of your rental season as a card.</P>

            <Sub>Reading the cards</Sub>
            <div className="space-y-1">
              <P>The date at the top (e.g. "Jun 7 – Jun 13") is the calendar week, always Sunday to Saturday.</P>
              <P>The colored bar shows who is renting and when during that week:</P>
              <Row icon="▬">A full-width green bar means the renter occupies the whole week</Row>
              <Row icon="▬">A partial bar means the renter arrives or departs mid-week</Row>
              <Row icon="▬">Two stacked bars means two renters share the week</Row>
            </div>

            <Sub>Status chips</Sub>
            <div className="space-y-1">
              <Row icon="🟢">Green — renter confirmed</Row>
              <Row icon="🏠">Blue — Owner Use</Row>
              <Row icon="⬜">Gray — Vacant</Row>
            </div>

            <Sub>Payment badges (shown on each renter bar)</Sub>
            <div className="space-y-1">
              <Row icon="✅">Paid in Full</Row>
              <Row icon="🟢">Current — paid everything due so far</Row>
              <Row icon="🟡">Partial — something paid but not everything due yet</Row>
              <Row icon="🔴">Overdue — a payment milestone was missed</Row>
            </div>

            <Sub>Icons on each card</Sub>
            <div className="space-y-1">
              <Row icon="🧹">Cleaning appointment scheduled that week</Row>
              <Row icon="🔨">Repair appointment scheduled</Row>
              <Row icon="🦟">Exterminator scheduled</Row>
              <Row icon="💬">Owner note exists</Row>
              <Row icon="📋">Caretaker note exists</Row>
            </div>
          </Section>

          <Section icon="👤" title="Renter Details">
            <P>Tap any renter bar to open their detail view.</P>

            <Sub>What you'll see</Sub>
            <div className="space-y-1">
              <Row icon="•">Name and email (tap email to open mail app)</Row>
              <Row icon="•">Rental dates</Row>
              <Row icon="•">Lease status (tap to open lease document if linked)</Row>
              <Row icon="•">Payment Milestones table — what's owed, what's been paid, and the method for each payment</Row>
              <Row icon="•">Total Rent, Total Paid, Balance Remaining</Row>
              <Row icon="•">Owner Notes — private notes only you can see</Row>
              <Row icon="•">Caretaker Notes — visible to your caretaker too</Row>
              <Row icon="•">Appointments for that week</Row>
            </div>

            <Sub>Adding a payment</Sub>
            <P>Tap <B>+ Add Payment</B> to record a new payment. Choose the payment number, enter the amount, date, and method (Venmo, Zelle, Paypal, or Check). The balance updates immediately.</P>

            <Sub>Editing a rental</Sub>
            <P>Tap <B>✏️ Edit Rental</B> to update dates, rent amount, lease status, or lease URL.</P>

            <Sub>Deleting a rental</Sub>
            <P>Tap <B>🗑 Delete Rental</B> to remove a renter from that week. The week returns to Vacant. The renter's profile is kept.</P>
          </Section>

          <Section icon="📭" title="Vacant Weeks">
            <P>Tap a Vacant week to:</P>
            <div className="space-y-1.5 mt-1">
              <Row icon="👤"><span><B>Assign Renter</B> — pick from your renter list or add a new one. Dates and payment milestones auto-calculate.</span></Row>
              <Row icon="🏠"><span><B>Mark as Owner Use</B> — mark weeks you'll be using the property.</span></Row>
              <Row icon="🧹"><span><B>Add Appointment</B> — schedule a cleaning, repair, or exterminator.</span></Row>
            </div>
          </Section>

          <Section icon="📋" title="Appointments">
            <P>Appointments appear as icons on week cards (🧹 🔨 🦟) with the date.</P>

            <Sub>Adding manually</Sub>
            <P>Tap any week → <B>Add Appointment</B> → choose type, title, date, and optional notes.</P>

            {isAdmin && (
              <>
                <Sub>Importing from Google Calendar</Sub>
                <P>Tap <B>Import Calendar</B> in the header → upload your <Code>.ics</Code> file exported from Google Calendar. The app detects cleaning vs. repair events automatically and skips cancelled events. Re-importing is safe — duplicates are ignored.</P>
              </>
            )}
          </Section>

          {isAdmin && (
            <Section icon="⚙️" title="Settings">
              <Sub>Renters tab</Sub>
              <div className="space-y-1">
                <Row icon="•">View all renter profiles</Row>
                <Row icon="•">Add a new renter (name, email, first year rented, notes)</Row>
                <Row icon="✏️">Edit renter details with the pencil icon</Row>
                <Row icon="🗑️"><span>Delete or archive renters with the trash icon:
                  <ul className="mt-1 ml-4 space-y-0.5 list-disc list-inside text-gray-600">
                    <li>Renters with future rentals cannot be deleted</li>
                    <li>Renters with past rentals are archived (hidden but kept)</li>
                    <li>Renters with no rentals are permanently deleted</li>
                  </ul>
                </span></Row>
                <Row icon="•">Toggle <B>Show Archived</B> to view and restore archived renters</Row>
              </div>

              <Sub>Import tab</Sub>
              <div className="space-y-1">
                <Row icon="•">Upload a CSV file to import rental history for any year</Row>
                <Row icon="•">Choose the season year, upload the file, review any conflicts</Row>
                <Row icon="•">Conflicts show both the existing and incoming renter so you can choose which to keep</Row>
              </div>
            </Section>
          )}

          {isAdmin && (
            <Section icon="🔔" title="Reminders">
              <P>Reminder banners appear at the top of the calendar when action is needed:</P>
              <div className="space-y-1 mt-1">
                <Row icon="•"><span><B>Final payment due</B> — fires 2 days before the 30-day deadline</span></Row>
                <Row icon="•"><span><B>Welcome email</B> — fires 7 days before a renter's arrival</span></Row>
                <Row icon="•"><span><B>Jan 15 payment</B> — fires Jan 13–14 for renters with outstanding second payments</span></Row>
              </div>

              <Sub>Each banner has</Sub>
              <div className="space-y-1">
                <Row icon="📧"><span><B>Send Email</B> — opens a pre-written email in your mail app</span></Row>
                <Row icon="👀"><span><B>Preview &amp; Copy</B> (welcome email) — shows a formatted email with copy buttons for address, subject, and body</span></Row>
                <Row icon="✓"><span><B>Mark as Sent ✓</B> — permanently dismisses the reminder across all your devices</span></Row>
                <Row icon="✕"><span><B>✕</B> — dismisses for this session only, returns on next open</span></Row>
              </div>
            </Section>
          )}

          {!isAdmin && (
            <Section icon="👷" title="Caretaker Mode">
              <P>You're viewing in caretaker mode — a read-only view designed for property caretakers.</P>

              <Sub>What you can see</Sub>
              <div className="space-y-1">
                <Row icon="•">Season calendar with renter names and appointment badges</Row>
                <Row icon="•">Renter name and email (tap to email)</Row>
                <Row icon="•">Rental dates</Row>
                <Row icon="•">Caretaker notes (you can read and edit these)</Row>
                <Row icon="•">Appointments</Row>
              </div>

              <Sub>What's hidden</Sub>
              <div className="space-y-1">
                <Row icon="•">All payment and financial information</Row>
                <Row icon="•">Lease documents</Row>
                <Row icon="•">Owner private notes</Row>
                <Row icon="•">Settings, Import Calendar, and reminder banners</Row>
              </div>
            </Section>
          )}

          {isAdmin && (
            <Section icon="👷" title="Caretaker Mode">
              <P>Share a caretaker link for a read-only view that hides all financial information:</P>
              <P><Code>[your-app-url]?mode=caretaker</Code></P>
              <P>The caretaker can view renter names, dates, appointments, and caretaker notes — but not payment details, lease documents, or owner notes.</P>
            </Section>
          )}

          <Section icon="💡" title="Tips">
            <div className="space-y-2">
              <Row icon="🔄"><span><B>Refresh</B> — tap Refresh in the header to reload all data</span></Row>
              <Row icon="📱"><span><B>Install as app</B> — on iPhone, tap Share → Add to Home Screen. On Android, tap the install icon in Chrome's address bar.</span></Row>
              <Row icon="🔢"><span><B>Badge count</B> — the app icon shows a number badge when reminders are active (iOS 16.4+ and Android PWA)</span></Row>
              <Row icon="📄"><span><B>Lease documents</B> — store leases in Google Drive, set sharing to "Anyone with link", paste the URL when editing a rental</span></Row>
              <Row icon="🔒"><span><B>Smart lock combos</B> — add the weekly combo to your spreadsheet and it appears in the welcome email template automatically</span></Row>
            </div>
          </Section>

          {/* Bottom padding for safe area */}
          <div className="h-8" />
        </div>
      </div>
    </div>
  )
}
