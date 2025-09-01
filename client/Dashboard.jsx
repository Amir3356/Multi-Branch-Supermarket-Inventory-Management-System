import { useState } from 'react'
import {
  LayoutDashboard,
  Pill,
  Package,
  Clock,
  FileText,
  Settings,
  LogOut,
  Bell,
  Search,
  User,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Filter,
  Plus,
  Sliders,
  Shield,
  Moon,
  RefreshCw,
  Activity,
  ArrowUpRight,
  Database,
  ShoppingCart,
  Receipt,
  Truck,
  ClipboardList,
  BarChart3,
  Users,
  PackageCheck,
  Trash2,
  DollarSign,
  Wallet
} from 'lucide-react'

export default function Dashboard({ userEmail, onLogout }) {
  const [activeTab, setActiveTab] = useState('overview')
  const [searchQuery, setSearchQuery] = useState('')

  // Demo Inventory Data
  const [medicines] = useState([
    { id: 'MED-101', name: 'Amoxicillin 500mg', category: 'Antibiotics', stock: 450, batch: 'BT-8821', expiry: '2027-04-15', status: 'In Stock' },
    { id: 'MED-102', name: 'Paracetamol 650mg', category: 'Analgesics', stock: 1200, batch: 'BT-9012', expiry: '2028-01-20', status: 'In Stock' },
    { id: 'MED-103', name: 'Metformin 850mg', category: 'Antidiabetic', stock: 18, batch: 'BT-4410', expiry: '2026-11-05', status: 'Low Stock' },
    { id: 'MED-104', name: 'Atorvastatin 20mg', category: 'Cardiovascular', stock: 320, batch: 'BT-3329', expiry: '2026-10-18', status: 'Expiring Soon' },
    { id: 'MED-105', name: 'Omeprazole 20mg', category: 'Gastrointestinal', stock: 640, batch: 'BT-7721', expiry: '2027-08-30', status: 'In Stock' },
    { id: 'MED-106', name: 'Azithromycin 250mg', category: 'Antibiotics', stock: 12, batch: 'BT-1045', expiry: '2026-12-10', status: 'Low Stock' }
  ])

  // Demo Audit Logs Data
  const [auditLogs] = useState([
    { id: 1, action: 'Updated Stock Quantity', item: 'Amoxicillin 500mg', user: userEmail || 'pharmacist@pharmacare.io', time: '10 mins ago', type: 'update' },
    { id: 2, action: 'Batch Expiry Warning Triggered', item: 'Atorvastatin 20mg', user: 'System Alert', time: '1 hour ago', type: 'warning' },
    { id: 3, action: 'Added New Medicine Entry', item: 'Azithromycin 250mg', user: userEmail || 'pharmacist@pharmacare.io', time: '3 hours ago', type: 'create' },
    { id: 4, action: 'System Security Audit Completed', item: 'Auth Gateway', user: 'Admin System', time: '5 hours ago', type: 'system' }
  ])

  // Filtered Medicines
  const filteredMedicines = medicines.filter(
    (m) =>
      m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.id.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div className="dashboard-container">
      {/* Sidebar Navigation */}
      <aside className="dashboard-sidebar">
        <div className="sidebar-brand">
          <div className="logo-icon-wrapper">
            <Pill size={22} />
          </div>
          <div className="brand-title-wrap">
            <span className="logo-text">PharmaCare</span>
            <span className="brand-subtitle">Inventory System</span>
          </div>
        </div>

        <nav className="sidebar-nav">
          <div className="nav-group-title">MAIN MENU</div>

          <button
            className={`nav-item ${activeTab === 'overview' ? 'active' : ''}`}
            onClick={() => setActiveTab('overview')}
          >
            <LayoutDashboard size={18} />
            <span>Overview</span>
          </button>

          <button
            className={`nav-item ${activeTab === 'inventory' ? 'active' : ''}`}
            onClick={() => setActiveTab('inventory')}
          >
            <Package size={18} />
            <span>Inventory</span>
            <span className="nav-badge">6</span>
          </button>

          <button
            className={`nav-item ${activeTab === 'sales' ? 'active' : ''}`}
            onClick={() => setActiveTab('sales')}
          >
            <ShoppingCart size={18} />
            <span>Sales</span>
          </button>

          <button
            className={`nav-item ${activeTab === 'prescriptions' ? 'active' : ''}`}
            onClick={() => setActiveTab('prescriptions')}
          >
            <ClipboardList size={18} />
            <span>Prescriptions</span>
          </button>

          <button
            className={`nav-item ${activeTab === 'patients' ? 'active' : ''}`}
            onClick={() => setActiveTab('patients')}
          >
            <Users size={18} />
            <span>Patients</span>
          </button>

          <div className="nav-group-title" style={{ marginTop: '1.2rem' }}>OPERATIONS</div>

          <button
            className={`nav-item ${activeTab === 'orders' ? 'active' : ''}`}
            onClick={() => setActiveTab('orders')}
          >
            <PackageCheck size={18} />
            <span>Purchase</span>
          </button>

          <button
            className={`nav-item ${activeTab === 'suppliers' ? 'active' : ''}`}
            onClick={() => setActiveTab('suppliers')}
          >
            <Truck size={18} />
            <span>Suppliers</span>
          </button>

          <button
            className={`nav-item ${activeTab === 'returns' ? 'active' : ''}`}
            onClick={() => setActiveTab('returns')}
          >
            <Trash2 size={18} />
            <span>Returns & Waste</span>
          </button>

          <div className="nav-group-title" style={{ marginTop: '1.2rem' }}>ANALYTICS & AUDIT</div>

          <button
            className={`nav-item ${activeTab === 'reports' ? 'active' : ''}`}
            onClick={() => setActiveTab('reports')}
          >
            <BarChart3 size={18} />
            <span>Reports</span>
          </button>

          <button
            className={`nav-item ${activeTab === 'audit' ? 'active' : ''}`}
            onClick={() => setActiveTab('audit')}
          >
            <FileText size={18} />
            <span>Audit logs</span>
          </button>

          <div className="nav-group-title" style={{ marginTop: '1.2rem' }}>CONFIGURATION</div>

          <button
            className={`nav-item ${activeTab === 'settings' ? 'active' : ''}`}
            onClick={() => setActiveTab('settings')}
          >
            <Settings size={18} />
            <span>Settings</span>
          </button>
        </nav>

        {/* Sidebar Footer User Card */}
        <div className="sidebar-footer">
          <div className="user-profile-card">
            <div className="user-avatar">
              <User size={18} />
            </div>
            <div className="user-info">
              <span className="user-name">Pharmacist</span>
              <span className="user-email">{userEmail || 'pharmacist@pharmacare.io'}</span>
            </div>
          </div>

          <button type="button" className="logout-btn" onClick={onLogout} title="Sign Out">
            <LogOut size={16} />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="dashboard-main">
        {/* Top Header Bar */}
        <header className="dashboard-header">
          <div className="header-search">
            <Search size={18} className="search-icon" />
            <input
              type="text"
              placeholder="Search medicines, batches, SKU codes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="header-actions">
            <div className="header-badge">
              <Activity size={14} /> System Online
            </div>

            <button className="header-icon-btn" title="Notifications">
              <Bell size={18} />
              <span className="notification-dot"></span>
            </button>

            <button className="header-icon-btn" title="Theme Mode">
              <Moon size={18} />
            </button>
          </div>
        </header>

        {/* Dynamic Views */}
        <div className="dashboard-content">
          {activeTab === 'overview' && (
            <>
              <div className="content-title-row">
                <div>
                  <h1 className="page-title">Pharmacy Overview</h1>
                  <p className="page-desc">Real-time status of pharmaceutical stock, alerts, and recent audit activity.</p>
                </div>
                <button className="primary-action-btn" onClick={() => setActiveTab('inventory')}>
                  <Plus size={16} /> Add New Batch
                </button>
              </div>

              {/* Metric Stat Cards: Financials (Revenue, Expense, Profit) + Stock Status */}
              <div className="stats-grid">
                <div className="stat-card">
                  <div className="stat-header">
                    <span className="stat-title">Total Revenue</span>
                    <div className="stat-icon-wrapper cyan">
                      <Receipt size={20} />
                    </div>
                  </div>
                  <div className="stat-value">$42,850.00</div>
                  <div className="stat-chip positive">
                    <TrendingUp size={12} /> +12.4% this month
                  </div>
                </div>

                <div className="stat-card">
                  <div className="stat-header">
                    <span className="stat-title">Total Expenses</span>
                    <div className="stat-icon-wrapper danger">
                      <Wallet size={20} />
                    </div>
                  </div>
                  <div className="stat-value">$26,120.00</div>
                  <div className="stat-chip negative">
                    Stock Intake & Operations
                  </div>
                </div>

                <div className="stat-card">
                  <div className="stat-header">
                    <span className="stat-title">Net Profit</span>
                    <div className="stat-icon-wrapper teal">
                      <DollarSign size={20} />
                    </div>
                  </div>
                  <div className="stat-value" style={{ color: '#34d399' }}>$16,730.00</div>
                  <div className="stat-chip positive">
                    <TrendingUp size={12} /> 39.0% Profit Margin
                  </div>
                </div>

                <div className="stat-card">
                  <div className="stat-header">
                    <span className="stat-title">Total Medicine SKU</span>
                    <div className="stat-icon-wrapper teal">
                      <Pill size={20} />
                    </div>
                  </div>
                  <div className="stat-value">2,840</div>
                  <div className="stat-chip positive">
                    <TrendingUp size={12} /> Active Catalog
                  </div>
                </div>

                <div className="stat-card">
                  <div className="stat-header">
                    <span className="stat-title">Low Stock Alerts</span>
                    <div className="stat-icon-wrapper warning">
                      <AlertTriangle size={20} />
                    </div>
                  </div>
                  <div className="stat-value">2 Items</div>
                  <div className="stat-chip negative">
                    Requires Reorder
                  </div>
                </div>
              </div>

              {/* Inventory Table Preview */}
              <div className="content-section-card" style={{ marginTop: '1.5rem' }}>
                <div className="section-header">
                  <h3>Medicine Inventory Status</h3>
                  <button className="link-btn" onClick={() => setActiveTab('inventory')}>
                    View All <ArrowUpRight size={14} />
                  </button>
                </div>

                <div className="table-responsive">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Code</th>
                        <th>Medicine Name</th>
                        <th>Category</th>
                        <th>Stock Level</th>
                        <th>Batch No.</th>
                        <th>Expiry Date</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredMedicines.map((med) => (
                        <tr key={med.id}>
                          <td className="font-mono">{med.id}</td>
                          <td className="fw-600">{med.name}</td>
                          <td>{med.category}</td>
                          <td>{med.stock} units</td>
                          <td><span className="batch-badge">{med.batch}</span></td>
                          <td>{med.expiry}</td>
                          <td>
                            <span className={`status-tag ${med.status.toLowerCase().replace(' ', '-')}`}>
                              {med.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}

          {activeTab === 'inventory' && (
            <div className="content-section-card">
              <div className="section-header">
                <div>
                  <h2 className="page-title">Medicine Inventory List</h2>
                  <p className="page-desc">Comprehensive database of current pharmaceutical products and quantities.</p>
                </div>
                <div style={{ display: 'flex', gap: '0.75rem' }}>
                  <button className="secondary-action-btn">
                    <Filter size={16} /> Filter List
                  </button>
                  <button className="primary-action-btn">
                    <Plus size={16} /> Add Medicine
                  </button>
                </div>
              </div>

              <div className="table-responsive" style={{ marginTop: '1rem' }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Code</th>
                      <th>Medicine Name</th>
                      <th>Category</th>
                      <th>Current Stock</th>
                      <th>Batch Number</th>
                      <th>Expiration Date</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredMedicines.map((med) => (
                      <tr key={med.id}>
                        <td className="font-mono">{med.id}</td>
                        <td className="fw-600">{med.name}</td>
                        <td>{med.category}</td>
                        <td>{med.stock} units</td>
                        <td><span className="batch-badge">{med.batch}</span></td>
                        <td>{med.expiry}</td>
                        <td>
                          <span className={`status-tag ${med.status.toLowerCase().replace(' ', '-')}`}>
                            {med.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'sales' && (
            <div className="content-section-card">
              <div className="section-header">
                <div>
                  <h2 className="page-title">Pharmacy Sales & POS</h2>
                  <p className="page-desc">Manage customer prescription transactions, receipts, and daily sales records.</p>
                </div>
                <button className="primary-action-btn">
                  <Plus size={16} /> New Sale Transaction
                </button>
              </div>

              {/* Sales Stat Cards */}
              <div className="stats-grid" style={{ margin: '1.5rem 0' }}>
                <div className="stat-card">
                  <div className="stat-header">
                    <span className="stat-title">Today's Total Sales</span>
                    <div className="stat-icon-wrapper teal">
                      <Receipt size={20} />
                    </div>
                  </div>
                  <div className="stat-value">$1,420.50</div>
                  <div className="stat-chip positive">
                    <TrendingUp size={12} /> +12.4% vs yesterday
                  </div>
                </div>

                <div className="stat-card">
                  <div className="stat-header">
                    <span className="stat-title">Completed Orders</span>
                    <div className="stat-icon-wrapper cyan">
                      <ShoppingCart size={20} />
                    </div>
                  </div>
                  <div className="stat-value">48</div>
                  <div className="stat-chip neutral">
                    <CheckCircle2 size={12} /> Processed
                  </div>
                </div>
              </div>

              {/* Recent Sales Table */}
              <div className="table-responsive">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Invoice ID</th>
                      <th>Customer / Prescription</th>
                      <th>Items Purchased</th>
                      <th>Total Amount</th>
                      <th>Payment Method</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="font-mono">INV-9021</td>
                      <td className="fw-600">Walk-in Customer</td>
                      <td>Amoxicillin 500mg (2x)</td>
                      <td className="fw-600">$42.00</td>
                      <td><span className="batch-badge">Card</span></td>
                      <td><span className="status-tag in-stock">Completed</span></td>
                    </tr>
                    <tr>
                      <td className="font-mono">INV-9022</td>
                      <td className="fw-600">John Doe (Rx #4401)</td>
                      <td>Paracetamol 650mg (1x)</td>
                      <td className="fw-600">$18.50</td>
                      <td><span className="batch-badge">Cash</span></td>
                      <td><span className="status-tag in-stock">Completed</span></td>
                    </tr>
                    <tr>
                      <td className="font-mono">INV-9023</td>
                      <td className="fw-600">Sarah Smith</td>
                      <td>Omeprazole 20mg (3x)</td>
                      <td className="fw-600">$64.00</td>
                      <td><span className="batch-badge">Insurance</span></td>
                      <td><span className="status-tag in-stock">Completed</span></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'prescriptions' && (
            <div className="content-section-card">
              <div className="section-header">
                <div>
                  <h2 className="page-title">Patient Prescriptions (Rx)</h2>
                  <p className="page-desc">Manage digital doctor orders, refills, and dosage instructions.</p>
                </div>
                <button className="primary-action-btn">
                  <Plus size={16} /> New Prescription
                </button>
              </div>

              <div className="table-responsive" style={{ marginTop: '1.5rem' }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Rx Number</th>
                      <th>Patient Name</th>
                      <th>Prescribing Doctor</th>
                      <th>Medication</th>
                      <th>Refills Left</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="font-mono">RX-8801</td>
                      <td className="fw-600">Robert Vance</td>
                      <td>Dr. Emily Stone</td>
                      <td>Metformin 850mg</td>
                      <td>3 Refills</td>
                      <td><span className="status-tag in-stock">Dispensed</span></td>
                    </tr>
                    <tr>
                      <td className="font-mono">RX-8802</td>
                      <td className="fw-600">Jessica Alba</td>
                      <td>Dr. Michael Chen</td>
                      <td>Atorvastatin 20mg</td>
                      <td>1 Refill</td>
                      <td><span className="status-tag low-stock">Pending Refill</span></td>
                    </tr>
                    <tr>
                      <td className="font-mono">RX-8803</td>
                      <td className="fw-600">David Miller</td>
                      <td>Dr. Emily Stone</td>
                      <td>Amoxicillin 500mg</td>
                      <td>0 Refills</td>
                      <td><span className="status-tag in-stock">Completed</span></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'patients' && (
            <div className="content-section-card">
              <div className="section-header">
                <div>
                  <h2 className="page-title">Patient Directory & Profiles</h2>
                  <p className="page-desc">Manage registered patient history, medical contacts, and active prescriptions.</p>
                </div>
                <button className="primary-action-btn">
                  <Plus size={16} /> Register Patient
                </button>
              </div>

              <div className="table-responsive" style={{ marginTop: '1.5rem' }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Patient ID</th>
                      <th>Patient Name</th>
                      <th>Phone Number</th>
                      <th>Insurance Provider</th>
                      <th>Active Prescriptions</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="font-mono">PAT-401</td>
                      <td className="fw-600">Robert Vance</td>
                      <td>+1 (555) 019-2834</td>
                      <td>BlueCross Shield</td>
                      <td>2 Active Rx</td>
                      <td><span className="status-tag in-stock">Active Patient</span></td>
                    </tr>
                    <tr>
                      <td className="font-mono">PAT-402</td>
                      <td className="fw-600">Jessica Alba</td>
                      <td>+1 (555) 012-9981</td>
                      <td>Aetna Health</td>
                      <td>1 Active Rx</td>
                      <td><span className="status-tag in-stock">Active Patient</span></td>
                    </tr>
                    <tr>
                      <td className="font-mono">PAT-403</td>
                      <td className="fw-600">David Miller</td>
                      <td>+1 (555) 014-7720</td>
                      <td>Medicare Plus</td>
                      <td>3 Active Rx</td>
                      <td><span className="status-tag in-stock">Active Patient</span></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'orders' && (
            <div className="content-section-card">
              <div className="section-header">
                <div>
                  <h2 className="page-title">Purchase & Stock Intake</h2>
                  <p className="page-desc">Generate purchase orders to distributors and verify incoming stock batches.</p>
                </div>
                <button className="primary-action-btn">
                  <Plus size={16} /> Create Purchase
                </button>
              </div>

              <div className="table-responsive" style={{ marginTop: '1.5rem' }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>PO Number</th>
                      <th>Supplier</th>
                      <th>Items Ordered</th>
                      <th>Total Cost</th>
                      <th>Expected Delivery</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="font-mono">PO-10492</td>
                      <td className="fw-600">MedPharma Global Logistics</td>
                      <td>Amoxicillin 500mg (1,000 units)</td>
                      <td className="fw-600">$1,850.00</td>
                      <td>2026-10-06</td>
                      <td><span className="status-tag low-stock">In Transit</span></td>
                    </tr>
                    <tr>
                      <td className="font-mono">PO-10493</td>
                      <td className="fw-600">BioTech Pharma Supplies</td>
                      <td>Atorvastatin 20mg (500 units)</td>
                      <td className="fw-600">$920.00</td>
                      <td>2026-10-10</td>
                      <td><span className="status-tag in-stock">Delivered & Verified</span></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'returns' && (
            <div className="content-section-card">
              <div className="section-header">
                <div>
                  <h2 className="page-title">Returns, Expiry & Waste Management</h2>
                  <p className="page-desc">Track expired stock disposal and manage vendor product return credits.</p>
                </div>
                <button className="danger-btn">
                  <Trash2 size={14} style={{ display: 'inline', marginRight: '4px' }} /> Record Damaged / Expired Item
                </button>
              </div>

              <div className="table-responsive" style={{ marginTop: '1.5rem' }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Return ID</th>
                      <th>Medicine Name</th>
                      <th>Batch ID</th>
                      <th>Quantity</th>
                      <th>Reason</th>
                      <th>Return Credit Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="font-mono">RET-201</td>
                      <td className="fw-600">Atorvastatin 20mg</td>
                      <td>BT-3329</td>
                      <td>50 units</td>
                      <td>Expired Stock</td>
                      <td><span className="status-tag low-stock">Credit Pending</span></td>
                    </tr>
                    <tr>
                      <td className="font-mono">RET-202</td>
                      <td className="fw-600">Metformin 850mg</td>
                      <td>BT-4410</td>
                      <td>12 units</td>
                      <td>Damaged Packaging</td>
                      <td><span className="status-tag in-stock">Credit Approved</span></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'suppliers' && (
            <div className="content-section-card">
              <div className="section-header">
                <div>
                  <h2 className="page-title">Suppliers & Distributors</h2>
                  <p className="page-desc">Track pharmaceutical vendors, purchase orders, and stock deliveries.</p>
                </div>
                <button className="primary-action-btn">
                  <Plus size={16} /> Add Vendor
                </button>
              </div>

              <div className="table-responsive" style={{ marginTop: '1.5rem' }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Vendor ID</th>
                      <th>Company Name</th>
                      <th>Contact Person</th>
                      <th>Phone / Email</th>
                      <th>Active Orders</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="font-mono">VEN-101</td>
                      <td className="fw-600">MedPharma Global Logistics</td>
                      <td>Alexander Wright</td>
                      <td>support@medpharma.com</td>
                      <td>2 Purchase Orders</td>
                      <td><span className="status-tag in-stock">Verified Partner</span></td>
                    </tr>
                    <tr>
                      <td className="font-mono">VEN-102</td>
                      <td className="fw-600">BioTech Pharma Supplies</td>
                      <td>Clara Oswald</td>
                      <td>orders@biotechpharma.io</td>
                      <td>1 Pending Delivery</td>
                      <td><span className="status-tag in-stock">Active Supplier</span></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'reports' && (
            <div className="content-section-card">
              <div className="section-header">
                <div>
                  <h2 className="page-title">Financial Reports & Profitability Analytics</h2>
                  <p className="page-desc">Comprehensive breakdown of total revenue, operating expenses, and net profit margins.</p>
                </div>
                <button className="secondary-action-btn">
                  <BarChart3 size={16} /> Export Financial PDF
                </button>
              </div>

              {/* Financial Metric Cards: Revenue, Expense, Profit, Asset Value */}
              <div className="stats-grid" style={{ margin: '1.5rem 0' }}>
                <div className="stat-card">
                  <div className="stat-header">
                    <span className="stat-title">Monthly Revenue</span>
                    <div className="stat-icon-wrapper cyan">
                      <Receipt size={20} />
                    </div>
                  </div>
                  <div className="stat-value">$42,850.00</div>
                  <div className="stat-chip positive">
                    <TrendingUp size={12} /> +12.4% vs last month
                  </div>
                </div>

                <div className="stat-card">
                  <div className="stat-header">
                    <span className="stat-title">Operating Expenses</span>
                    <div className="stat-icon-wrapper danger">
                      <Wallet size={20} />
                    </div>
                  </div>
                  <div className="stat-value">$26,120.00</div>
                  <div className="stat-chip negative">
                    Stock & Operational Costs
                  </div>
                </div>

                <div className="stat-card">
                  <div className="stat-header">
                    <span className="stat-title">Net Profit</span>
                    <div className="stat-icon-wrapper teal">
                      <DollarSign size={20} />
                    </div>
                  </div>
                  <div className="stat-value" style={{ color: '#34d399' }}>$16,730.00</div>
                  <div className="stat-chip positive">
                    <TrendingUp size={12} /> 39.0% Profit Margin
                  </div>
                </div>

                <div className="stat-card">
                  <div className="stat-header">
                    <span className="stat-title">Total Stock Asset Value</span>
                    <div className="stat-icon-wrapper teal">
                      <Database size={20} />
                    </div>
                  </div>
                  <div className="stat-value">$124,500.00</div>
                  <div className="stat-chip positive">
                    Asset Valuation
                  </div>
                </div>
              </div>

              {/* Expense Breakdown Table */}
              <div className="table-responsive" style={{ marginTop: '1.5rem' }}>
                <div className="section-header">
                  <h3>Monthly Expense Breakdown</h3>
                </div>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Category</th>
                      <th>Description</th>
                      <th>Monthly Expense</th>
                      <th>% of Budget</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="fw-600">Medicine Stock Inventory Intake</td>
                      <td>Bulk supplier purchase orders & batch refills</td>
                      <td className="fw-600">$18,450.00</td>
                      <td>70.6%</td>
                      <td><span className="status-tag in-stock">Budget On-Track</span></td>
                    </tr>
                    <tr>
                      <td className="fw-600">Pharmacy Staff Payroll</td>
                      <td>Pharmacists & assistant salaries</td>
                      <td className="fw-600">$5,800.00</td>
                      <td>22.2%</td>
                      <td><span className="status-tag in-stock">Fixed Cost</span></td>
                    </tr>
                    <tr>
                      <td className="fw-600">Store Utilities & Refrigeration</td>
                      <td>Cold-chain storage electricity & maintenance</td>
                      <td className="fw-600">$1,120.00</td>
                      <td>4.3%</td>
                      <td><span className="status-tag in-stock">Operational</span></td>
                    </tr>
                    <tr>
                      <td className="fw-600">Software & Licensing</td>
                      <td>Pharmacy POS system & security compliance</td>
                      <td className="fw-600">$750.00</td>
                      <td>2.9%</td>
                      <td><span className="status-tag in-stock">Active Subscription</span></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'audit' && (
            <div className="content-section-card" style={{ textAlign: 'center', padding: '4rem 2rem' }}>
              <div style={{ display: 'inline-flex', padding: '1rem', borderRadius: '50%', background: 'rgba(6, 182, 212, 0.12)', color: 'var(--primary-cyan)', marginBottom: '1rem' }}>
                <Clock size={36} />
              </div>
              <h2 className="page-title" style={{ fontSize: '1.8rem', marginBottom: '0.5rem' }}>Coming Soon</h2>
              <p className="page-desc" style={{ maxWidth: '420px', margin: '0 auto' }}>
                The Audit logs feature is currently under development. Real-time activity tracking and compliance logging will be available in the upcoming release.
              </p>
            </div>
          )}

          {activeTab === 'settings' && (
            <div className="content-section-card">
              <div className="section-header">
                <div>
                  <h2 className="page-title">Pharmacy System Settings</h2>
                  <p className="page-desc">Configure application preferences, pharmacy details, and alert thresholds.</p>
                </div>
              </div>

              <div className="settings-grid" style={{ marginTop: '1.5rem' }}>
                <div className="settings-box">
                  <h4>Pharmacy Details</h4>
                  <div className="settings-form">
                    <div className="form-group">
                      <label>Pharmacy Name</label>
                      <input type="text" defaultValue="PharmaCare Central Pharmacy" className="input-field" />
                    </div>
                    <div className="form-group">
                      <label>License Number</label>
                      <input type="text" defaultValue="PHAR-9982-LIC" className="input-field" />
                    </div>
                  </div>
                </div>

                <div className="settings-box">
                  <h4>Inventory Alert Thresholds</h4>
                  <div className="settings-form">
                    <div className="form-group">
                      <label>Low Stock Warning Limit (Units)</label>
                      <input type="number" defaultValue="20" className="input-field" />
                    </div>
                    <div className="form-group">
                      <label>Expiry Alert Lead Time (Days)</label>
                      <input type="number" defaultValue="60" className="input-field" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
