import { thunkContext } from '../../../redux/thunkHelpers'
import { logAdded } from '../../auditLogs/store/auditLogsSlice'
import { stockAdjusted } from '../../inventory/store/stockSlice'
import { createSale } from '../model/sale'
import { saleAdded } from './salesSlice'

// Records a sale at the chosen branch and takes the quantity out of that branch's stock
export const recordSale = ({ medId, ...data }) => (dispatch, getState) => {
  const { state, money, branchName } = thunkContext(getState)
  const sale = createSale(state.sales, data)
  dispatch(saleAdded(sale))
  dispatch(stockAdjusted({ medId, branchId: data.branchId, delta: -data.qty }))
  dispatch(logAdded('Sale recorded', 'Sales', sale.id, `${data.qty} × ${data.product} sold to ${data.customer} at ${branchName(data.branchId)} for ${money(data.total)}.`))
  return { sale, message: `Sale ${sale.id} recorded at ${branchName(data.branchId)}: ${data.qty} × ${data.product} for ${money(data.total)}.` }
}
