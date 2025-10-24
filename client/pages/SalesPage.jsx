import { useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { Clock, Package, Plus, Receipt, ShoppingCart, TrendingUp } from 'lucide-react'
import { BranchTag, Notice, PageHeader, StatCard, StatusTag } from '../components'
import { useBranchScope, useFormatMoney } from '../hooks'
import { todayKey } from '../utils'
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
  const { branches, branchById, isAllBranches, scopeLabel, inScope } = useBranchScope()
  const sales = useSelector(selectSales).filter((s) => inScope(s.branchId))
  const customerReturns = useSelector(selectCustomerReturns)
  const inventory = useSelector(selectInventory)
  const categories = useSelector(selectCategories)
  const [showNewSale, setShowNewSale] = useState(false)
  const [notice, setNotice] = useState(null)

  const today = todayKey()
  const salesTotal = sales.reduce((sum, s) => sum + s.total, 0)
  const unitsSold = sales.reduce((sum, s) => sum + s.qty, 0)
  const todaySales = sales.filter((s) => s.date === today)
  const todayTotal = todaySales.reduce((sum, s) => sum + s.total, 0)
  const todayUnits = todaySales.reduce((sum, s) => sum + s.qty, 0)

  // Sales with returns show how much was refunded instead of just "Paid"
  const saleStatus = (sale) => {
    const returned = customerReturns.filter((r) => r.saleId === sale.id).reduce((sum, r) => sum + r.qty, 0)
    if (!returned) return sale.status
    return returned >= sale.qty ? 'Refunded' : 'Partially Refunded'
  }

  const handleRecordSale = (data) => {
    setNotice({ type: 'success', text: dispatch(recordSale(data)).message })
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

      <div className="stats-grid" style={{ margin: '1.5rem 0' }}>
        <StatCard title="Total Sales" icon={Receipt} tone="teal" value={formatMoney(salesTotal)} chipTone="positive" chip={<><TrendingUp size={12} /> {scopeLabel}</>} />
        <StatCard title="Today's Sales" icon={ShoppingCart} tone="cyan" value={formatMoney(todayTotal)} chip={<><Clock size={12} /> {todaySales.length} {todaySales.length === 1 ? 'transaction' : 'transactions'} today</>} />
        <StatCard title="Quantity Sold" icon={Package} tone="warning" value={unitsSold.toLocaleString()} chip={`${todayUnits.toLocaleString()} ${todayUnits === 1 ? 'unit' : 'units'} today`} />
      </div>

      <div className="table-responsive" style={{ marginTop: '1rem' }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>Customer / Prescription</th>
              {isAllBranches && <th>Branch</th>}
              <th>Category</th>
              <th>Product Name</th>
              <th>Items Purchased</th>
              <th>Total Amount</th>
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
                <td className="fw-600">{formatMoney(sale.total)}</td>
                <td>{sale.date}</td>
                <td><StatusTag status={saleStatus(sale)} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showNewSale && (
        <NewSaleModal branches={branches} inventory={inventory} categories={categories} formatMoney={formatMoney} onClose={() => setShowNewSale(false)} onSave={handleRecordSale} />
      )}
    </div>
  )
}
