import { createSlice } from '@reduxjs/toolkit'
import { STORAGE_KEYS, describeDevice, minutesBetween, readJson } from '../../utils'
import { loggedIn, loggedOut } from '../auth/authSlice'

export const IDLE_AFTER_MINUTES = 15

// Initial session created for currently signed-in user if available, without mock demo sessions
const buildInitialSessions = () => {
  const saved = readJson(STORAGE_KEYS.auth)
  if (saved?.user?.email) {
    return [{
      id: 'SES-LOCAL-1',
      email: saved.user.email,
      device: describeDevice(),
      ip: 'This device',
      location: 'Addis Ababa, ET',
      signedInAt: Date.now(),
      lastActiveAt: Date.now(),
      endedAt: null,
      status: 'Open',
      current: true
    }]
  }
  return []
}

/** Active while used in the last 15 minutes, then Idle; ended sessions stay Ended */
export const sessionState = (session, now) => {
  if (session.status === 'Ended') return 'Ended'
  return minutesBetween(now, session.lastActiveAt) > IDLE_AFTER_MINUTES ? 'Idle' : 'Active'
}

const sessionsSlice = createSlice({
  name: 'sessions',
  initialState: buildInitialSessions,
  reducers: {
    sessionsEnded(state, action) {
      const { ids, at } = action.payload
      state.forEach((s) => {
        if (ids.includes(s.id)) {
          s.status = 'Ended'
          s.endedAt = at
        }
      })
    }
  },
  extraReducers: (builder) => {
    builder
      // Signing in on this browser starts the "This device" session
      .addCase(loggedIn, (state, action) => {
        const { email, device, at } = action.payload
        const count = state.filter((s) => s.current || String(s.id).startsWith('SES-LOCAL')).length
        state.unshift({ id: `SES-LOCAL-${count + 1}`, email, device, ip: 'This device', location: 'Addis Ababa, ET', signedInAt: at, lastActiveAt: at, endedAt: null, status: 'Open', current: true })
      })
      // Signing out ends it
      .addCase(loggedOut, (state, action) => {
        state.forEach((s) => {
          if (s.current) {
            s.current = false
            s.status = 'Ended'
            s.endedAt = action.payload.at
          }
        })
      })
  }
})

export const { sessionsEnded } = sessionsSlice.actions
export const selectSessions = (state) => state.sessions
export default sessionsSlice.reducer
