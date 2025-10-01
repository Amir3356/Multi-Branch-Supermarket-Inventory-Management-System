import { AlertTriangle, CheckCircle2, X } from 'lucide-react'

// Dismissible confirmation / error banner. notice: { type: 'success' | 'error' | 'info', text } or a plain string.
export default function Notice({ notice, onDismiss }) {
  if (!notice) return null
  const { type = 'success', text } = typeof notice === 'string' ? { text: notice } : notice
  return (
    <div className={`success-notice ${type === 'success' ? '' : type}`}>
      {type === 'error' ? <AlertTriangle size={16} /> : <CheckCircle2 size={16} />}
      <span>{text}</span>
      <button type="button" onClick={onDismiss} aria-label="Dismiss">
        <X size={14} />
      </button>
    </div>
  )
}
