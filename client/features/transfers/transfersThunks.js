import { nextId, todayKey } from '../../utils'
import { thunkContext } from '../../redux/thunkHelpers'
import { logAdded } from '../auditLogs/auditLogsSlice'
import { stockAdjusted, stockReceived } from '../inventory/stockSlice'
import { transferAdded } from './transfersSlice'

// A transfer completes immediately and moves the stock between the two branches
export const recordTransfer = ({ medId, expiry, ...data }) => (dispatch, getState) => {
  const { state, branchName } = thunkContext(getState)
  const transfer = { id: nextId(state.transfers, 'TRF'), ...data, date: todayKey(), status: 'Completed' }
  dispatch(transferAdded(transfer))
  dispatch(stockAdjusted({ medId, branchId: data.from, delta: -data.qty }))
  dispatch(stockReceived({ medId, branchId: data.to, qty: data.qty, batch: data.batch, expiry }))
  dispatch(logAdded('Stock transferred', 'Stock Transfers', transfer.id, `${data.qty} × ${data.product} moved from ${branchName(data.from)} to ${branchName(data.to)}.`))
  return { transfer, message: `Transfer ${transfer.id} completed: ${data.qty} × ${data.product} moved from ${branchName(data.from)} to ${branchName(data.to)}.` }
}
