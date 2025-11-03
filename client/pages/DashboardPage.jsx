import { useSelector } from 'react-redux'
import { ComingSoon, PageHeader } from '../components'
import { useBranchScope } from '../hooks'
import { selectCurrentUser } from '../features/auth/store/authSlice'

const ROLE_INTRO = {
  pharmacist: 'Your branch’s stock at a glance: what needs restocking, what is expiring, and your return requests.',
  cashier: 'Your branch’s sales and customer returns today.',
  purchase_officer: 'Your branch’s procurements, payments and supplier returns.'
}

// Each role's home page. The Owner's is Coming Soon.
export default function DashboardPage() {
  const user = useSelector(selectCurrentUser)
  const { scopeLabel, branchById } = useBranchScope()
  const role = user?.role
  const staffBranchId = user?.branchId && user.branchId !== 'all' ? user.branchId : null

  if (role === 'owner') {
    return <ComingSoon feature="Owner Dashboard" description="An overview of every branch (staff, sales, stock and procurement) will appear here." />
  }

  return (
    <div className="content-section-card">
      <PageHeader title={`Dashboard · ${staffBranchId ? branchById(staffBranchId)?.name || '' : scopeLabel}`} description={ROLE_INTRO[role]} />
    </div>
  )
}
