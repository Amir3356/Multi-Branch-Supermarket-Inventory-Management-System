import { nextId, todayKey } from '../../../utils'

// A sale as kept in the store: { id, branchId, customer, category, product, qty, total, status, date }
export const createSale = (existingSales, data) => ({ id: nextId(existingSales, 'SL'), ...data, date: todayKey() })
