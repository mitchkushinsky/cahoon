import { useState } from 'react'

export default function ReminderBanner({ reminder, onSessionDismiss, onPermanentDismiss, onPreview }) {
  const [marking, setMarking] = useState(false)
  const isJan15   = reminder.type === 'JAN_15'
  const isWelcome = reminder.type === 'WELCOME'

  const handleMarkSent = async () => {
    setMarking(true)
    await onPermanentDismiss(reminder)
  }

  return (
    <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm">
      <span className="flex-shrink-0 text-base">⚠️</span>

      <div className="flex-1 min-w-0">
        <p className="text-amber-800 font-medium leading-snug">{reminder.message}</p>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 mt-2">
          {/* Email action */}
          {isWelcome ? (
            <button
              onClick={() => onPreview(reminder)}
              className="text-xs font-semibold text-amber-700 underline underline-offset-2 hover:text-amber-900"
            >
              Preview &amp; Copy
            </button>
          ) : isJan15 && reminder.mailtoUrls?.length > 1 ? (
            reminder.mailtoUrls.map(({ name, url }) => (
              <a
                key={name}
                href={url}
                className="text-xs font-semibold text-amber-700 underline underline-offset-2 hover:text-amber-900"
              >
                Email {name}
              </a>
            ))
          ) : (
            <a
              href={reminder.mailtoUrl}
              className="text-xs font-semibold text-amber-700 underline underline-offset-2 hover:text-amber-900"
            >
              Send Email
            </a>
          )}

          {/* Permanent dismiss */}
          <button
            onClick={handleMarkSent}
            disabled={marking}
            className="text-xs font-semibold text-green-700 bg-green-100 hover:bg-green-200 px-2.5 py-1 rounded-full disabled:opacity-50 transition-colors"
          >
            {marking ? 'Saving…' : 'Mark as Sent ✓'}
          </button>
        </div>
      </div>

      {/* Session dismiss */}
      <button
        onClick={() => onSessionDismiss(reminder)}
        className="flex-shrink-0 text-amber-400 hover:text-amber-600 text-lg leading-none p-0.5 -mt-0.5"
        aria-label="Dismiss for this session"
      >
        ×
      </button>
    </div>
  )
}
