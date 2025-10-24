import { useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { DollarSign, Package, PackageX, Plus } from 'lucide-react'
import { BranchTag, EmptyRow, Notice, PageHeader, StatCard } from '../components'
import { useBranchScope, useFormatMoney } from '../hooks'
import { selectDamaged } from '../features/damaged/store/damagedSlice'
import { selectInventory } from '../features/inventory/store/selectors'
import { selectCategories } from '../features/inventory/store/productsSlice'
import { recordDamage } from '../features/damaged/store/damagedThunks'
import RecordDamageModal from '../features/damaged/components/RecordDamageModal'
import './DamagedPage.css'

export default function DamagedPage() {
  const dispatch = useDispatch()
  const formatMoney = useFormatMoney()
  const { branches, branchById, isAllBranches, scopeLabel, inScope } = useBranchScope()
  const damaged = useSelector(selectDamaged).filter((d) => inScope(d.branchId))
  const inventory = useSelector(selectInventory)
  const categories = useSelector(selectCategories)
  const [showRecordDamage, setShowRecordDamage] = useState(false)
  const [notice, setNotice] = useState(null)

  const handleRecordDamage = (data) => {
    setNotice({ type: 'success', text: dispatch(recordDamage(data)) })
    setShowRecordDamage(false)
  }

  return (
    <div className="content-section-card">
      <PageHeader title={`Damaged Items · ${scopeLabel}`} description="Products that were physically damaged and can no longer be sold or used.">
        <button className="primary-action-btn" onClick={() => setShowRecordDamage(true)}>
          <Plus size={16} /> Record Damaged Item
        </button>
      </PageHeader>

      <Notice notice={notice} onDismiss={() => setNotice(null)} />

      <div className="stats-grid" style={{ margin: '1.5rem 0' }}>
        <StatCard title="Damaged Records" icon={PackageX} tone="danger" value={damaged.length} chip="Write-offs recorded" />
        <StatCard title="Quantity Damaged" icon={Package} tone="warning" value={damaged.reduce((sum, d) => sum + d.qty, 0).toLocaleString()} chip="Units removed from stock" />
        <StatCard title="Loss Value" icon={DollarSign} tone="danger" value={formatMoney(damaged.reduce((sum, d) => sum + d.lossValue, 0))} valueStyle={{ color: '#fb7185' }} chip="At purchase price" chipTone="negative" />
      </div>

      <div className="table-responsive">
        <table className="data-table">
          <thead>
            <tr>
              <th>No</th>
              <th>Date</th>
              {isAllBranches && <th>Branch</th>}
              <th>Category</th>
              <th>Product Name</th>
              <th>Batch</th>
              <th>Quantity</th>
              <th>Reason</th>
              <th>Loss Value</th>
            </tr>
          </thead>
          <tbody>
            {damaged.map((d, index) => (
              <tr key={d.id}>
                <td>{index + 1}</td>
                <td className="nowrap">{d.date}</td>
                {isAllBranches && <td><BranchTag branch={branchById(d.branchId)} /></td>}
                <td>{d.category}</td>
                <td className="fw-600">{d.product}</td>
                <td><span className="batch-badge">{d.batch}</span></td>
                <td>{d.qty} {d.qty === 1 ? 'unit' : 'units'}</td>
                <td>{d.reason}</td>
                <td className="fw-600 negative-text">{formatMoney(d.lossValue)}</td>
              </tr>
            ))}
            {damaged.length === 0 && <EmptyRow colSpan={isAllBranches ? 9 : 8}>No damaged items recorded.</EmptyRow>}
          </tbody>
        </table>
      </div>

      {showRecordDamage && (
        <RecordDamageModal branches={branches} inventory={inventory} categories={categories} formatMoney={formatMoney} onClose={() => setShowRecordDamage(false)} onSave={handleRecordDamage} />
      )}
    </div>
  )
}
