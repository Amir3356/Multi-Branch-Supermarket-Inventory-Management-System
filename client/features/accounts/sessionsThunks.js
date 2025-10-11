import { api } from '../../api/http'
import { logAdded } from '../auditLogs/auditLogsSlice'
import { sessionRemoved, sessionSaved, sessionsLoaded } from './sessionsSlice'

const toMs = (iso) => (iso ? new Date(iso).getTime() : null)
const fromApi = (s) => ({ ...s, signedInAt: toMs(s.signedInAt), lastActiveAt: toMs(s.lastActiveAt), endedAt: toMs(s.endedAt) })

export const loadSessions = () => async (dispatch) => {
  const { data, meta } = await api('/sessions')
  dispatch(sessionsLoaded({ items: data.map(fromApi), idleAfterMinutes: meta.idleAfterMinutes, signOutAfterMinutes: meta.signOutAfterMinutes }))
}

// Signs the person out on that device: their next request is rejected and they land on the login page
export const endSession = (session) => async (dispatch) => {
  const { session: updated, message } = await api(`/sessions/${session.id}/end`, { method: 'POST' })
  dispatch(sessionSaved(fromApi(updated)))
  dispatch(logAdded('Session ended', 'Accounts', String(session.id), `${session.email} signed out on ${session.device} (ended by the Owner).`))
  return message
}

export const deleteSession = (session) => async (dispatch) => {
  const { message } = await api(`/sessions/${session.id}`, { method: 'DELETE' })
  dispatch(sessionRemoved(session.id))
  dispatch(logAdded('Session removed', 'Accounts', String(session.id), `${session.email}'s session on ${session.device} was removed.`))
  return message
}
