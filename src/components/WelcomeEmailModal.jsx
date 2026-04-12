import { useState } from 'react'
import { mergeTemplate, renderHtml, renderPlain } from '../lib/reminders'

function buildMailto(to, subject, body) {
  return `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
}

function useCopyButton(duration = 1500) {
  const [copiedKey, setCopiedKey] = useState(null)

  const copy = async (text, key) => {
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      const el = document.createElement('textarea')
      el.value = text
      document.body.appendChild(el)
      el.select()
      document.execCommand('copy')
      document.body.removeChild(el)
    }
    setCopiedKey(key)
    setTimeout(() => setCopiedKey(null), duration)
  }

  return { copiedKey, copy }
}

function CopyButton({ label, text, id, copiedKey, onCopy }) {
  const isCopied = copiedKey === id
  return (
    <button
      onClick={() => onCopy(text, id)}
      className="flex-shrink-0 text-xs font-medium border border-gray-200 text-gray-500 hover:border-gray-400 hover:text-gray-700 rounded-full px-2.5 py-0.5 transition-colors"
    >
      {isCopied ? 'Copied ✓' : label}
    </button>
  )
}

export default function WelcomeEmailModal({ reminder, onClose }) {
  const { copiedKey, copy } = useCopyButton()

  const merged    = mergeTemplate(reminder.emailTemplate, reminder.mergeFields)
  const html      = renderHtml(merged)
  const plain     = renderPlain(merged)
  const mailtoUrl = buildMailto(reminder.email, reminder.emailSubject, plain)

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-2xl max-h-[92dvh] flex flex-col shadow-2xl">

        {/* Title bar */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 flex-shrink-0">
          <p className="text-sm font-semibold text-gray-700">Welcome Email Preview</p>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl leading-none p-1"
          >
            ×
          </button>
        </div>

        {/* To row */}
        <div className="flex items-center gap-3 px-5 py-3 border-b border-gray-100 flex-shrink-0">
          <span className="text-xs font-semibold text-gray-400 w-14 flex-shrink-0">To:</span>
          <span className="flex-1 text-sm text-gray-800 truncate">{reminder.email}</span>
          <CopyButton label="Copy" text={reminder.email} id="email" copiedKey={copiedKey} onCopy={copy} />
        </div>

        {/* Subject row */}
        <div className="flex items-center gap-3 px-5 py-3 border-b border-gray-100 flex-shrink-0">
          <span className="text-xs font-semibold text-gray-400 w-14 flex-shrink-0">Subject:</span>
          <span className="flex-1 text-sm text-gray-800 truncate">{reminder.emailSubject}</span>
          <CopyButton label="Copy" text={reminder.emailSubject} id="subject" copiedKey={copiedKey} onCopy={copy} />
        </div>

        {/* Body label + copy button */}
        <div className="flex items-center justify-between px-5 pt-3 pb-1 flex-shrink-0">
          <span className="text-xs font-semibold text-gray-400">Body:</span>
          <CopyButton label="Copy Body" text={plain} id="body" copiedKey={copiedKey} onCopy={copy} />
        </div>

        {/* Body preview */}
        <div
          className="flex-1 overflow-y-auto px-5 pb-4 text-sm text-gray-800 leading-relaxed"
          style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit' }}
          dangerouslySetInnerHTML={{ __html: html }}
        />

        {/* Footer */}
        <div className="px-5 py-4 border-t border-gray-100 flex-shrink-0">
          <a
            href={mailtoUrl}
            className="block w-full text-center text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-xl py-2.5 transition-colors"
          >
            Open in Mail
          </a>
        </div>

      </div>
    </div>
  )
}
