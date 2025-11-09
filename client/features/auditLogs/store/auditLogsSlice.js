import { createSlice } from '@reduxjs/toolkit'
import { nextId, timeKey, toDateKey } from '../../../utils'

const AUDIT_LOGS = []

export const AUDIT_MODULES = ['Accounts', 'Sales', 'Purchase', 'Stock Transfers', 'Damaged', 'Expenses', 'Inventory', 'Branches', 'Policy']

// Read-only history of important actions
const auditLogsSlice = createSlice({
  name: 'auditLogs',
  initialState: AUDIT_LOGS,
  reducers: {
    logAdded: {
      reducer(state, action) {
        state.unshift({ id: nextId(state, 'LOG', 4), ...action.payload })
      },
      // The date and time are stamped when the action happens
      prepare(action, module, record, description) {
        const now = new Date()
        return { payload: { date: toDateKey(now), time: timeKey(now), action, module, record, description } }
      }
    }
  }
})

export const { logAdded } = auditLogsSlice.actions
export const selectAuditLogs = (state) => state.auditLogs
export default auditLogsSlice.reducer
