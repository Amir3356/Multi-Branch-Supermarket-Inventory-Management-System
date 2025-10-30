import { logAdded } from '../../auditLogs/store/auditLogsSlice'
import { expiryWarningDaysChanged, minStockLevelChanged } from './settingsSlice'

// One minimum stock level for every product at all branches
export const saveMinStockLevel = (value) => (dispatch, getState) => {
  const previous = getState().settings.defaultMinStock
  if (value === previous) return
  dispatch(minStockLevelChanged(value))
  dispatch(logAdded('Minimum stock level changed', 'Policy', 'Minimum Stock Level', `Changed from ${previous} to ${value} units for every product at all branches.`))
}

// How close to its expiry date a batch is flagged Expiring Soon, for every product at all branches
export const saveExpiryWarningDays = (value) => (dispatch, getState) => {
  const previous = getState().settings.expiryWarningDays
  if (value === previous) return
  dispatch(expiryWarningDaysChanged(value))
  dispatch(logAdded('Expiring soon window changed', 'Policy', 'Expiring Soon', `Changed from ${previous} to ${value} days for every product at all branches.`))
}
