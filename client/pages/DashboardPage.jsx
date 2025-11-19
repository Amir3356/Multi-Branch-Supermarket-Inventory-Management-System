import { useSelector } from 'react-redux'
import { ComingSoon, PageHeader } from '../components'
import { useBranchScope } from '../hooks'
import { selectCurrentUser } from '../features/auth/store/authSlice'
import InventoryOfficerDashboard from '../features/dashboard/components/InventoryOfficerDashboard'
import CashierDashboard from '../features/dashboard/components/CashierDashboard'
import ProcurementOfficerDashboard from '../features/dashboard/components/ProcurementOfficerDashboard'

const ROLE_INTRO = {
  pharmacist: 'Your branch’s stock at a glance.',
  cashier: 'Your branch’s sales.',
  purchase_officer: 'Purchases for every branch.'
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
      {role === 'pharmacist' && <InventoryOfficerDashboard branchId={staffBranchId} />}
      {role === 'cashier' && <CashierDashboard branchId={staffBranchId} />}
      {role === 'purchase_officer' && <ProcurementOfficerDashboard />}
    </div>
  )
}
