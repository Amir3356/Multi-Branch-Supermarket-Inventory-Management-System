import { nextId, todayKey } from '../../utils'
import { thunkContext } from '../../redux/thunkHelpers'
import { logAdded } from '../auditLogs/auditLogsSlice'
import { stockAdjusted } from '../inventory/stockSlice'
import { saleAdded } from './salesSlice'

// Records a sale at the chosen branch and takes the quantity out of that branch's stock
export const recordSale = ({ medId, ...data }) => (dispatch, getState) => {
  const { state, money, branchName } = thunkContext(getState)
  const sale = { id: nextId(state.sales, 'SL'), ...data, date: todayKey() }
  dispatch(saleAdded(sale))
  dispatch(stockAdjusted({ medId, branchId: data.branchId, delta: -data.qty }))
  dispatch(logAdded('Sale recorded', 'Sales', sale.id, `${data.qty} × ${data.product} sold to ${data.customer} at ${branchName(data.branchId)} for ${money(data.total)}.`))
  return { sale, message: `Sale ${sale.id} recorded at ${branchName(data.branchId)}: ${data.qty} × ${data.product} for ${money(data.total)}.` }
}
