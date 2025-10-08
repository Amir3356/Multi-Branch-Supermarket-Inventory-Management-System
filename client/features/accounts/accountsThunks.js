import { api } from '../../api/http'
import { logAdded } from '../auditLogs/auditLogsSlice'
import { accountRemoved, accountSaved, accountsLoaded } from './accountsSlice'
import { IDLE_AFTER_MINUTES, sessionState, sessionsEnded } from './sessionsSlice'

// Account thunks call the API and return the confirmation message; failures throw ApiError

export const loadAccounts = () => async (dispatch) => {
  const { data } = await api('/accounts')
  dispatch(accountsLoaded(data))
}

// New accounts start as Pending: the API emails an invitation link to set a password
export const saveAccount = (existing, data) => async (dispatch) => {
  if (existing?.id) {
    const changes = { fullName: data.fullName, role: data.role, branchId: data.branchId }
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
  if (status === 'Inactive') dispatch(endSessions((s) => s.email === account.email.toLowerCase(), 'account deactivated'))
  dispatch(logAdded(status === 'Active' ? 'Account activated' : 'Account deactivated', 'Accounts', account.id, `${account.fullName} (${account.email}) is now ${status}.`))
  return status === 'Active' ? `${account.fullName} can sign in again.` : `${account.fullName} can no longer sign in and was signed out everywhere.`
}

export const deleteAccount = (account) => async (dispatch) => {
  const { message } = await api(`/accounts/${account.id}`, { method: 'DELETE' })
  dispatch(accountRemoved(account.id))
  dispatch(endSessions((s) => s.email === account.email.toLowerCase(), 'account deleted'))
  dispatch(logAdded('Account deleted', 'Accounts', account.id, `${account.fullName} (${account.email}) was deleted.`))
  return message
}

// Ends every open session (except this device's) that matches; returns how many ended
export const endSessions = (shouldEnd, reason) => (dispatch, getState) => {
  const ended = getState().sessions.filter((s) => s.status !== 'Ended' && !s.current && shouldEnd(s))
  if (!ended.length) return 0
  dispatch(sessionsEnded({ ids: ended.map((s) => s.id), at: Date.now() }))
  ended.forEach((s) => dispatch(logAdded('Session ended', 'Accounts', s.id, `${s.email} signed out on ${s.device} (${reason}).`)))
  return ended.length
}

export const endIdleSessions = () => (dispatch) => {
  const now = Date.now()
  return dispatch(endSessions((s) => sessionState(s, now) === 'Idle', `idle for more than ${IDLE_AFTER_MINUTES} minutes`))
}
