import { useState } from 'react'
import { RefreshCw } from 'lucide-react'
import AccessReviewModal from './AccessReviewModal'
import GenerateReviewDialog from './GenerateReviewDialog'

/**
 * Access reviews: for a period (daily, weekly, monthly, quarterly, yearly or a custom range) the system lists all
 * users with their role and last login, flagging dormant accounts and role changes (privilege creep). Generate report
 * opens a dialog to pick the period; the new report opens straight away.
 */
export default function AccessReviewsPanel({ accounts }) {
  const [openId, setOpenId] = useState(null)
  const [showGenerate, setShowGenerate] = useState(false)

  const handleGenerated = ({ review }) => {
    setShowGenerate(false)
    setOpenId(review.id)
  }

  return (
    <div className="sessions-section">

      <div style={{ display: 'flex', justifyContent: 'center', marginTop: '1rem' }}>
        <button type="button" className="primary-action-btn" onClick={() => setShowGenerate(true)}>
          <RefreshCw size={16} /> Generate report
        </button>
      </div>

      {showGenerate && <GenerateReviewDialog onClose={() => setShowGenerate(false)} onGenerated={handleGenerated} />}

      {openId && <AccessReviewModal reviewId={openId} accounts={accounts} onClose={() => setOpenId(null)} />}
    </div>
  )
}
