import { nextId, todayKey } from '../../utils'
import { thunkContext } from '../../redux/thunkHelpers'
import { logAdded } from '../auditLogs/auditLogsSlice'
import { accountAdded, accountRemoved, accountUpdated } from './accountsSlice'
import { IDLE_AFTER_MINUTES, sessionState, sessionsEnded } from './sessionsSlice'

const isSame = (email, other) => email.toLowerCase() === (other || '').toLowerCase()

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

export const saveAccount = (existing, data) => (dispatch, getState) => {
  const { state, branchName } = thunkContext(getState)
  if (existing?.id) {
    dispatch(accountUpdated({ id: existing.id, changes: data }))
    dispatch(logAdded('Account updated', 'Accounts', existing.id, `${data.fullName} (${data.email}) updated: ${data.role}, ${branchName(data.branchId)}, ${data.status}.`))
    return `${data.fullName}'s account was updated.`
  }
  const id = nextId(state.accounts, 'ACC', 3)
  dispatch(accountAdded({ id, ...data, createdAt: todayKey() }))
  dispatch(logAdded('Account created', 'Accounts', id, `${data.role} account for ${data.fullName} (${data.email}) at ${branchName(data.branchId)}, ${data.status}.`))
  return `Account created for ${data.fullName}. They can sign in with ${data.email}.`
}

// The Owner account and the signed-in account can't be deactivated or deleted
const accountGuard = (account, signedInEmail, verb) => {
  if (account.role === 'Owner') return `The Owner account can't be ${verb}.`
  if (isSame(account.email, signedInEmail)) return `You can't ${verb === 'deleted' ? 'delete' : 'deactivate'} the account you are signed in with.`
  return null
}

export const toggleAccountStatus = (account, signedInEmail) => (dispatch) => {
  const error = accountGuard(account, signedInEmail, 'deactivated')
  if (error) return { error }
  const status = account.status === 'Active' ? 'Inactive' : 'Active'
  dispatch(accountUpdated({ id: account.id, changes: { status } }))
  if (status === 'Inactive') dispatch(endSessions((s) => s.email === account.email.toLowerCase(), 'account deactivated'))
  dispatch(logAdded(status === 'Active' ? 'Account activated' : 'Account deactivated', 'Accounts', account.id, `${account.fullName} (${account.email}) is now ${status}.`))
  return { message: status === 'Active' ? `${account.fullName} can sign in again.` : `${account.fullName} can no longer sign in.` }
}

export const deleteAccount = (account, signedInEmail) => (dispatch) => {
  const error = accountGuard(account, signedInEmail, 'deleted')
  if (error) return { error }
  dispatch(accountRemoved(account.id))
  dispatch(endSessions((s) => s.email === account.email.toLowerCase(), 'account deleted'))
  dispatch(logAdded('Account deleted', 'Accounts', account.id, `${account.fullName} (${account.email}) was deleted.`))
  return { message: `${account.fullName}'s account was deleted.` }
}
