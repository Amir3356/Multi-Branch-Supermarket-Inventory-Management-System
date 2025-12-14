import { useEffect, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { Notice, PageHeader } from '../components'
import { selectAccounts } from '../features/accounts/store/accountsSlice'
import { loadAccounts } from '../features/accounts/store/accountsThunks'
import AccessReviewsPanel from '../features/accounts/components/AccessReviewsPanel'
import './UserReportPage.css'

// Reports → User Report (Owner): access reviews of every account for a period
export default function UserReportPage() {
  const dispatch = useDispatch()
  const accounts = useSelector(selectAccounts)
  const [notice, setNotice] = useState(null)

  // Access reviews list every account, so the account list is loaded here too
  useEffect(() => {
    dispatch(loadAccounts()).catch((error) => setNotice({ type: 'error', text: error.message }))
  }, [dispatch])

  return (
    <div className="content-section-card user-report-page">
      <PageHeader centered title="User Report" description="Generate a User Report for any period to see every staff member's role, branch, account status and last sign-in, with dormant accounts highlighted." />
      <Notice notice={notice} onDismiss={() => setNotice(null)} />
      <AccessReviewsPanel accounts={accounts} />
    </div>
  )
}
