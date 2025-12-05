import { useEffect, useState } from 'react'
import { useSelector } from 'react-redux'
import { RefreshCw, Sparkles } from 'lucide-react'
import { Notice, PageHeader } from '../components'
import { selectCurrentUser } from '../features/auth/store/authSlice'
import { fetchRecommendations } from '../features/aiAssistance/api/aiApi'
import { suggestionsFor } from '../features/aiAssistance/model/suggestions'
import RecommendationList, { RecommendationSkeleton } from '../features/aiAssistance/components/RecommendationList'
import AssistantChat from '../features/aiAssistance/components/AssistantChat'
import './AIAssistancePage.css'

// "just now", "12 min ago", "2 h ago"
const updatedAgo = (iso) => {
  const minutes = Math.round((Date.now() - Date.parse(iso)) / 60000)
  if (!Number.isFinite(minutes) || minutes < 1) return 'just now'
  return minutes < 60 ? `${minutes} min ago` : `${Math.round(minutes / 60)} h ago`
}

// AI Assistance: recommendations for the signed-in role from its own data, and a chat to ask about them
export default function AIAssistancePage() {
  const user = useSelector(selectCurrentUser)
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  // { text } from a recommendation's "Ask about this"; a new object each click, so the same question can be asked again
  const [draft, setDraft] = useState(null)

  // Kept on the server for 30 minutes; refresh asks the AI again
  const request = (refresh) =>
    fetchRecommendations(refresh)
      .then(({ data }) => ({ data }))
      .catch((err) => ({ error: err.message }))

  const load = async (refresh) => {
    setLoading(true)
    setError(null)
    const { data, error } = await request(refresh)
    if (data) setResult(data)
    setError(error ?? null)
    setLoading(false)
  }

  useEffect(() => {
    let active = true
    request(false).then(({ data, error }) => {
      if (!active) return
      if (data) setResult(data)
      setError(error ?? null)
      setLoading(false)
    })
    return () => {
      active = false
    }
  }, [])

  const scope = user?.branchName || 'All Branches'

  return (
    <div className="content-section-card ai-page">
      <PageHeader title={`AI Assistance · ${user?.roleLabel ?? ''}`} description={`Recommendations for your role, worked out from ${scope === 'All Branches' ? 'every branch' : `${scope}'s`} figures.`}>
        <button type="button" className="secondary-action-btn" onClick={() => load(true)} disabled={loading}>
          <RefreshCw size={16} className={loading ? 'ai-spin' : undefined} /> {loading ? 'Analyzing…' : 'Refresh'}
        </button>
      </PageHeader>

      <div className="ai-layout">
        <section className="ai-recommendations" aria-label="Recommendations" aria-busy={loading}>
          {loading && (
            <>
              <p className="ai-status">
                <Sparkles size={15} /> Reviewing your figures. This can take up to a minute…
              </p>
              <RecommendationSkeleton />
            </>
          )}

          {!loading && error && (
            <>
              <Notice notice={{ type: 'error', text: error }} onDismiss={() => setError(null)} />
              <button type="button" className="secondary-action-btn ai-retry" onClick={() => load(false)}>
                <RefreshCw size={16} /> Try again
              </button>
            </>
          )}

          {!loading && !error && result && (
            <>
              {result.summary && <p className="ai-summary">{result.summary}</p>}
              <p className="ai-status">Updated {updatedAgo(result.generatedAt)} · {scope}</p>
              <RecommendationList recommendations={result.recommendations} onAsk={(text) => setDraft({ text })} />
            </>
          )}
        </section>

        <AssistantChat suggestions={suggestionsFor(user?.role)} storageKey={`ai-chat:${user?.id}`} draft={draft} />
      </div>
    </div>
  )
}
