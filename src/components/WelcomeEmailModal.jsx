import { useState } from 'react'
import { mergeTemplate, renderHtml, renderPlain } from '../lib/reminders'

function buildMailto(to, subject, body) {
  return `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
}

export default function WelcomeEmailModal({ reminder, onClose }) {
  const [copied, setCopied] = useState(false)

  const merged   = mergeTemplate(reminder.emailTemplate, reminder.mergeFields)
  const html     = renderHtml(merged)
  const plain    = renderPlain(merged)
  const mailtoUrl = buildMailto(reminder.email, reminder.emailSubject, plain)

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(plain)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Fallback for older browsers
      const el = document.createElement('textarea')
      el.value = plain
      document.body.appendChild(el)
      el.select()
      document.execCommand('copy')
      document.body.removeChild(el)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-2xl max-h-[92dvh] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between px-5 py-4 border-b border-gray-100 flex-shrink-0">
          <div className="min-w-0 pr-3">
            <p className="text-xs text-gray-400 truncate">To: {reminder.email}</p>
            <p className="text-sm font-semibold text-gray-900 mt-0.5">{reminder.emailSubject}</p>
          </div>
          <button
            onClick={onClose}
            className="flex-shrink-0 text-gray-400 hover:text-gray-600 text-2xl leading-none p-1 -mt-1"
          >
            ×
          </button>
        </div>

        {/* Email body preview */}
        <div
          className="flex-1 overflow-y-auto px-5 py-4 text-sm text-gray-800 leading-relaxed"
          style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit' }}
          dangerouslySetInnerHTML={{ __html: html }}
        />

        {/* Footer */}
        <div className="flex items-center gap-3 px-5 py-4 border-t border-gray-100 flex-shrink-0">
          <button
            onClick={copyToClipboard}
            className="flex-1 text-sm font-semibold bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl py-2.5 transition-colors"
          >
            {copied ? '✓ Copied!' : 'Copy to Clipboard'}
          </button>
          <a
            href={mailtoUrl}
            className="flex-1 text-center text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-xl py-2.5 transition-colors"
          >
            Open in Mail
          </a>
        </div>
      </div>
    </div>
  )
}
