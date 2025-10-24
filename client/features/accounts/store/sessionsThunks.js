import { destroySession, endSessionRequest, fetchSessions } from '../api/sessionsApi'
import { sessionFromApi } from '../model/session'
import { logAdded } from '../../auditLogs/store/auditLogsSlice'
import { sessionRemoved, sessionSaved, sessionsLoaded } from './sessionsSlice'

export const loadSessions = () => async (dispatch) => {
  const { data, meta } = await fetchSessions()
  dispatch(sessionsLoaded({ items: data.map(sessionFromApi), idleAfterMinutes: meta.idleAfterMinutes, signOutAfterMinutes: meta.signOutAfterMinutes }))
}

// Signs the person out on that device: their next request is rejected and they land on the login page
export const endSession = (session) => async (dispatch) => {
  const { session: updated, message } = await endSessionRequest(session.id)
  dispatch(sessionSaved(sessionFromApi(updated)))
  dispatch(logAdded('Session ended', 'Accounts', String(session.id), `${session.email} signed out on ${session.device} (ended by the Owner).`))
  return message
}

export const deleteSession = (session) => async (dispatch) => {
  const { message } = await destroySession(session.id)
  dispatch(sessionRemoved(session.id))
  dispatch(logAdded('Session removed', 'Accounts', String(session.id), `${session.email}'s session on ${session.device} was removed.`))
  return message
}
