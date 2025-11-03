import { logAdded } from '../../auditLogs/store/auditLogsSlice'
import { fetchPolicy, updatePolicy } from '../api/policyApi'
import { toPolicyPayload } from '../model/policy'
import { policyLoaded } from './settingsSlice'

// The policy lives on the server, so it is the same for every user, browser and branch

export const loadPolicy = () => async (dispatch) => {
  const { data } = await fetchPolicy()
  dispatch(policyLoaded(data))
}

// Saved on another screen: applied here at once (stock statuses are worked out from it)
export const policyPushed = (policy) => (dispatch) => dispatch(policyLoaded(policy))

// Inventory Officer (Policy page): saves both settings; only the ones that changed are logged. Throws ApiError.
export const savePolicy = ({ minStock, expiryDays }) => async (dispatch, getState) => {
  const previous = getState().settings
  const { policy } = await updatePolicy(toPolicyPayload({ minStock, expiryDays }))
  dispatch(policyLoaded(policy))
  if (policy.defaultMinStock !== previous.defaultMinStock) {
    dispatch(logAdded('Minimum stock level changed', 'Policy', 'Minimum Stock Level', `Changed from ${previous.defaultMinStock} to ${policy.defaultMinStock} units for every product at all branches.`))
  }
  if (policy.expiryWarningDays !== previous.expiryWarningDays) {
    dispatch(logAdded('Expiring soon window changed', 'Policy', 'Expiring Soon', `Changed from ${previous.expiryWarningDays} to ${policy.expiryWarningDays} days for every product at all branches.`))
  }
}
