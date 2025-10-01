import { logAdded } from '../auditLogs/auditLogsSlice'
import { minStockLevelChanged } from './settingsSlice'

// One minimum stock level for every product at all branches
export const saveMinStockLevel = (value) => (dispatch, getState) => {
  const previous = getState().settings.defaultMinStock
  if (value === previous) return
  dispatch(minStockLevelChanged(value))
  dispatch(logAdded('Minimum stock level changed', 'Policy', 'Minimum Stock Level', `Changed from ${previous} to ${value} units for every product at all branches.`))
}
