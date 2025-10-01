import {
  LayoutDashboard,
  UserCog,
  Package,
  ShoppingCart,
  Undo2,
  PackageCheck,
  PackageMinus,
  ArrowLeftRight,
  PackageX,
  BarChart3,
  FileText,
  Building2,
  ShieldCheck
} from 'lucide-react'
import { PATHS } from './paths'

// Sidebar groups and links. `badge` names a count the layout fills in.
export const NAV_GROUPS = [
  {
    title: 'MAIN MENU',
    items: [
      { path: PATHS.dashboard, label: 'Dashboard', icon: LayoutDashboard },
      { path: PATHS.accounts, label: 'Account Provision', icon: UserCog },
      { path: PATHS.inventory, label: 'Inventory', icon: Package, badge: 'inventoryAlerts' },
      { path: PATHS.sales, label: 'Sales', icon: ShoppingCart },
      { path: PATHS.customerReturns, label: 'Customer Returns', icon: Undo2 }
    ]
  },
  {
    title: 'OPERATIONS',
    items: [
      { path: PATHS.purchases, label: 'Purchase', icon: PackageCheck },
      { path: PATHS.supplierReturns, label: 'Supplier Returns', icon: PackageMinus },
      { path: PATHS.transfers, label: 'Stock Transfers', icon: ArrowLeftRight },
      { path: PATHS.damaged, label: 'Damaged', icon: PackageX }
    ]
  },
  {
    title: 'ANALYTICS & AUDIT',
    items: [
      { path: PATHS.reports, label: 'Reports', icon: BarChart3 },
      { path: PATHS.auditLogs, label: 'Audit Logs', icon: FileText }
    ]
  },
  {
    title: 'CONFIGURATION',
    items: [
      { path: PATHS.branches, label: 'Branches', icon: Building2, badge: 'branchCount' },
      { path: PATHS.policy, label: 'Policy', icon: ShieldCheck }
    ]
  }
]
