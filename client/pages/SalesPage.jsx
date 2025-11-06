import { useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { Plus } from 'lucide-react'
import { BranchTag, Notice, PageHeader, StatusTag } from '../components'
import { useBranchScope, useFormatMoney, useMoneyColumns } from '../hooks'
import { selectSales } from '../features/sales/store/salesSlice'
import { selectCustomerReturns } from '../features/customerReturns/store/customerReturnsSlice'
import { selectInventory } from '../features/inventory/store/selectors'
import { selectCategories } from '../features/inventory/store/productsSlice'
import { recordSale } from '../features/sales/store/salesThunks'
import NewSaleModal from '../features/sales/components/NewSaleModal'
import './SalesPage.css'

export default function SalesPage() {
  const dispatch = useDispatch()
  const formatMoney = useFormatMoney()
  const { moneyHeader, formatAmount } = useMoneyColumns()
  const { branches, branchById, isAllBranches, scopeLabel, inScope } = useBranchScope()
  const sales = useSelector(selectSales).filter((s) => inScope(s.branchId))
  const customerReturns = useSelector(selectCustomerReturns)
  const inventory = useSelector(selectInventory)
  const categories = useSelector(selectCategories)
  const [showNewSale, setShowNewSale] = useState(false)
  const [notice, setNotice] = useState(null)

  // Sales with returns show how much was refunded instead of just "Paid"
  const saleStatus = (sale) => {
    const returned = customerReturns.filter((r) => r.saleId === sale.id).reduce((sum, r) => sum + r.qty, 0)
    if (!returned) return sale.status
    return returned >= sale.qty ? 'Refunded' : 'Partially Refunded'
  }

  const handleRecordSale = async (data) => {
    // Saved on the server; the form shows any error
    const { message } = await dispatch(recordSale(data))
    setNotice({ type: 'success', text: message })
    setShowNewSale(false)
  }

  return (
    <div className="content-section-card">
      <PageHeader title={`Sales History · ${scopeLabel}`} description="Record of pharmacy sales transactions, receipts, and customer purchase logs per branch.">
        <button className="primary-action-btn" onClick={() => setShowNewSale(true)}>
          <Plus size={16} /> New Sale Transaction
        </button>
      </PageHeader>

      <Notice notice={notice} onDismiss={() => setNotice(null)} />

      <div className="table-responsive" style={{ marginTop: '1rem' }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>Customer / Prescription</th>
              {isAllBranches && <th>Branch</th>}
              <th>Category</th>
              <th>Product Name</th>
              <th>Items Purchased</th>
              <th>{moneyHeader('Total Amount')}</th>
              <th>Date Sold</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {sales.map((sale) => (
              <tr key={sale.id}>
                <td className="fw-600">{sale.customer}</td>
                {isAllBranches && <td><BranchTag branch={branchById(sale.branchId)} /></td>}
                <td>{sale.category}</td>
                <td className="fw-600">{sale.product}</td>
                <td>{sale.qty} {sale.qty === 1 ? 'unit' : 'units'}</td>
                <td className="fw-600">{formatAmount(sale.total)}</td>
                <td>{sale.date}</td>
                <td><StatusTag status={saleStatus(sale)} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showNewSale && (
        <NewSaleModal branches={branches.filter((b) => inScope(b.id))} inventory={inventory.filter((i) => inScope(i.branchId))} categories={categories} formatMoney={formatMoney} onClose={() => setShowNewSale(false)} onSave={handleRecordSale} />
      )}
    </div>
  )
}
