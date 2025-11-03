import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import { PATHS } from './paths'
import ProtectedRoute from './ProtectedRoute'
import PublicOnlyRoute from './PublicOnlyRoute'
import RoleRoute from './RoleRoute'
import HomeRedirect from './HomeRedirect'
import AuthLayout from '../layouts/AuthLayout'
import DashboardLayout from '../layouts/DashboardLayout'
import LoginPage from '../pages/LoginPage'
import ForgotPasswordPage from '../pages/ForgotPasswordPage'
import ResetPasswordPage from '../pages/ResetPasswordPage'
import AcceptInvitationPage from '../pages/AcceptInvitationPage'
import AccountProvisionPage from '../pages/AccountProvisionPage'
import InventoryPage from '../pages/InventoryPage'
import SalesPage from '../pages/SalesPage'
import CustomerReturnsPage from '../pages/CustomerReturnsPage'
import PurchasePage from '../pages/PurchasePage'
import SupplierReturnsPage from '../pages/SupplierReturnsPage'
import StockTransfersPage from '../pages/StockTransfersPage'
import DamagedPage from '../pages/DamagedPage'
import ReportsPage from '../pages/ReportsPage'
import AuditLogsPage from '../pages/AuditLogsPage'
import BranchesPage from '../pages/BranchesPage'
import PolicyPage from '../pages/PolicyPage'
import DashboardPage from '../pages/DashboardPage'
import ReturnRequestsPage from '../pages/ReturnRequestsPage'
import NotificationsPage from '../pages/NotificationsPage'
import NotFoundPage from '../pages/NotFoundPage'

// Dashboard pages by section key; each one is only open to the roles the API allows
const SECTION_PAGES = {
  dashboard: DashboardPage,
  accounts: AccountProvisionPage,
  inventory: InventoryPage,
  sales: SalesPage,
  customerReturns: CustomerReturnsPage,
  purchases: PurchasePage,
  supplierReturns: SupplierReturnsPage,
  returnRequests: ReturnRequestsPage,
  transfers: StockTransfersPage,
  damaged: DamagedPage,
  reports: ReportsPage,
  auditLogs: AuditLogsPage,
  branches: BranchesPage,
  policy: PolicyPage,
  notifications: NotificationsPage
}

const router = createBrowserRouter([
  {
    element: <AuthLayout />,
    children: [
      {
        element: <PublicOnlyRoute />,
        children: [
          { path: PATHS.login, element: <LoginPage /> },
          { path: PATHS.forgotPassword, element: <ForgotPasswordPage /> }
        ]
      },
      // Opened from emailed links, so they work even if someone is signed in on this browser
      { path: PATHS.acceptInvitation, element: <AcceptInvitationPage /> },
      { path: PATHS.resetPassword, element: <ResetPasswordPage /> }
    ]
  },
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <DashboardLayout />,
        children: [
          { path: '/', element: <HomeRedirect /> },
          ...Object.entries(SECTION_PAGES).map(([section, Page]) => ({
            path: PATHS[section],
            element: <RoleRoute section={section}><Page /></RoleRoute>
          })),
          { path: '*', element: <NotFoundPage /> }
        ]
      }
    ]
  }
])

export default function AppRouter() {
  return <RouterProvider router={router} />
}
