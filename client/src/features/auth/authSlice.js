import { createSlice } from '@reduxjs/toolkit'
import { describeDevice } from '../../utils'

// Front-end sign-in only: the backend will verify credentials and issue a real session
const authSlice = createSlice({
  name: 'auth',
  initialState: { isLoggedIn: false, email: '' },
  reducers: {
    loggedIn: {
      reducer(state, action) {
        state.isLoggedIn = true
        state.email = action.payload.email
      },
      // Device and time are captured here so the sessions slice can record this sign-in
      prepare(email) {
        return { payload: { email: email.trim().toLowerCase(), device: describeDevice(), at: Date.now() } }
      }
    },
    loggedOut: {
      reducer(state) {
        state.isLoggedIn = false
      },
      prepare() {
        return { payload: { at: Date.now() } }
      }
    }
  }
})

export const { loggedIn, loggedOut } = authSlice.actions
export const selectAuth = (state) => state.auth
export default authSlice.reducer
