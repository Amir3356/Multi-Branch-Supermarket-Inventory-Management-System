import { api } from '../../api/http'
import { logAdded } from '../auditLogs/auditLogsSlice'
import { accountRemoved, accountSaved, accountsLoaded } from './accountsSlice'
import { loadSessions } from './sessionsThunks'

// Account thunks call the API and return the confirmation message; failures throw ApiError

export const loadAccounts = () => async (dispatch) => {
  const { data } = await api('/accounts')
  dispatch(accountsLoaded(data))
}

// New accounts start as Pending: the API emails an invitation link to set a password
export const saveAccount = (existing, data) => async (dispatch) => {
  if (existing?.id) {
    const changes = { fullName: data.fullName, email: data.email, role: data.role, branchId: data.branchId }
    if (existing.status !== 'Pending') changes.status = data.status
    const { account, message } = await api(`/accounts/${existing.id}`, { method: 'PATCH', body: changes })
    dispatch(accountSaved(account))
    dispatch(logAdded('Account updated', 'Accounts', account.id, `${account.fullName} (${account.email}) updated: ${account.roleLabel}, ${account.branchName}, ${account.status}.`))
    return message
  }
  const { account, message } = await api('/accounts', { method: 'POST', body: data })
  dispatch(accountSaved(account))
  dispatch(logAdded('Account invited', 'Accounts', account.id, `${account.roleLabel} account for ${account.fullName} (${account.email}) at ${account.branchName}; invitation emailed.`))
  return message
}

export const resendInvitation = (account) => async (dispatch) => {
  const { account: updated, message } = await api(`/accounts/${account.id}/resend-invitation`, { method: 'POST' })
  dispatch(accountSaved(updated))
  dispatch(logAdded('Invitation resent', 'Accounts', account.id, `New invitation emailed to ${account.email}.`))
  return message
}

export const toggleAccountStatus = (account) => async (dispatch) => {
  const status = account.status === 'Active' ? 'Inactive' : 'Active'
  const { account: updated } = await api(`/accounts/${account.id}`, { method: 'PATCH', body: { status } })
  dispatch(accountSaved(updated))
  // The API signs a deactivated user out everywhere; show that in Session Monitoring
  if (status === 'Inactive') dispatch(loadSessions()).catch(() => {})
  dispatch(logAdded(status === 'Active' ? 'Account activated' : 'Account deactivated', 'Accounts', account.id, `${account.fullName} (${account.email}) is now ${status}.`))
  return status === 'Active' ? `${account.fullName} can sign in again.` : `${account.fullName} can no longer sign in and was signed out everywhere.`
}

export const deleteAccount = (account) => async (dispatch) => {
  const { message } = await api(`/accounts/${account.id}`, { method: 'DELETE' })
  dispatch(accountRemoved(account.id))
  dispatch(loadSessions()).catch(() => {})
  dispatch(logAdded('Account deleted', 'Accounts', account.id, `${account.fullName} (${account.email}) was deleted.`))
  return message
}
