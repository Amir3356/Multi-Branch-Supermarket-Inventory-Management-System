import { useCallback, useMemo, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { Plus } from 'lucide-react'
import { Notice } from '../components'
import { useBranchScope, useFormatMoney } from '../hooks'
import { selectInventory } from '../features/inventory/store/selectors'
import { selectCategories, selectProducts } from '../features/inventory/store/productsSlice'
import { selectCurrentUser } from '../features/auth/store/authSlice'
import { selectPurchases } from '../features/purchases/store/purchasesSlice'
import { selectReturnRequests } from '../features/supplierReturns/store/returnRequestsSlice'
import { sendReturnRequest } from '../features/supplierReturns/store/returnRequestsThunks'
import ReturnRequestModal from '../features/supplierReturns/components/ReturnRequestModal'
import { isExtraQuantity } from '../features/supplierReturns/model/returnRequest'
import { sameText } from '../utils'
import { deleteInventoryItem, editInventoryItem, saveMedicinePrices } from '../features/inventory/store/inventoryThunks'
import InventoryTable from '../features/inventory/components/InventoryTable'
import EditInventoryModal from '../features/inventory/components/EditInventoryModal'
import AddMedicineModal from '../features/inventory/components/AddMedicineModal'
import './InventoryPage.css'

export default function InventoryPage() {
  const dispatch = useDispatch()
  const formatMoney = useFormatMoney()
  const { branches, branchById, isAllBranches, currentBranch, scopeLabel, inScope } = useBranchScope()
  const inventory = useSelector(selectInventory)
  const products = useSelector(selectProducts)
  const categories = useSelector(selectCategories)
  const user = useSelector(selectCurrentUser)
  const purchases = useSelector(selectPurchases)
  // Staff work at their assigned branch; the Owner at the branch picked in the header
  const staffBranchId = user?.branchId && user.branchId !== 'all' ? user.branchId : null
  const addBranchId = staffBranchId || (isAllBranches ? null : currentBranch?.id)
  // Stock arrives once a procurement is Paid, so only those can be set up for sale
  const branchProcurements = purchases.filter((p) => p.status === 'Paid' && (addBranchId ? p.branchId === addBranchId : true))
  const [showAddMedicine, setShowAddMedicine] = useState(false)
  const [editingItem, setEditingItem] = useState(null)
  const [returningItem, setReturningItem] = useState(null)
  const returnRequests = useSelector(selectReturnRequests)
  // Only the Inventory Officer asks for supplier returns, for stock at their own branch
  const canRequestReturn = user?.role === 'pharmacist'
  const [notice, setNotice] = useState(null)

  const handleSaveMedicine = (data) => {
    setNotice({ type: 'success', text: dispatch(saveMedicinePrices(data)) })
    setShowAddMedicine(false)
  }

  // The paid procurements (batches) this row's stock came from
  const batchesFor = (item) => purchases.filter((p) => p.status === 'Paid' && p.branchId === item.branchId && (p.medId === item.medId || sameText(p.product, item.name)))

  // Units each row has on hold for pending supplier return requests (already out of Current Stock)
  const heldByRow = useMemo(() => {
    const held = {}
    // Extra units were never in stock, so they hold nothing
    for (const r of returnRequests.filter((request) => request.status === 'Pending' && !isExtraQuantity(request))) {
      const medId = products.find((p) => p.id === r.medId || sameText(p.name, r.product))?.id
      const key = `${medId}-${r.branchId}`
      held[key] = (held[key] || 0) + r.qty
    }
    return held
  }, [returnRequests, products])
  const heldQty = useCallback((item) => heldByRow[item.key] || 0, [heldByRow])

  const handleRequestReturn = async (payload) => {
    const message = await dispatch(sendReturnRequest(payload))
    setNotice({ type: 'success', text: message })
    setReturningItem(null)
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
        heldQty={heldQty}
        onEdit={setEditingItem}
        onDelete={handleDelete}
        onRequestReturn={canRequestReturn ? setReturningItem : undefined}
        returnBranchId={staffBranchId}
      />

      {editingItem && (
        <EditInventoryModal item={editingItem} branchName={branchById(editingItem.branchId)?.name} formatMoney={formatMoney} onClose={() => setEditingItem(null)} onSave={handleEdit} />
      )}
      {returningItem && (
        <ReturnRequestModal
          item={returningItem}
          branchName={branchById(returningItem.branchId)?.name}
          batches={batchesFor(returningItem)}
          requests={returnRequests}
          onClose={() => setReturningItem(null)}
          onSave={handleRequestReturn}
        />
      )}

      {showAddMedicine && (
        <AddMedicineModal procurements={branchProcurements} products={products} branchName={addBranchId ? branchById(addBranchId)?.name : 'All Branches'} formatMoney={formatMoney} onClose={() => setShowAddMedicine(false)} onSave={handleSaveMedicine} />
      )}
    </div>
  )
}
