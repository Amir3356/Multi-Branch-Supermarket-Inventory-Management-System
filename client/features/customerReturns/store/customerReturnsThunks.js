import { roundMoney, yearsFromToday } from '../../../utils'
import { thunkContext } from '../../../redux/thunkHelpers'
import { logAdded } from '../../auditLogs/store/auditLogsSlice'
import { createDamageRecord } from '../../damaged/model/damageRecord'
import { damageRecorded } from '../../damaged/store/damagedSlice'
import { stockReceived } from '../../inventory/store/stockSlice'
import { createCustomerReturn } from '../model/customerReturn'
import { customerReturnRecorded } from './customerReturnsSlice'

// Resellable returns go back on the shelf; damaged returns are written off on the Damaged page
export const recordCustomerReturn = ({ sale, qty, reason, condition, refund }) => (dispatch, getState) => {
  const { state, money, branchName } = thunkContext(getState)
  const product = state.products.items.find((m) => m.name === sale.product)
  const stockEntry = state.stock.find((e) => e.medId === product?.id && e.branchId === sale.branchId)
  const record = createCustomerReturn(state.customerReturns, { sale, product, stockEntry, qty, reason, condition, refund })
  dispatch(customerReturnRecorded(record))
  if (condition === 'Resellable') {
    // If the branch had no stock row for this product, the return starts one
    dispatch(stockReceived({ medId: product?.id, branchId: sale.branchId, qty, batch: record.id, expiry: yearsFromToday(1) }))
  } else {
    dispatch(damageRecorded(createDamageRecord(state.damaged, {
      branchId: sale.branchId,
      medId: product?.id,
      product: sale.product,
      category: sale.category,
      batch: record.batch,
      qty,
      reason: `Customer return (${record.id})`,
      lossValue: roundMoney(qty * (product?.purchasePrice || 0)),
      date: record.date
    })))
  }
  dispatch(logAdded('Customer return recorded', 'Customer Returns', record.id, `${qty} × ${sale.product} returned from sale ${sale.id} at ${branchName(sale.branchId)} (${reason}); ${money(refund)} refunded, ${condition === 'Resellable' ? 'restocked' : 'written off'}.`))
  return `${record.id} recorded: ${qty} × ${sale.product} returned to ${branchName(sale.branchId)}, ${money(refund)} refunded. ${condition === 'Resellable' ? 'Units are back in stock.' : 'Units were written off as damaged.'}`
}
