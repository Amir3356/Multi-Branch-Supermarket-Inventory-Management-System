import { useSelector } from 'react-redux'
import { ComingSoon, PageHeader } from '../components'
import { useBranchScope } from '../hooks'
import { selectCurrentUser } from '../features/auth/store/authSlice'

const ROLE_INTRO = {
  pharmacist: 'Your branch’s stock at a glance: what needs restocking, and what is expiring.',
  cashier: 'Your branch’s sales today.',
  purchase_officer: 'Procurements and payments for every branch.'
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
