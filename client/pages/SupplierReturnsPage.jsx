import { useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { DollarSign, Package, PackageMinus } from 'lucide-react'
import { BranchTag, EmptyRow, Notice, PageHeader, StatCard, StatusTag } from '../components'
import { useBranchScope, useFormatMoney, useMoneyColumns } from '../hooks'
import { selectPurchases } from '../features/purchases/store/purchasesSlice'
import { selectSupplierReturns } from '../features/supplierReturns/store/supplierReturnsSlice'
import { selectInventory } from '../features/inventory/store/selectors'
import { selectProducts } from '../features/inventory/store/productsSlice'
import { selectCurrentUser } from '../features/auth/store/authSlice'
import { selectHeldReturnIds, selectReturnRequests } from '../features/supplierReturns/store/returnRequestsSlice'
import { approveReturnRequest, receiveReplacement, rejectReturnRequest } from '../features/supplierReturns/store/returnRequestsThunks'
import { creditOwed, supplierReturnStatus } from '../features/supplierReturns/model/supplierReturn'
import { EXTRA_QUANTITY } from '../features/supplierReturns/model/returnRequest'
import ReceiveReplacementModal from '../features/supplierReturns/components/ReceiveReplacementModal'
import ReturnRequestsPanel from '../features/supplierReturns/components/ReturnRequestsPanel'
import SupplierReturnModal from '../features/supplierReturns/components/SupplierReturnModal'
import './SupplierReturnsPage.css'

export default function SupplierReturnsPage() {
  const dispatch = useDispatch()
  const formatMoney = useFormatMoney()
  const { moneyHeader, formatAmount } = useMoneyColumns()
  const { branchById, isAllBranches, scopeLabel, inScope } = useBranchScope()
  const purchases = useSelector(selectPurchases)
  const allReturns = useSelector(selectSupplierReturns)
  const returns = allReturns.filter((r) => inScope(r.branchId))
  const inventory = useSelector(selectInventory)
  const products = useSelector(selectProducts)
  const user = useSelector(selectCurrentUser)
  const requests = useSelector(selectReturnRequests).filter((r) => inScope(r.branchId))
  // Only the Procurement Officer handles requests (for their own branch; the API checks too)
  const canHandle = user?.role === 'purchase_officer'
  const heldIds = useSelector(selectHeldReturnIds)
  const [approving, setApproving] = useState(null)
  const [replacing, setReplacing] = useState(null)
  const [notice, setNotice] = useState(null)


  // Extra units (more than were ordered) aren't part of the batch
  const returnedQtyForPurchase = (purchaseId) => allReturns.filter((r) => r.purchaseId === purchaseId && r.reason !== EXTRA_QUANTITY).reduce((sum, r) => sum + r.qty, 0)

  // Approving records the supplier return; the modal shows any error
  const handleApprove = async (data) => {
    const message = await dispatch(approveReturnRequest(approving, data))
    setNotice({ type: 'success', text: message })
    setApproving(null)
  }

  const handleReplace = async (payload) => {
    const message = await dispatch(receiveReplacement(replacing, payload))
    setNotice({ type: 'success', text: message })
    setReplacing(null)
  }

  // Unit cost of a request's batch, for the credit a replacement settles
  const unitCostOf = (request) => {
    const purchase = purchases.find((p) => p.id === request.procurementId)
    return purchase ? purchase.total / purchase.qty : 0
  }

  const handleReject = async (request) => {
    const note = window.prompt(`Why is the return of ${request.qty} × ${request.product} rejected? The Inventory Officer will see this.`)
    if (!note?.trim()) return
    try {
      setNotice({ type: 'success', text: await dispatch(rejectReturnRequest(request, note.trim())) })
    } catch (error) {
      setNotice({ type: 'error', text: error.message })
    }
  }

  return (
    <div className="content-section-card">
      <PageHeader title={`Supplier Returns · ${scopeLabel}`} description="Purchased products sent back to suppliers at an Inventory Officer's request, and the credits they owe." />

      <Notice notice={notice} onDismiss={() => setNotice(null)} />

      <div className="stats-grid" style={{ margin: '1.5rem 0' }}>
        <StatCard title="Returns" icon={PackageMinus} tone="teal" value={returns.length} chip="Returns to suppliers" />
        <StatCard title="Quantity Returned" icon={Package} tone="cyan" value={returns.reduce((sum, r) => sum + r.qty, 0).toLocaleString()} chip="Units removed from stock" />
        <StatCard title="Supplier Credit" icon={DollarSign} tone="teal" value={formatMoney(returns.reduce((sum, r) => sum + creditOwed(r), 0))} valueStyle={{ color: '#34d399' }} chip="Owed back by suppliers" chipTone="positive" />
      </div>

      <ReturnRequestsPanel requests={requests} isAllBranches={isAllBranches} branchById={branchById} canHandle={canHandle} onApprove={setApproving} onReject={handleReject} onReplace={setReplacing} />

      <div className="section-header" style={{ marginTop: '2.5rem' }}>
        <div>
          <h3>Recorded Returns</h3>
          <p className="page-desc">Stock sent back to suppliers, and the credit each one owes.</p>
        </div>
      </div>

      <div className="table-responsive" style={{ marginTop: '1rem' }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>No</th>
              <th>Date</th>
              {isAllBranches && <th>Branch</th>}
              <th>Batch Number</th>
              <th>Supplier</th>
              <th>Category</th>
              <th>Product Name</th>
              <th>Quantity</th>
              <th>Reason</th>
              <th>Status</th>
              <th>{moneyHeader('Credit Owed')}</th>
            </tr>
          </thead>
          <tbody>
            {returns.map((r, index) => (
              <tr key={r.id}>
                <td>{index + 1}</td>
                <td className="nowrap">{r.date}</td>
                {isAllBranches && <td><BranchTag branch={branchById(r.branchId)} /></td>}
                <td className="font-mono">{r.batch || r.purchaseId}</td>
                <td>{r.supplier}</td>
                <td>{r.category}</td>
                <td className="fw-600">{r.product}</td>
                <td>{r.qty} {r.qty === 1 ? 'unit' : 'units'}</td>
                <td>{r.reason}</td>
                <td>
                  <StatusTag status={supplierReturnStatus(r)} />
                  {r.replacedQty > 0 && <div className="page-desc" style={{ margin: 0 }}>{r.replacedQty} replaced</div>}
                </td>
                <td className="fw-600" style={{ color: '#34d399' }}>{formatAmount(creditOwed(r))}</td>
              </tr>
            ))}
            {returns.length === 0 && <EmptyRow colSpan={isAllBranches ? 11 : 10}>No supplier returns recorded.</EmptyRow>}
          </tbody>
        </table>
      </div>

      {replacing && (
        <ReceiveReplacementModal
          request={replacing}
          branchName={branchById(replacing.branchId)?.name}
          unitCost={unitCostOf(replacing)}
          formatMoney={formatMoney}
          onClose={() => setReplacing(null)}
          onSave={handleReplace}
        />
      )}

      {approving && (
        <SupplierReturnModal
          request={approving}
          heldQty={heldIds.includes(approving.id) ? approving.qty : 0}
          purchases={purchases}
          returnedQty={returnedQtyForPurchase}
          inventory={inventory}
          products={products}
          branchById={branchById}
          formatMoney={formatMoney}
          onClose={() => setApproving(null)}
          onSave={handleApprove}
        />
      )}
    </div>
  )
}
