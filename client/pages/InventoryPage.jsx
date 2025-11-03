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
import { findCatalogProduct, sameText } from '../utils'
import { editInventoryItem } from '../features/inventory/store/inventoryThunks'
import { addProcurementToStock } from '../features/purchases/store/purchasesThunks'
import { selectTransfers } from '../features/transfers/store/transfersSlice'
import { receiveTransferToStock } from '../features/transfers/store/transfersThunks'
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
  // Paid orders whose stock the branch hasn't added yet: Add Medicine puts them in stock
  const branchProcurements = purchases.filter((p) => p.status === 'Paid' && !p.receivedAt && (addBranchId ? p.branchId === addBranchId : true))
  // …and stock other branches sent here that hasn't been added yet
  const transfers = useSelector(selectTransfers)
  // What Add Medicine can add: paid orders and incoming transfers, in one shape. A transfer's expiry comes with the
  // stock (fixedExpiry), and its cost is the product's purchase price.
  const arrivals = [
    ...branchProcurements.map((p) => ({ ...p, kind: 'procurement', note: `${p.qty} units · ${p.supplier}` })),
    ...transfers
      .filter((t) => t.status === 'Pending' && (addBranchId ? t.to === addBranchId : true))
      .map((t) => {
        const unit = findCatalogProduct(products, t.medId, t.product)?.purchasePrice || 0
        return { ...t, kind: 'transfer', purchasePrice: unit, total: unit * t.qty, fixedExpiry: t.expiry, note: `transfer from ${branchById(t.from)?.name || t.from}` }
      })
  ]
  const [showAddMedicine, setShowAddMedicine] = useState(false)
  const [editingItem, setEditingItem] = useState(null)
  const [returningItem, setReturningItem] = useState(null)
  const returnRequests = useSelector(selectReturnRequests)
  // Only the Inventory Officer asks for supplier returns, for stock at their own branch
  const canRequestReturn = user?.role === 'pharmacist'
  const [notice, setNotice] = useState(null)

  // Adds the order's units to this branch's stock (on the server, so every screen gets them) and sets the selling price;
  // the form shows any error
  const handleSaveMedicine = async (arrival, sellingPrice, packageDetails) => {
    const message = arrival.kind === 'transfer'
      ? await dispatch(receiveTransferToStock(arrival, sellingPrice))
      : await dispatch(addProcurementToStock(arrival, sellingPrice, packageDetails))
    setNotice({ type: 'success', text: message })
    setShowAddMedicine(false)
  }

  // The paid procurements (batches) this row's stock came from
  const batchesFor = (item) => purchases.filter((p) => p.status === 'Paid' && p.branchId === item.branchId && (p.medId ? p.medId === item.medId : sameText(p.product, item.name)))

  // Units each row has on hold for pending supplier return requests (already out of Current Stock)
  const heldByRow = useMemo(() => {
    const held = {}
    // Extra units were never in stock, so they hold nothing
    for (const r of returnRequests.filter((request) => request.status === 'Pending' && !isExtraQuantity(request))) {
      const medId = findCatalogProduct(products, r.medId, r.product)?.id
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
          {/* Only the branch's Inventory Officer adds received stock */}
          {canRequestReturn && (
            <button className="primary-action-btn" onClick={() => setShowAddMedicine(true)}>
              <Plus size={16} /> Add Medicine
            </button>
          )}
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
        <AddMedicineModal arrivals={arrivals} products={products} branchName={addBranchId ? branchById(addBranchId)?.name : 'All Branches'} formatMoney={formatMoney} onClose={() => setShowAddMedicine(false)} onSave={handleSaveMedicine} />
      )}
    </div>
  )
}
