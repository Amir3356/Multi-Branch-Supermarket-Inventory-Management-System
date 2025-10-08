import { useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { DollarSign, Package, PackageMinus, Plus } from 'lucide-react'
import { BranchTag, EmptyRow, Notice, PageHeader, StatCard } from '../components'
import { useBranchScope, useFormatMoney } from '../hooks'
import { selectPurchases } from '../features/purchases/purchasesSlice'
import { selectSupplierReturns } from '../features/supplierReturns/supplierReturnsSlice'
import { selectInventory } from '../features/inventory/selectors'
import { selectProducts } from '../features/inventory/productsSlice'
import { recordSupplierReturn } from '../features/supplierReturns/supplierReturnsThunks'
import SupplierReturnModal from '../features/supplierReturns/SupplierReturnModal'
import './SupplierReturnsPage.css'

export default function SupplierReturnsPage() {
  const dispatch = useDispatch()
  const formatMoney = useFormatMoney()
  const { branchById, isAllBranches, scopeLabel, inScope } = useBranchScope()
  const purchases = useSelector(selectPurchases)
  const allReturns = useSelector(selectSupplierReturns)
  const returns = allReturns.filter((r) => inScope(r.branchId))
  const inventory = useSelector(selectInventory)
  const products = useSelector(selectProducts)
  const [showSupplierReturn, setShowSupplierReturn] = useState(false)
  const [notice, setNotice] = useState(null)

  const returnedQtyForPurchase = (purchaseId) => allReturns.filter((r) => r.purchaseId === purchaseId).reduce((sum, r) => sum + r.qty, 0)

  const handleSupplierReturn = (data) => {
    setNotice({ type: 'success', text: dispatch(recordSupplierReturn(data)) })
    setShowSupplierReturn(false)
  }

  return (
    <div className="content-section-card">
      <PageHeader title={`Supplier Returns · ${scopeLabel}`} description="Purchased products sent back to suppliers, and the credits they owe.">
        <button className="primary-action-btn" onClick={() => setShowSupplierReturn(true)}>
          <Plus size={16} /> Record Supplier Return
        </button>
      </PageHeader>

      <Notice notice={notice} onDismiss={() => setNotice(null)} />

      <div className="stats-grid" style={{ margin: '1.5rem 0' }}>
        <StatCard title="Returns" icon={PackageMinus} tone="teal" value={returns.length} chip="Returns to suppliers" />
        <StatCard title="Quantity Returned" icon={Package} tone="cyan" value={returns.reduce((sum, r) => sum + r.qty, 0).toLocaleString()} chip="Units removed from stock" />
        <StatCard title="Supplier Credit" icon={DollarSign} tone="teal" value={formatMoney(returns.reduce((sum, r) => sum + r.credit, 0))} valueStyle={{ color: '#34d399' }} chip="Owed back by suppliers" chipTone="positive" />
      </div>

      <div className="table-responsive">
        <table className="data-table">
          <thead>
            <tr>
              <th>No</th>
              <th>Date</th>
              {isAllBranches && <th>Branch</th>}
              <th>Purchase</th>
              <th>Supplier</th>
              <th>Category</th>
              <th>Product Name</th>
              <th>Quantity</th>
              <th>Reason</th>
              <th>Credit</th>
            </tr>
          </thead>
          <tbody>
            {returns.map((r, index) => (
              <tr key={r.id}>
                <td>{index + 1}</td>
                <td className="nowrap">{r.date}</td>
                {isAllBranches && <td><BranchTag branch={branchById(r.branchId)} /></td>}
                <td className="font-mono">{r.purchaseId}</td>
                <td>{r.supplier}</td>
                <td>{r.category}</td>
                <td className="fw-600">{r.product}</td>
                <td>{r.qty} {r.qty === 1 ? 'unit' : 'units'}</td>
                <td>{r.reason}</td>
                <td className="fw-600" style={{ color: '#34d399' }}>{formatMoney(r.credit)}</td>
              </tr>
            ))}
            {returns.length === 0 && <EmptyRow colSpan={isAllBranches ? 10 : 9}>No supplier returns recorded.</EmptyRow>}
          </tbody>
        </table>
      </div>

      {showSupplierReturn && (
        <SupplierReturnModal
          purchases={purchases}
          returnedQty={returnedQtyForPurchase}
          inventory={inventory}
          products={products}
          branchById={branchById}
          formatMoney={formatMoney}
          onClose={() => setShowSupplierReturn(false)}
          onSave={handleSupplierReturn}
        />
      )}
    </div>
  )
}
