import { thunkContext } from '../../../redux/thunkHelpers'
import { logAdded } from '../../auditLogs/store/auditLogsSlice'
import { createSupplierReturn } from '../model/supplierReturn'
import { supplierReturnRecorded } from './supplierReturnsSlice'

// Stock sent back to a supplier; the supplier owes a credit for it. The units already left branch stock
// when the Inventory Officer's request held them (see returnRequestsThunks).
export const recordSupplierReturn = ({ requestId, purchase, medId, qty, reason, credit }) => (dispatch, getState) => {
  const { state, money, branchName } = thunkContext(getState)
  const record = createSupplierReturn(state.supplierReturns, { requestId, purchase, medId, qty, reason, credit })
  dispatch(supplierReturnRecorded(record))
  dispatch(logAdded('Supplier return recorded', 'Supplier Returns', record.id, `${qty} × ${purchase.product} sent back to ${purchase.supplier} from ${branchName(purchase.branchId)} (${reason}); credit ${money(credit)}.`))
  return `${record.id} recorded: ${qty} × ${purchase.product} sent back to ${purchase.supplier} from ${branchName(purchase.branchId)}. Supplier credit: ${money(credit)}.`
}
