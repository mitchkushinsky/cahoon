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

          <Section icon="🏠" title="Welcome to your Rental Property Manager">
            <P>Shows your full rental season at a glance — who's renting, what's been paid, and what's coming up.</P>
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
              <Row icon="📝">Renter note exists</Row>
            </div>

            <Sub>Next season's invite chips</Sub>
            <div className="space-y-1">
              <P>Once renters are invited back for next season (see <B>Invites</B> under Settings), their proposed week shows on the calendar too — same card, further down the list.</P>
              <Row icon="🟢">Solid green — confirmed, or a lease has been created/sent/signed</Row>
              <Row icon="🟡">Amber — invite sent, not yet confirmed</Row>
              <Row icon="⬜">Gray — not sent yet</Row>
              <Row icon="•">Declined or Not Returning — hidden from the calendar entirely</Row>
              <P>Tap a chip to open that invite's details. These chips are owner-only — caretakers don't see them.</P>
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
              <Row icon="🏠"><span><B>Mark as Owner Use</B> — mark weeks you'll be using the property. Start and end dates default to the full week but can be adjusted with the date pickers for a partial-week stay (e.g. arriving Wednesday) — the app warns if your dates overlap an existing rental.</span></Row>
              <Row icon="🧹"><span><B>Add Appointment</B> — schedule a cleaning, repair, or exterminator.</span></Row>
            </div>
          </Section>

          <Section icon="✅" title="Tasks">
            <P>Tap <B>Tasks</B> in the header to open the task list — it's a separate screen now, not on the calendar itself. A red badge shows how many tasks are still incomplete, in both your view and the caretaker's.</P>

            {isAdmin && (
              <>
                <Sub>Adding and editing</Sub>
                <P>Tap <B>+ Add Task</B> to create one — title, optional notes, due date, and category. Tap the ✏️ pencil on any task to edit it, or 🗑️ to delete.</P>

                <Sub>Categories</Sub>
                <P>Group tasks under <B>Winterize</B>, <B>New Season Setup</B>, or <B>Larger Projects</B>. Tasks share a category automatically group under that heading in the list; tasks with no category stay in a flat "General" list.</P>
              </>
            )}

            <Sub>Expanding a task</Sub>
            <P>Tap anywhere on a task row to expand it and see its notes, due date, and category — tap again to collapse. The chevron (›) on the right rotates down when expanded.</P>

            {isAdmin ? (
              <P>Tap the circle to mark a task complete — it flashes green, then moves into <B>Show Completed</B> at the bottom of the list.</P>
            ) : (
              <P>Tap the circle when a task is done — it disappears from your pending list. You can read notes on any task, including completed ones, but can't add, edit, or delete tasks.</P>
            )}
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

              <Sub>Property tab</Sub>
              <div className="space-y-1">
                <Row icon="•">Set the Owner Smart Lock Code and Lock Box Code shown in Owner Use weeks</Row>
                <Row icon="•"><span><B>Start [Year] Season</B> — appears once the current season's last rental has ended. Confirming switches the whole app (calendar, financials, everything) over to the next season year. This can't easily be undone, so it only shows up when it's actually time.</span></Row>
              </div>

              <Sub>Invites tab (next season's outreach)</Sub>
              <div className="space-y-1">
                <Row icon="•">Lists renters eligible to be invited back for next season, with a proposed week and rent pre-filled one year ahead of their most recent stay</Row>
                <Row icon="•">Status progression: Not Sent → Sent → Confirmed → Lease Created → Lease Sent → Lease Signed, with Declined / Not Returning as exit states</Row>
                <Row icon="•"><span>Tap <B>Preview &amp; Copy Email</B> to see the invite email before sending it yourself, then <B>Mark as Sent</B></span></Row>
                <Row icon="•"><span><B>Create Lease</B> (on a confirmed invite) or <B>Create Leases</B> (bulk, for all confirmed invites) generates a lease document and moves status to Lease Created automatically</span></Row>
              </div>
            </Section>
          )}

          {isAdmin && (
            <Section icon="💰" title="Financials">
              <P>Tap <B>Financials</B> in the header to open the financial dashboard. Use the year selector to switch between seasons.</P>

              <Sub>Expenses tab</Sub>
              <div className="space-y-1">
                <Row icon="•">Track all property expenses by date, description, and category</Row>
                <Row icon="•">Categories: Cleaning, Repairs, Utilities, Insurance, Supplies, Taxes, Other</Row>
                <Row icon="+"><span>Tap <B>+ Add</B> to enter an expense manually</span></Row>
                <Row icon="•"><span>Tap <B>Import CSV</B> to bulk-import from a spreadsheet. Required columns: <Code>date</Code>, <Code>amount</Code>. Optional: <Code>description</Code>, <Code>category</Code>. Duplicate rows are skipped.</span></Row>
              </div>

              <Sub>Occupancy Tax tab</Sub>
              <div className="space-y-1">
                <Row icon="•">Shows tax owed for each month that has a rental ending in it</Row>
                <Row icon="•">Tax = gross rent − (gross rent ÷ 1.1445), per MA short-term rental rules</Row>
                <Row icon="•">Tap <B>Details</B> to see a per-renter breakdown for a month</Row>
                <Row icon="•">Tap <B>Record Payment</B> to log when you paid the tax (amount, date, notes)</Row>
              </div>

              <Sub>Year-End Report tab</Sub>
              <div className="space-y-1">
                <Row icon="•">Summary of total rental income, occupancy tax, and expenses by category</Row>
                <Row icon="•">Net income = Income − Tax − Expenses</Row>
                <Row icon="•">Tap <B>Export CSV</B> to download for your accountant</Row>
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
                <Row icon="•"><span><B>Occupancy tax due</B> — fires in the last 5 days of a rental month when tax hasn't been recorded as paid</span></Row>
                <Row icon="🦟"><span><B>Mosquito Treatment</B> — fires 24 hours before a scheduled exterminator appointment if a renter is currently in the house. If added less than 24 hours before, fires immediately. No email is sent if the house is vacant.</span></Row>
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
                <Row icon="•">Tasks, in their own tab — a badge shows how many are still incomplete. You can read task notes and mark tasks complete, but not add, edit, or delete them.</Row>
              </div>

              <Sub>What's hidden</Sub>
              <div className="space-y-1">
                <Row icon="•">All payment and financial information</Row>
                <Row icon="•">Lease documents</Row>
                <Row icon="•">Owner private notes, including renter notes (📝)</Row>
                <Row icon="•">Next season's invite chips on the calendar</Row>
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
