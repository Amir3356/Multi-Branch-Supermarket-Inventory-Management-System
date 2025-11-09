// Every page's URL in one place
export const PATHS = {
  login: '/login',
  forgotPassword: '/forgot-password',
  resetPassword: '/reset-password',
  acceptInvitation: '/accept-invitation',
  dashboard: '/dashboard',
  accounts: '/account-provision',
  inventory: '/inventory',
  sales: '/sales',
  purchases: '/purchases',
  transfers: '/stock-transfers',
  damaged: '/damaged',
  expenses: '/expenses',
  reports: '/reports',
  auditLogs: '/audit-logs',
  branches: '/branches',
  policy: '/policy',
  notifications: '/notifications'
}

// RBAC: the API sends each user's allowed `sections` (keys of PATHS); the first is their home page
export const canOpen = (user, section) => Boolean(user?.sections?.includes(section))
export const homePathFor = (user) => PATHS[user?.homeSection] || PATHS.login
