import { thunkContext } from '../../../redux/thunkHelpers'
import { logAdded } from '../../auditLogs/store/auditLogsSlice'
import { stockAdjusted } from '../../inventory/store/stockSlice'
import { createDamageRecord } from '../model/damageRecord'
import { damageRecorded } from './damagedSlice'

// Damaged stock is written off: it leaves the branch's sellable stock and is kept as a loss record
export const recordDamage = (data) => (dispatch, getState) => {
  const { state, money, branchName } = thunkContext(getState)
  const record = createDamageRecord(state.damaged, data)
  dispatch(damageRecorded(record))
  dispatch(stockAdjusted({ medId: data.medId, branchId: data.branchId, delta: -data.qty }))
  dispatch(logAdded('Damaged item recorded', 'Damaged', record.id, `${data.qty} × ${data.product} written off at ${branchName(data.branchId)} (${data.reason}). Loss ${money(data.lossValue)}.`))
  return `${record.id} recorded: ${data.qty} × ${data.product} removed from ${branchName(data.branchId)} stock (${money(data.lossValue)} loss).`
}
