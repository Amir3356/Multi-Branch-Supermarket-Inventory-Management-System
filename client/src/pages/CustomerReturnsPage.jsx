import { useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { DollarSign, Package, Plus, Undo2 } from 'lucide-react'
import { BranchTag, EmptyRow, Notice, PageHeader, StatCard, StatusTag } from '../components'
import { useBranchScope, useFormatMoney } from '../hooks'
import { selectSales } from '../features/sales/salesSlice'
import { selectCustomerReturns } from '../features/customerReturns/customerReturnsSlice'
import { recordCustomerReturn } from '../features/customerReturns/customerReturnsThunks'
import CustomerReturnModal from '../features/customerReturns/CustomerReturnModal'

export default function CustomerReturnsPage() {
  const dispatch = useDispatch()
  const formatMoney = useFormatMoney()
  const { branchById, isAllBranches, scopeLabel, inScope } = useBranchScope()
  const sales = useSelector(selectSales)
  const allReturns = useSelector(selectCustomerReturns)
  const returns = allReturns.filter((r) => inScope(r.branchId))
  const [showRecordReturn, setShowRecordReturn] = useState(false)
  const [notice, setNotice] = useState(null)

  const returnedQtyForSale = (saleId) => allReturns.filter((r) => r.saleId === saleId).reduce((sum, r) => sum + r.qty, 0)
  const sumQty = (condition) => returns.filter((r) => r.condition === condition).reduce((sum, r) => sum + r.qty, 0)

  const handleRecordReturn = (data) => {
    setNotice({ type: 'success', text: dispatch(recordCustomerReturn(data)) })
    setShowRecordReturn(false)
  }

  return (
    <div className="content-section-card">
      <PageHeader title={`Customer Returns · ${scopeLabel}`} description="Items customers brought back after a sale, and the refunds given.">
        <button className="primary-action-btn" onClick={() => setShowRecordReturn(true)}>
          <Plus size={16} /> Record Customer Return
        </button>
      </PageHeader>

      <Notice notice={notice} onDismiss={() => setNotice(null)} />

      <div className="stats-grid" style={{ margin: '1.5rem 0' }}>
        <StatCard title="Returns" icon={Undo2} tone="warning" value={returns.length} chip="Customer returns recorded" />
        <StatCard title="Quantity Returned" icon={Package} tone="cyan" value={returns.reduce((sum, r) => sum + r.qty, 0).toLocaleString()} chip={`${sumQty('Resellable')} restocked · ${sumQty('Damaged')} written off`} />
        <StatCard title="Refunds" icon={DollarSign} tone="danger" value={formatMoney(returns.reduce((sum, r) => sum + r.refund, 0))} valueStyle={{ color: '#fb7185' }} chip="Paid back to customers" chipTone="negative" />
      </div>

      <div className="table-responsive">
        <table className="data-table">
          <thead>
            <tr>
              <th>No</th>
              <th>Date</th>
              {isAllBranches && <th>Branch</th>}
              <th>Sale</th>
              <th>Customer</th>
              <th>Category</th>
              <th>Product Name</th>
              <th>Quantity</th>
              <th>Reason</th>
              <th>Stock</th>
              <th>Refund</th>
            </tr>
          </thead>
          <tbody>
            {returns.map((r, index) => (
              <tr key={r.id}>
                <td>{index + 1}</td>
                <td className="nowrap">{r.date}</td>
                {isAllBranches && <td><BranchTag branch={branchById(r.branchId)} /></td>}
                <td className="font-mono">{r.saleId}</td>
                <td>{r.customer}</td>
                <td>{r.category}</td>
                <td className="fw-600">{r.product}</td>
                <td>{r.qty} {r.qty === 1 ? 'unit' : 'units'}</td>
                <td>{r.reason}</td>
                <td><StatusTag status={r.condition === 'Resellable' ? 'Restocked' : 'Written Off'} /></td>
                <td className="fw-600 negative-text">{formatMoney(r.refund)}</td>
              </tr>
            ))}
            {returns.length === 0 && <EmptyRow colSpan={isAllBranches ? 11 : 10}>No customer returns recorded.</EmptyRow>}
          </tbody>
        </table>
      </div>

      {showRecordReturn && (
        <CustomerReturnModal sales={sales} returnedQty={returnedQtyForSale} branchById={branchById} formatMoney={formatMoney} onClose={() => setShowRecordReturn(false)} onSave={handleRecordReturn} />
      )}
    </div>
  )
}
