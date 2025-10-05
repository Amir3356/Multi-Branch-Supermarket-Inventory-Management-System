import { useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { ArrowLeftRight, CheckCircle2, Package, Plus } from 'lucide-react'
import { BranchTag, Notice, PageHeader, StatCard, StatusTag } from '../components'
import { useBranchScope } from '../hooks'
import { selectTransfers } from '../features/transfers/transfersSlice'
import { selectInventory } from '../features/inventory/selectors'
import { selectCategories, selectProducts } from '../features/inventory/productsSlice'
import { selectSettings } from '../features/policy/settingsSlice'
import { recordTransfer } from '../features/transfers/transfersThunks'
import NewTransferModal from '../features/transfers/NewTransferModal'

export default function StockTransfersPage() {
  const dispatch = useDispatch()
  const { branches, branchById, scopeLabel, inScope } = useBranchScope()
  const transfers = useSelector(selectTransfers).filter((t) => inScope(t.from) || inScope(t.to))
  const inventory = useSelector(selectInventory)
  const products = useSelector(selectProducts)
  const categories = useSelector(selectCategories)
  const { maxTransferQty } = useSelector(selectSettings)
  const [showNewTransfer, setShowNewTransfer] = useState(false)
  const [notice, setNotice] = useState(null)

  const handleTransfer = (data) => {
    setNotice({ type: 'success', text: dispatch(recordTransfer(data)).message })
    setShowNewTransfer(false)
  }

  return (
    <div className="content-section-card">
      <PageHeader title={`Stock Transfers · ${scopeLabel}`} description="Move stock between branches to cover shortages and rebalance expiring batches.">
        <button className="primary-action-btn" onClick={() => setShowNewTransfer(true)}>
          <Plus size={16} /> New Transfer
        </button>
      </PageHeader>

      <Notice notice={notice} onDismiss={() => setNotice(null)} />

      <div className="stats-grid" style={{ margin: '1.5rem 0' }}>
        <StatCard title="Total Transfers" icon={ArrowLeftRight} tone="cyan" value={transfers.length} chipTone="positive" chip={<><CheckCircle2 size={12} /> All completed</>} />
        <StatCard title="Quantity Transferred" icon={Package} tone="teal" value={transfers.reduce((sum, t) => sum + t.qty, 0).toLocaleString()} chip="Moved between branches" />
      </div>

      <div className="table-responsive">
        <table className="data-table">
          <thead>
            <tr>
              <th>Transfer ID</th>
              <th>From</th>
              <th>To</th>
              <th>Category</th>
              <th>Product Name</th>
              <th>Batch</th>
              <th>Quantity</th>
              <th>Date</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {transfers.map((trf) => (
              <tr key={trf.id}>
                <td className="font-mono">{trf.id}</td>
                <td><BranchTag branch={branchById(trf.from)} /></td>
                <td><BranchTag branch={branchById(trf.to)} /></td>
                <td>{products.find((m) => m.name === trf.product)?.category || '—'}</td>
                <td className="fw-600">{trf.product}</td>
                <td><span className="batch-badge">{trf.batch}</span></td>
                <td>{trf.qty} units</td>
                <td>{trf.date}</td>
                <td><StatusTag status={trf.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showNewTransfer && (
        <NewTransferModal branches={branches} inventory={inventory} categories={categories} maxQty={maxTransferQty} onClose={() => setShowNewTransfer(false)} onSave={handleTransfer} />
      )}
    </div>
  )
}
