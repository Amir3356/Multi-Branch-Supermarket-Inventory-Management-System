import { useEffect, useMemo } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { LogOut, Pill, User } from 'lucide-react'
import { useBranchScope } from '../hooks'
import { NAV_GROUPS } from '../routes/navigation'
import { PATHS, canOpen } from '../routes/paths'
import { selectCurrentUser } from '../features/auth/authSlice'
import { refreshCurrentUser, signOut as signOutThunk } from '../features/auth/authThunks'
import { loadBranches } from '../features/branches/branchesThunks'
import { selectSettings } from '../features/policy/settingsSlice'
import { selectInventory } from '../features/inventory/selectors'

// Sidebar around every dashboard page
export default function DashboardLayout() {
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const user = useSelector(selectCurrentUser)
  const { pharmacyName } = useSelector(selectSettings)
  const inventory = useSelector(selectInventory)
  const { branches, inScope } = useBranchScope()

  // Only the sections this role may open; groups left empty are hidden
  const navGroups = useMemo(
    () => NAV_GROUPS.map((group) => ({ ...group, items: group.items.filter((item) => canOpen(user, item.section)) })).filter((group) => group.items.length),
    [user]
  )

  // Pick up role or branch changes the Owner made since this user signed in, and the branch list every page labels with
  useEffect(() => {
    dispatch(refreshCurrentUser()).catch(() => {})
    dispatch(loadBranches()).catch(() => {})
  }, [dispatch])

  const badges = useMemo(() => {
    const scoped = inventory.filter((i) => inScope(i.branchId))
    return {
      inventoryAlerts: scoped.filter((i) => i.status !== 'In Stock').length + scoped.filter((i) => i.expiringSoon).length,
      branchCount: branches.length
    }
  }, [inventory, inScope, branches])

  const signOut = async () => {
    await dispatch(signOutThunk())
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
          {navGroups.map((group, index) => (
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
              <span className="user-name">{user ? `${user.fullName} · ${user.roleLabel}` : ''}</span>
              <span className="user-email">{user?.email}{user?.branchName ? ` · ${user.branchName}` : ''}</span>
            </div>
          </div>
          <button type="button" className="logout-btn" onClick={signOut} title="Sign Out">
            <LogOut size={16} />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      <main className="dashboard-main">
        <div className="dashboard-content">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
