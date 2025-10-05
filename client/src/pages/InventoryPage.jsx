import { useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { Plus } from 'lucide-react'
import { Notice } from '../components'
import { useBranchScope, useFormatMoney } from '../hooks'
import { selectInventory } from '../features/inventory/selectors'
import { selectCategories, selectProducts } from '../features/inventory/productsSlice'
import { deleteInventoryItem, editInventoryItem, saveMedicinePrices } from '../features/inventory/inventoryThunks'
import InventoryTable from '../features/inventory/InventoryTable'
import EditInventoryModal from '../features/inventory/EditInventoryModal'
import AddMedicineModal from '../features/inventory/AddMedicineModal'

export default function InventoryPage() {
  const dispatch = useDispatch()
  const formatMoney = useFormatMoney()
  const { branches, branchById, isAllBranches, currentBranch, scopeLabel, inScope } = useBranchScope()
  const inventory = useSelector(selectInventory)
  const products = useSelector(selectProducts)
  const categories = useSelector(selectCategories)
  const [showAddMedicine, setShowAddMedicine] = useState(false)
  const [editingItem, setEditingItem] = useState(null)
  const [notice, setNotice] = useState(null)

  const handleSaveMedicine = (data) => {
    setNotice({ type: 'success', text: dispatch(saveMedicinePrices(data)) })
    setShowAddMedicine(false)
  }

  const handleEdit = (data) => {
    setNotice({ type: 'success', text: dispatch(editInventoryItem(editingItem, data)) })
    setEditingItem(null)
  }

  const handleDelete = (item) => {
    if (item.stock === 0 && !window.confirm(`Remove ${item.name} from ${branchById(item.branchId)?.name}'s inventory? The product stays available at other branches.`)) return
    const result = dispatch(deleteInventoryItem(item))
    setNotice(result.error ? { type: 'error', text: result.error } : { type: 'success', text: result.message })
  }

  return (
    <div className="content-section-card">
      <div className="section-header">
        <div style={{ flex: 1, textAlign: 'center' }}>
          <h2 className="page-title" style={{ textAlign: 'center' }}>Medicine Inventory · {scopeLabel}</h2>
          {!isAllBranches && (
            <p className="page-desc" style={{ textAlign: 'center' }}>
              Current pharmaceutical products and quantities held at {currentBranch?.name}.
            </p>
          )}
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <button className="primary-action-btn" onClick={() => setShowAddMedicine(true)}>
            <Plus size={16} /> Add Medicine
          </button>
        </div>
      </div>

      <Notice notice={notice} onDismiss={() => setNotice(null)} />

      <InventoryTable
        data={inventory.filter((item) => inScope(item.branchId))}
        branches={branches}
        categories={categories}
        showBranch={isAllBranches}
        formatMoney={formatMoney}
        onEdit={setEditingItem}
        onDelete={handleDelete}
      />

      {editingItem && (
        <EditInventoryModal item={editingItem} branchName={branchById(editingItem.branchId)?.name} onClose={() => setEditingItem(null)} onSave={handleEdit} />
      )}
      {showAddMedicine && (
        <AddMedicineModal products={products} categories={categories} formatMoney={formatMoney} onClose={() => setShowAddMedicine(false)} onSave={handleSaveMedicine} />
      )}
    </div>
  )
}
