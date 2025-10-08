import { createSlice } from '@reduxjs/toolkit'
import { STORAGE_KEYS, describeDevice, readJson } from '../../utils'

// The signed-in user and their API token. Restored from storage so a refresh keeps you signed in.
const saved = readJson(STORAGE_KEYS.auth)

const authSlice = createSlice({
  name: 'auth',
  initialState: { token: saved?.token || null, user: saved?.user || null },
  reducers: {
    loggedIn: {
      reducer(state, action) {
        state.token = action.payload.token
        state.user = action.payload.user
      },
      // Device and time are captured here so the sessions slice can record this sign-in
      prepare({ token, user }) {
        return { payload: { token, user, email: user.email, device: describeDevice(), at: Date.now() } }
      }
    },
    // Fresh copy from /auth/me, e.g. after the Owner changed this user's role
    userRefreshed(state, action) {
      state.user = action.payload
    },
    loggedOut: {
      reducer(state) {
        state.token = null
        state.user = null
      },
      prepare() {
        return { payload: { at: Date.now() } }
      }
    }
  }
})

export const { loggedIn, userRefreshed, loggedOut } = authSlice.actions
export const selectAuth = (state) => state.auth
export const selectCurrentUser = (state) => state.auth.user
export const selectIsLoggedIn = (state) => Boolean(state.auth.token && state.auth.user)
export default authSlice.reducer
