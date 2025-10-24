import { createAccount, destroyAccount, fetchAccounts, resendAccountInvitation, updateAccount } from '../api/accountsApi'
import { logAdded } from '../../auditLogs/store/auditLogsSlice'
import { accountRemoved, accountSaved, accountsLoaded } from './accountsSlice'
import { toAccountChanges } from '../model/account'
import { loadSessions } from './sessionsThunks'

// Account thunks call the API and return the confirmation message; failures throw ApiError

export const loadAccounts = () => async (dispatch) => {
  const { data } = await fetchAccounts()
  dispatch(accountsLoaded(data))
}

// New accounts start as Pending: the API emails an invitation link to set a password
export const saveAccount = (existing, data) => async (dispatch) => {
  if (existing?.id) {
    const { account, message } = await updateAccount(existing.id, toAccountChanges(existing, data))
    dispatch(accountSaved(account))
    dispatch(logAdded('Account updated', 'Accounts', account.id, `${account.fullName} (${account.email}) updated: ${account.roleLabel}, ${account.branchName}, ${account.status}.`))
    return message
  }
  const { account, message } = await createAccount(data)
  dispatch(accountSaved(account))
  dispatch(logAdded('Account invited', 'Accounts', account.id, `${account.roleLabel} account for ${account.fullName} (${account.email}) at ${account.branchName}; invitation emailed.`))
  return message
}

export const resendInvitation = (account) => async (dispatch) => {
  const { account: updated, message } = await resendAccountInvitation(account.id)
  dispatch(accountSaved(updated))
  dispatch(logAdded('Invitation resent', 'Accounts', account.id, `New invitation emailed to ${account.email}.`))
  return message
}

export const toggleAccountStatus = (account) => async (dispatch) => {
  const status = account.status === 'Active' ? 'Inactive' : 'Active'
  const { account: updated } = await updateAccount(account.id, { status })
  dispatch(accountSaved(updated))
  // The API signs a deactivated user out everywhere; show that in Session Monitoring
  if (status === 'Inactive') dispatch(loadSessions()).catch(() => {})
  dispatch(logAdded(status === 'Active' ? 'Account activated' : 'Account deactivated', 'Accounts', account.id, `${account.fullName} (${account.email}) is now ${status}.`))
  return status === 'Active' ? `${account.fullName} can sign in again.` : `${account.fullName} can no longer sign in and was signed out everywhere.`
}

export const deleteAccount = (account) => async (dispatch) => {
  const { message } = await destroyAccount(account.id)
  dispatch(accountRemoved(account.id))
  dispatch(loadSessions()).catch(() => {})
  dispatch(logAdded('Account deleted', 'Accounts', account.id, `${account.fullName} (${account.email}) was deleted.`))
  return message
}
