import { nextId, todayKey } from '../../../utils'

// A transfer completes immediately: { id, from, to, product, batch, qty, date, status }
export const createTransfer = (existingTransfers, data) => ({ id: nextId(existingTransfers, 'TRF'), ...data, date: todayKey(), status: 'Completed' })
