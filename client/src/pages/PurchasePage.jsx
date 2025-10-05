import { useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { Plus } from 'lucide-react'
import { BranchTag, Notice, PageHeader, StatusTag } from '../components'
import { useBranchScope, useFormatMoney } from '../hooks'
import { selectPurchases, selectSupplierPayments } from '../features/purchases/purchasesSlice'
import { selectSupplierReturns } from '../features/supplierReturns/supplierReturnsSlice'
import { selectInventory } from '../features/inventory/selectors'
import { selectCategories, selectProducts } from '../features/inventory/productsSlice'
import { createPurchase } from '../features/purchases/purchasesThunks'
import NewPurchaseModal from '../features/purchases/NewPurchaseModal'

export default function PurchasePage() {
  const dispatch = useDispatch()
  const formatMoney = useFormatMoney()
  const { branches, branchById, isAllBranches, scopeLabel, inScope } = useBranchScope()
  const allPurchases = useSelector(selectPurchases)
  const purchases = allPurchases.filter((p) => inScope(p.branchId))
  const payments = useSelector(selectSupplierPayments).filter((p) => inScope(p.branchId))
  const supplierReturns = useSelector(selectSupplierReturns)
  const inventory = useSelector(selectInventory)
  const products = useSelector(selectProducts)
  const categories = useSelector(selectCategories)
  const [showNewPurchase, setShowNewPurchase] = useState(false)
  const [notice, setNotice] = useState(null)

  // Purchases with stock sent back show how much was returned instead of just "Paid"
  const purchaseStatus = (po) => {
    const returned = supplierReturns.filter((r) => r.purchaseId === po.id).reduce((sum, r) => sum + r.qty, 0)
    if (!returned) return po.status
    return returned >= po.qty ? 'Returned' : 'Partially Returned'
  }

  const handleCreatePurchase = (data) => {
    setNotice({ type: 'success', text: dispatch(createPurchase(data)).message })
    setShowNewPurchase(false)
  }

  return (
    <div className="content-section-card">
      <PageHeader title={`Purchase · ${scopeLabel}`} description="Generate purchase orders to distributors and receive incoming stock into a specific branch.">
        <button className="primary-action-btn" onClick={() => setShowNewPurchase(true)}>
          <Plus size={16} /> Create Purchase
        </button>
      </PageHeader>

      <Notice notice={notice} onDismiss={() => setNotice(null)} />

      <div className="table-responsive" style={{ marginTop: '1.5rem' }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>Supplier</th>
              {isAllBranches && <th>Receiving Branch</th>}
              <th>Category</th>
              <th>Product Name</th>
              <th>Quantity</th>
              <th>Total Cost</th>
              <th>Purchased On</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {purchases.map((po) => (
              <tr key={po.id}>
                <td className="fw-600">{po.supplier}</td>
                {isAllBranches && <td><BranchTag branch={branchById(po.branchId)} /></td>}
                <td>{po.category}</td>
                <td className="fw-600">{po.product}</td>
                <td>{po.qty.toLocaleString()} units</td>
                <td className="fw-600">{formatMoney(po.total)}</td>
                <td>{po.date}</td>
                <td><StatusTag status={purchaseStatus(po)} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Supplier payments */}
      <div style={{ marginTop: '2.5rem' }}>
        <div className="section-header">
          <div>
            <h3>Payment & Transaction History</h3>
            <p className="page-desc">Supplier settlement history and payment transaction records.</p>
          </div>
        </div>

        <div className="table-responsive" style={{ marginTop: '1rem' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Transaction Ref</th>
                {isAllBranches && <th>Branch</th>}
                <th>Supplier</th>
                <th>Category</th>
                <th>Product Name</th>
                <th>Payment Method</th>
                <th>Amount Paid</th>
                <th>Transaction Date</th>
                <th>Payment Status</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((txn) => {
                // Category and product come from the purchase this payment settles
                const purchase = allPurchases.find((p) => p.id === txn.purchaseId)
                return (
                  <tr key={txn.id}>
                    <td className="font-mono">{txn.id}</td>
                    {isAllBranches && <td><BranchTag branch={branchById(txn.branchId)} /></td>}
                    <td className="fw-600">{txn.supplier}</td>
                    <td>{purchase?.category || '—'}</td>
                    <td className="fw-600">{purchase?.product || '—'}</td>
                    <td><span className="batch-badge">{txn.method}</span></td>
                    <td className="fw-600">{formatMoney(txn.amount)}</td>
                    <td>{txn.date}</td>
                    <td><StatusTag status={txn.status} /></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {showNewPurchase && (
        <NewPurchaseModal
          branches={branches}
          inventory={inventory}
          products={products}
          categories={categories}
          suppliers={[...new Set(allPurchases.map((p) => p.supplier))].sort()}
          formatMoney={formatMoney}
          onClose={() => setShowNewPurchase(false)}
          onSave={handleCreatePurchase}
        />
      )}
    </div>
  )
}
