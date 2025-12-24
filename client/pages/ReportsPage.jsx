import { useSelector } from 'react-redux'
import { ComingSoon } from '../components'
import { selectCurrentUser } from '../features/auth/store/authSlice'
import InventoryReportPage from './InventoryReportPage'
import ProcurementReportPage from './ProcurementReportPage'
import SalesReportPage from './SalesReportPage'

// Reports: a single Reports link opens the role's report right here (the Procurement Officer's Procurement Report, the
// Pharmacist's Inventory Report and the Cashier's Sales Report, each for their own branch)
export default function ReportsPage() {
  const role = useSelector(selectCurrentUser)?.role
  if (role === 'purchase_officer') return <ProcurementReportPage />
  if (role === 'pharmacist') return <InventoryReportPage />
  if (role === 'cashier') return <SalesReportPage />

  return (
    <ComingSoon
      feature="Reports & Analytics"
      description="Branch-level and consolidated financial reporting and analytical exports will be available in the upcoming release."
    />
  )
}
