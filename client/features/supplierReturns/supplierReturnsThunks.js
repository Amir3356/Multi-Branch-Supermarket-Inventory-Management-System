import { nextId, todayKey } from '../../utils'
import { thunkContext } from '../../redux/thunkHelpers'
import { logAdded } from '../auditLogs/auditLogsSlice'
import { stockAdjusted } from '../inventory/stockSlice'
import { supplierReturnRecorded } from './supplierReturnsSlice'

// Stock sent back to a supplier leaves the branch; the supplier owes a credit for it
export const recordSupplierReturn = ({ purchase, medId, qty, reason, credit }) => (dispatch, getState) => {
  const { state, money, branchName } = thunkContext(getState)
  const record = {
    id: nextId(state.supplierReturns, 'SRT'),
    purchaseId: purchase.id,
    branchId: purchase.branchId,
    supplier: purchase.supplier,
    medId,
    product: purchase.product,
    category: purchase.category,
    qty,
    reason,
    credit,
    date: todayKey()
  }
  dispatch(supplierReturnRecorded(record))
  dispatch(stockAdjusted({ medId, branchId: purchase.branchId, delta: -qty }))
  dispatch(logAdded('Supplier return recorded', 'Supplier Returns', record.id, `${qty} × ${purchase.product} sent back to ${purchase.supplier} from ${branchName(purchase.branchId)} (${reason}); credit ${money(credit)}.`))
  return `${record.id} recorded: ${qty} × ${purchase.product} sent back to ${purchase.supplier} from ${branchName(purchase.branchId)}. Supplier credit: ${money(credit)}.`
}
