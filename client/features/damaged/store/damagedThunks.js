import { thunkContext } from '../../../redux/thunkHelpers'
import { stockAdjusted } from '../../inventory/store/stockSlice'
import { createDamageRecord } from '../model/damageRecord'
import { damageRecorded } from './damagedSlice'

// Damaged stock is written off: it leaves the branch's sellable stock and is kept as a loss record
export const recordDamage = (data) => (dispatch, getState) => {
  const { state, money, branchName } = thunkContext(getState)
  const record = createDamageRecord(state.damaged, data)
  dispatch(damageRecorded(record))
  dispatch(stockAdjusted({ medId: data.medId, branchId: data.branchId, batch: data.batch, delta: -data.qty }))
  return `${record.id} recorded: ${data.qty} × ${data.product} removed from ${branchName(data.branchId)} stock (${money(data.lossValue)} loss).`
}
