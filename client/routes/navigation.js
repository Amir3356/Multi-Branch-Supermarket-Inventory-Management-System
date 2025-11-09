import {
  LayoutDashboard,
  UserCog,
  Package,
  ShoppingCart,
  PackageCheck,
  ArrowLeftRight,
  PackageX,
  Wallet,
  BarChart3,
  FileText,
  Building2,
  Settings
} from 'lucide-react'
import { PATHS } from './paths'

// Sidebar groups and links. `section` is checked against the user's role; `badge` names a count the layout fills in.
export const NAV_GROUPS = [
  {
    title: 'MAIN MENU',
    items: [
      { section: 'dashboard', path: PATHS.dashboard, label: 'Dashboard', icon: LayoutDashboard },
      { section: 'accounts', path: PATHS.accounts, label: 'Account Provision', icon: UserCog },
      { section: 'inventory', path: PATHS.inventory, label: 'Inventory', icon: Package, badge: 'inventoryAlerts' },
      { section: 'sales', path: PATHS.sales, label: 'Sales', icon: ShoppingCart }
    ]
  },
  {
    title: 'OPERATIONS',
    items: [
      { section: 'purchases', path: PATHS.purchases, label: 'Procurement', icon: PackageCheck },
      { section: 'transfers', path: PATHS.transfers, label: 'Stock Transfers', icon: ArrowLeftRight },
      { section: 'damaged', path: PATHS.damaged, label: 'Damaged', icon: PackageX },
      { section: 'expenses', path: PATHS.expenses, label: 'Expenses', icon: Wallet }
    ]
  },
  {
    title: 'ANALYTICS & AUDIT',
    items: [
      { section: 'reports', path: PATHS.reports, label: 'Reports', icon: BarChart3 },
      { section: 'auditLogs', path: PATHS.auditLogs, label: 'Audit Logs', icon: FileText }
    ]
  },
  {
    title: 'CONFIGURATION',
    items: [
      { section: 'branches', path: PATHS.branches, label: 'Branches', icon: Building2, badge: 'branchCount' },
      { section: 'policy', path: PATHS.policy, label: 'Settings', icon: Settings }
    ]
  }
]
