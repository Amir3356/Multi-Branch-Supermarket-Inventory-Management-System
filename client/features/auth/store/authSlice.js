import { createSlice } from '@reduxjs/toolkit'
import { STORAGE_KEYS, deleteCookie, getCookie, readJson, setCookie, writeJson } from '../../../utils'

// The signed-in user and token. Token is stored in and restored from browser cookies instead of localStorage.
const savedToken = getCookie('auth_token') || getCookie('token')
const saved = readJson(STORAGE_KEYS.auth)
if (saved?.token) {
  // Purge any legacy token from localStorage
  writeJson(STORAGE_KEYS.auth, saved.user ? { user: saved.user } : null)
}

// Shown on the login page, by the reason the server gave for ending the session
const ENDED_NOTICES = {
  'Ended by the Owner': 'The Owner ended your session. Please sign in again.',
  'Account deactivated': 'Your account was deactivated. Contact the Owner if you think this is a mistake.',
  'Password reset': 'Your password was changed. Sign in with your new password.',
  'Account deleted': 'Your account was removed. Contact the Owner.'
}

const inactivityNotice = (minutes) =>
  `You were signed out after ${minutes ? `${minutes} minutes` : 'a period'} of inactivity. Please sign in again.`

const authSlice = createSlice({
  name: 'auth',
  // notice: shown on the login page after the server ended this session
  initialState: { token: savedToken || null, user: saved?.user || null, notice: null },
  reducers: {
    // payload: { token, user } from the API; the server records the session
    loggedIn(state, action) {
      state.token = action.payload.token
      state.user = action.payload.user
      state.notice = null
      if (action.payload.token) {
        setCookie('auth_token', action.payload.token, { maxAge: 7 * 86400 })
      }
    },
    // Fresh copy from /auth/me, e.g. after the Owner changed this user's role
    userRefreshed(state, action) {
      state.user = action.payload
    },
    loggedOut(state) {
      state.token = null
      state.user = null
      deleteCookie('auth_token')
      deleteCookie('token')
    },
    // The token stopped working: ended by the Owner, account deactivated, password reset elsewhere, or expired.
    // payload: the server's reason when it was pushed over the WebSocket (optional)
    sessionEnded(state, action) {
      const minutes = state.user?.sessionTimeoutMinutes
      state.token = null
      state.user = null
      deleteCookie('auth_token')
      deleteCookie('token')
      state.notice = action.payload === 'Signed out after inactivity'
        ? inactivityNotice(minutes)
        : ENDED_NOTICES[action.payload] || 'Your session was ended. Please sign in again.'
    }
  }
})

export const { loggedIn, userRefreshed, loggedOut, sessionEnded } = authSlice.actions
export const selectAuth = (state) => state.auth
export const selectCurrentUser = (state) => state.auth.user
export const selectIsLoggedIn = (state) => Boolean(state.auth.token && state.auth.user)
// The branch the pages show: staff who work at one branch (Inventory Officer, Cashier) only ever see theirs; those who cover
// every branch (Owner, Purchase Officer) see "all"
export const selectBranchInView = (state) => {
  const own = state.auth.user?.branchId
  return own && own !== 'all' ? own : 'all'
}
export default authSlice.reducer
