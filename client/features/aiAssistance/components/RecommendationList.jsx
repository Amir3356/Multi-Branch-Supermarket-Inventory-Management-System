import { ArrowRight, CheckCircle2, MessageSquare } from 'lucide-react'

const PRIORITY_LABELS = { high: 'Act today', medium: 'This week', low: 'Keep an eye on' }

// Placeholder cards while the AI works through the figures
export function RecommendationSkeleton() {
  return (
    <div className="ai-rec-list" aria-hidden="true">
      {[0, 1, 2].map((i) => (
        <div key={i} className="ai-rec-card ai-skeleton">
          <span className="ai-skeleton-line short" />
          <span className="ai-skeleton-line" />
          <span className="ai-skeleton-line" />
        </div>
      ))}
    </div>
  )
}

// The AI's recommendations, most important first; "Ask about this" continues in the chat
export default function RecommendationList({ recommendations, onAsk }) {
  if (!recommendations.length) {
    return (
      <div className="ai-rec-empty">
        <CheckCircle2 size={20} />
        <span>Nothing needs your attention right now.</span>
      </div>
    )
  }

  return (
    <ol className="ai-rec-list">
      {recommendations.map((rec, index) => (
        <li key={`${index}-${rec.title}`} className={`ai-rec-card priority-${rec.priority}`}>
          <div className="ai-rec-meta">
            <span className={`ai-priority priority-${rec.priority}`}>{PRIORITY_LABELS[rec.priority]}</span>
            <span className="ai-category">{rec.category}</span>
          </div>
          <h3 className="ai-rec-title">{rec.title}</h3>
          {rec.detail && <p className="ai-rec-detail">{rec.detail}</p>}
          <div className="ai-rec-footer">
            {rec.action && (
              <span className="ai-rec-action">
                <ArrowRight size={14} /> {rec.action}
              </span>
            )}
            <button type="button" className="link-btn ai-ask-btn" onClick={() => onAsk(`Tell me more about: ${rec.title}`)}>
              <MessageSquare size={14} /> Ask about this
            </button>
          </div>
        </li>
      ))}
    </ol>
  )
}
