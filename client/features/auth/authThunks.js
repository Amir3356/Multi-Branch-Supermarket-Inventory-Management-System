import { api } from '../../api/http'
import { loggedIn, loggedOut, sessionEnded, userRefreshed } from './authSlice'

// Each thunk returns the signed-in user, or throws ApiError for the page to show

export const signIn = (email, password) => async (dispatch) => {
  const session = await api('/auth/login', { method: 'POST', body: { email, password } })
  dispatch(loggedIn(session))
  return session.user
}

export const fetchInvitation = (token) => () => api(`/invitations/${encodeURIComponent(token)}`)

// Sets the password from the invitation link and signs the new user straight in
export const acceptInvitation = (token, password, passwordConfirmation) => async (dispatch, getState) => {
  const session = await api(`/invitations/${encodeURIComponent(token)}/accept`, {
    method: 'POST',
    body: { password, password_confirmation: passwordConfirmation }
  })
  return startSession(session, dispatch, getState)
}

// After accepting an invitation or resetting a password: sign in and return the user
const startSession = async (session, dispatch, getState) => {
  // Someone else was signed in on this browser: end their session first
  if (getState().auth.token) await api('/auth/logout', { method: 'POST' }).catch(() => {})
  dispatch(loggedIn(session))
  return session.user
}

export const requestPasswordReset = (email) => () =>
  api('/auth/forgot-password', { method: 'POST', body: { email } })

// Sets the new password and signs straight in (every old session is signed out by the server)
export const resetPassword = ({ token, email, password, passwordConfirmation }) => async (dispatch, getState) => {
  const session = await api('/auth/reset-password', {
    method: 'POST',
    body: { token, email, password, password_confirmation: passwordConfirmation }
  })
  return startSession(session, dispatch, getState)
}

export const refreshCurrentUser = () => async (dispatch) => {
  const { data } = await api('/auth/me')
  dispatch(userRefreshed(data))
  return data
}

// The browser wasn't used for the session timeout: end the session on the server, then show why
export const signOutAfterInactivity = () => async (dispatch) => {
  await api('/auth/logout', { method: 'POST', body: { reason: 'inactivity' } }).catch(() => {})
  dispatch(sessionEnded('Signed out after inactivity'))
}

export const signOut = () => async (dispatch) => {
  try {
    await api('/auth/logout', { method: 'POST' })
  } catch {
    // Already signed out on the server (expired token); clear this browser anyway
  }
  dispatch(loggedOut())
}
