import { IDLE_AFTER_MINUTES, sessionState } from './sessionsSlice'
import {
  Clock,
  LogOut,
  Building2,
  UserCheck,
  Monitor
} from 'lucide-react'
import { toDateKey, timeAgo, formatSessionTime } from '../../utils'
import { StatusTag, BranchTag } from '../../components'

export default function SessionsPanel({ sessions, accounts, branchById, now, onEnd, onSignOut }) {
  const withState = sessions.map((s) => ({ ...s, state: sessionState(s, now), account: accounts.find((a) => a.email.toLowerCase() === s.email) }))
  const active = withState.filter((s) => s.state === 'Active').length
  const idle = withState.filter((s) => s.state === 'Idle')
  const signedInToday = withState.filter((s) => toDateKey(new Date(s.signedInAt)) === toDateKey(now)).length
  const visible = withState
    .filter((s) => s.state !== 'Ended')
    .sort((a, b) => (b.current ? 1 : 0) - (a.current ? 1 : 0) || b.lastActiveAt - a.lastActiveAt)

  return (
    <div className="sessions-section">
      <div className="section-header" style={{ justifyContent: 'center', textAlign: 'center' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
          <h3 style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
            <Monitor size={18} /> Session Monitoring &amp; Management
          </h3>
          <p className="page-desc" style={{ textAlign: 'center' }}>
            See who is signed in, on which device, and end sessions when needed. Sessions go idle after {IDLE_AFTER_MINUTES} minutes without activity.
          </p>
        </div>
      </div>

      <div className="stats-grid" style={{ margin: '1.25rem 0' }}>
        <div className="stat-card">
          <div className="stat-header">
            <span className="stat-title">Active Sessions</span>
            <div className="stat-icon-wrapper teal">
              <Monitor size={20} />
            </div>
          </div>
          <div className="stat-value">{active}</div>
          <div className="stat-chip positive">Used in the last {IDLE_AFTER_MINUTES} min</div>
        </div>
        <div className="stat-card">
          <div className="stat-header">
            <span className="stat-title">Idle Sessions</span>
            <div className="stat-icon-wrapper warning">
              <Clock size={20} />
            </div>
          </div>
          <div className="stat-value">{idle.length}</div>
          <div className="stat-chip negative">Signed in but inactive</div>
        </div>
        <div className="stat-card">
          <div className="stat-header">
            <span className="stat-title">Signed In Today</span>
            <div className="stat-icon-wrapper cyan">
              <UserCheck size={20} />
            </div>
          </div>
          <div className="stat-value">{signedInToday}</div>
          <div className="stat-chip neutral">New sessions today</div>
        </div>
      </div>

      <div className="table-responsive" style={{ marginTop: '0.75rem' }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>No</th>
              <th>Staff Member</th>
              <th>Branch</th>
              <th>Device</th>
              <th>IP Address</th>
              <th>Location</th>
              <th>Signed In</th>
              <th>Last Active</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((s, index) => {
              const role = s.account?.roleLabel
              return (
                <tr key={s.id}>
                  <td>{index + 1}</td>
                  <td className="nowrap">
                    <span className="fw-600">{s.account?.fullName || s.email}</span>
                    {s.current && <span className="current-chip">This device</span>}
                    {role && <span className={`role-tag role-${s.account.role.replace('_', '-')} session-role`}>{role}</span>}
                  </td>
                  <td>
                    {!s.account ? '—' : s.account.branchId === 'all'
                      ? <span className="branch-tag"><Building2 size={12} /> All Branches</span>
                      : <BranchTag branch={branchById(s.account.branchId)} />}
                  </td>
                  <td className="nowrap">{s.device}</td>
                  <td className="font-mono">{s.ip}</td>
                  <td className="nowrap">{s.location || 'Addis Ababa, ET'}</td>
                  <td className="nowrap">{formatSessionTime(new Date(s.signedInAt), now)}</td>
                  <td className="nowrap">{s.state === 'Ended' ? `Ended ${timeAgo(s.endedAt, now)}` : timeAgo(s.lastActiveAt, now)}</td>
                  <td><StatusTag status={s.state} /></td>
                  <td>
                    {s.state === 'Ended' ? (
                      <span className="not-set">—</span>
                    ) : s.current ? (
                      <button type="button" className="link-btn" onClick={onSignOut}>
                        <LogOut size={14} /> End Session
                      </button>
                    ) : (
                      <button type="button" className="link-btn danger-link" onClick={() => onEnd(s)}>
                        <LogOut size={14} /> End Session
                      </button>
                    )}
                  </td>
                </tr>
              )
            })}
            {visible.length === 0 && (
              <tr>
                <td colSpan="10" style={{ color: 'var(--text-dim)', textAlign: 'center', padding: '2rem' }}>
                  No sessions to show.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
