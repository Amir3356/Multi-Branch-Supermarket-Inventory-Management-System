/**
 * The routing table: which service answers each part of the public API. The gateway strips /api, so the client's
 * GET /api/sales reaches sales-service as GET /sales. First match wins. /internal/* is never routed: those endpoints
 * are service-to-service.
 */
export const ROUTES = Object.freeze([
  // auth-service: sign-in, password reset, sessions
  { prefix: '/auth', service: 'auth' },
  { prefix: '/sessions', service: 'auth' },

  // user-service: staff accounts, invitations, user (access) reports
  { prefix: '/accounts', service: 'user' },
  { prefix: '/invitations', service: 'user' },
  { prefix: '/access-reviews', service: 'user' },

  // branch-service: branches and the pharmacy policy
  { prefix: '/branches', service: 'branch' },
  { prefix: '/policy', service: 'branch' },

  // inventory-service: catalog, stock, transfers, write-offs
  { prefix: '/products', service: 'inventory' },
  { prefix: '/stock', service: 'inventory' },
  { prefix: '/transfers', service: 'inventory' },
  { prefix: '/damaged-items', service: 'inventory' },

  // sales-service: sales and branch expenses
  { prefix: '/sales', service: 'sales' },
  { prefix: '/expenses', service: 'sales' },

  // procurement-service: purchase orders and Chapa payments
  { prefix: '/procurements', service: 'procurement' },

  // reporting-service: reports, the Owner's dashboard, audit logs
  { prefix: '/reports', service: 'reporting' },
  { prefix: '/dashboard', service: 'reporting' },
  { prefix: '/audit-logs', service: 'reporting' },

  // ai-service: role-specific recommendations and chat
  { prefix: '/ai', service: 'ai' },
])

/** The service that owns a path (without /api), or null */
export function serviceFor(path) {
  const match = ROUTES.find(({ prefix }) => path === prefix || path.startsWith(`${prefix}/`))
  return match?.service ?? null
}

export const isInternalPath = (path) => path === '/internal' || path.startsWith('/internal/')
