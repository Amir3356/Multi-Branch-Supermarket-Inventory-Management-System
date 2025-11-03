import { useSelector } from 'react-redux'
import { PageHeader } from '../components'
import { useBranchScope } from '../hooks'
import { selectCurrentUser } from '../features/auth/store/authSlice'
import { selectReturnRequests } from '../features/supplierReturns/store/returnRequestsSlice'
import ReturnRequestsPanel from '../features/supplierReturns/components/ReturnRequestsPanel'

// Inventory Officer: the requests their branch sent from Inventory (Request supplier return), and what the
// Procurement Officer decided. Updates live over the WebSocket.
export default function ReturnRequestsPage() {
  const user = useSelector(selectCurrentUser)
  const { branchById } = useBranchScope()
  const requests = useSelector(selectReturnRequests).filter((r) => r.branchId === user?.branchId)

  return (
    <div className="content-section-card">
      <PageHeader
        title={`Return Requests · ${branchById(user?.branchId)?.name || ''}`}
        description="Requests to send stock back to suppliers. Pending units are held out of stock; Approved ones went back to the supplier, Rejected ones returned to stock. Send a new request from a product's row in Inventory."
      />
      <ReturnRequestsPanel requests={requests} isAllBranches={false} branchById={branchById} canHandle={false} showHeading={false} />
    </div>
  )
}
