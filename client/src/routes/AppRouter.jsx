import { Navigate, createBrowserRouter, RouterProvider } from 'react-router-dom'
import { PATHS } from './paths'
import ProtectedRoute from './ProtectedRoute'
import PublicOnlyRoute from './PublicOnlyRoute'
import AuthLayout from '../layouts/AuthLayout'
import DashboardLayout from '../layouts/DashboardLayout'
import LoginPage from '../pages/LoginPage'
import DashboardPage from '../pages/DashboardPage'
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
import NotificationsPage from '../pages/NotificationsPage'
import NotFoundPage from '../pages/NotFoundPage'

const router = createBrowserRouter([
  {
    element: <PublicOnlyRoute />,
    children: [{ element: <AuthLayout />, children: [{ path: PATHS.login, element: <LoginPage /> }] }]
  },
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <DashboardLayout />,
        children: [
          { path: '/', element: <Navigate to={PATHS.dashboard} replace /> },
          { path: PATHS.dashboard, element: <DashboardPage /> },
          { path: PATHS.accounts, element: <AccountProvisionPage /> },
          { path: PATHS.inventory, element: <InventoryPage /> },
          { path: PATHS.sales, element: <SalesPage /> },
          { path: PATHS.customerReturns, element: <CustomerReturnsPage /> },
          { path: PATHS.purchases, element: <PurchasePage /> },
          { path: PATHS.supplierReturns, element: <SupplierReturnsPage /> },
          { path: PATHS.transfers, element: <StockTransfersPage /> },
          { path: PATHS.damaged, element: <DamagedPage /> },
          { path: PATHS.reports, element: <ReportsPage /> },
          { path: PATHS.auditLogs, element: <AuditLogsPage /> },
          { path: PATHS.branches, element: <BranchesPage /> },
          { path: PATHS.policy, element: <PolicyPage /> },
          { path: PATHS.notifications, element: <NotificationsPage /> },
          { path: '*', element: <NotFoundPage /> }
        ]
      }
    ]
  }
])

export default function AppRouter() {
  return <RouterProvider router={router} />
}
