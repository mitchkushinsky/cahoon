export default function ReminderBanner({ reminder, onDismiss }) {
  // JAN_15 has multiple mailto links (one per renter)
  const isJan15 = reminder.type === 'JAN_15'

  return (
    <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm">
      <span className="flex-shrink-0 text-base">⚠️</span>
      <div className="flex-1 min-w-0">
        <p className="text-amber-800 font-medium leading-snug">{reminder.message}</p>

        {isJan15 && reminder.mailtoUrls?.length > 1 ? (
          <div className="flex flex-wrap gap-2 mt-2">
            {reminder.mailtoUrls.map(({ name, url }) => (
              <a
                key={name}
                href={url}
                className="text-xs font-semibold text-amber-700 underline underline-offset-2 hover:text-amber-900"
              >
                Email {name}
              </a>
            ))}
          </div>
        ) : (
          <a
            href={reminder.mailtoUrl}
            className="inline-block mt-1.5 text-xs font-semibold text-amber-700 underline underline-offset-2 hover:text-amber-900"
          >
            Send Email
          </a>
        )}
      </div>
      <button
        onClick={onDismiss}
        className="flex-shrink-0 text-amber-400 hover:text-amber-600 text-lg leading-none p-0.5"
        aria-label="Dismiss"
      >
        ×
      </button>
    </div>
  )
}
