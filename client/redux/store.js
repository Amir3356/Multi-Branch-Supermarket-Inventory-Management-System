import { configureStore } from '@reduxjs/toolkit'
import { onUnauthorized, setAuthToken } from '../api/http'
import { STORAGE_KEYS, writeJson, writeText } from '../utils'
import authReducer, { loggedOut } from '../features/auth/authSlice'
import uiReducer from '../features/ui/uiSlice'
import settingsReducer from '../features/policy/settingsSlice'
import branchesReducer from '../features/branches/branchesSlice'
import productsReducer from '../features/inventory/productsSlice'
import stockReducer from '../features/inventory/stockSlice'
import salesReducer from '../features/sales/salesSlice'
import customerReturnsReducer from '../features/customerReturns/customerReturnsSlice'
import purchasesReducer from '../features/purchases/purchasesSlice'
import supplierReturnsReducer from '../features/supplierReturns/supplierReturnsSlice'
import transfersReducer from '../features/transfers/transfersSlice'
import damagedReducer from '../features/damaged/damagedSlice'
import accountsReducer from '../features/accounts/accountsSlice'
import sessionsReducer from '../features/accounts/sessionsSlice'
import auditLogsReducer from '../features/auditLogs/auditLogsSlice'
import notificationsReducer from '../features/notifications/notificationsSlice'

// One store for all shared app data. Mock JSON seeds each slice; the backend will replace it later.
export const store = configureStore({
  reducer: {
    auth: authReducer,
    ui: uiReducer,
    settings: settingsReducer,
    branches: branchesReducer,
    products: productsReducer,
    stock: stockReducer,
    sales: salesReducer,
    customerReturns: customerReturnsReducer,
    purchases: purchasesReducer,
    supplierReturns: supplierReturnsReducer,
    transfers: transfersReducer,
    damaged: damagedReducer,
    accounts: accountsReducer,
    sessions: sessionsReducer,
    auditLogs: auditLogsReducer,
    notifications: notificationsReducer
  }
})

// API calls carry the signed-in user's token; a 401 means it expired or was revoked
setAuthToken(store.getState().auth.token)
onUnauthorized(() => store.dispatch(loggedOut()))

// Per-viewer state survives a refresh: sign-in, policy settings, theme, and notification read state
let previous = store.getState()
store.subscribe(() => {
  const state = store.getState()
  if (state.auth !== previous.auth) {
    setAuthToken(state.auth.token)
    writeJson(STORAGE_KEYS.auth, state.auth.token ? { token: state.auth.token, user: state.auth.user } : null)
  }
  if (state.settings !== previous.settings) writeJson(STORAGE_KEYS.settings, state.settings)
  if (state.ui.theme !== previous.ui.theme) writeText(STORAGE_KEYS.theme, state.ui.theme)
  if (state.notifications !== previous.notifications) writeJson(STORAGE_KEYS.notifications, state.notifications)
  previous = state
})
