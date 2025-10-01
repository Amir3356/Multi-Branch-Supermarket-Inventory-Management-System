import { useMemo } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { LogOut, Moon, Pill, Sun, User } from 'lucide-react'
import { useBranchScope, useTheme } from '../hooks'
import { NAV_GROUPS } from '../routes/navigation'
import { PATHS } from '../routes/paths'
import { loggedOut, selectAuth } from '../features/auth/authSlice'
import { selectAccounts } from '../features/accounts/accountsSlice'
import { selectSettings } from '../features/policy/settingsSlice'
import { selectInventory } from '../features/inventory/selectors'

// Sidebar + top header around every dashboard page
export default function DashboardLayout() {
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const { theme, toggle } = useTheme()
  const { email } = useSelector(selectAuth)
  const accounts = useSelector(selectAccounts)
  const { pharmacyName } = useSelector(selectSettings)
  const inventory = useSelector(selectInventory)
  const { branches, inScope } = useBranchScope()

  const signedInAccount = accounts.find((a) => a.email.toLowerCase() === email)
  const badges = useMemo(() => {
    const scoped = inventory.filter((i) => inScope(i.branchId))
    return {
      inventoryAlerts: scoped.filter((i) => i.status !== 'In Stock').length + scoped.filter((i) => i.expiringSoon).length,
      branchCount: branches.length
    }
  }, [inventory, inScope, branches])

  const signOut = () => {
    dispatch(loggedOut())
    navigate(PATHS.login, { replace: true })
  }

  return (
    <div className="dashboard-container">
      <aside className="dashboard-sidebar">
        <div className="sidebar-brand">
          <div className="logo-icon-wrapper">
            <Pill size={22} />
          </div>
          <div className="brand-title-wrap">
            <span className="logo-text">{pharmacyName}</span>
            <span className="brand-subtitle">Multi-Branch Inventory</span>
          </div>
        </div>

        <nav className="sidebar-nav">
          {NAV_GROUPS.map((group, index) => (
            <div key={group.title}>
              <div className="nav-group-title" style={index ? { marginTop: '1.2rem' } : undefined}>{group.title}</div>
              {group.items.map(({ path, label, icon: Icon, badge }) => (
                <NavLink key={path} to={path} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                  <Icon size={18} />
                  <span>{label}</span>
                  {badge && badges[badge] ? <span className="nav-badge">{badges[badge]}</span> : null}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="user-profile-card">
            <div className="user-avatar">
              <User size={18} />
            </div>
            <div className="user-info">
              <span className="user-name">{signedInAccount ? `${signedInAccount.fullName} · ${signedInAccount.role}` : 'Pharmacist'}</span>
              <span className="user-email">{email || 'pharmacist@pharmacare.io'}</span>
            </div>
          </div>
          <button type="button" className="logout-btn" onClick={signOut} title="Sign Out">
            <LogOut size={16} />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      <main className="dashboard-main">
        <header className="dashboard-header">
          <button
            type="button"
            className="theme-toggle"
            onClick={toggle}
            aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>
        </header>

        <div className="dashboard-content">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
