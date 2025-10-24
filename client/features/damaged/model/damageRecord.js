import { nextId, todayKey } from '../../../utils'

// A write-off: { id, branchId, medId, product, category, batch, qty, reason, lossValue, date }
export const createDamageRecord = (existingRecords, data) => ({ id: nextId(existingRecords, 'DMG'), ...data, date: data.date ?? todayKey() })
