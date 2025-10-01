import { IDLE_AFTER_MINUTES, sessionState } from './sessionsSlice'
import { useState } from 'react'
import {
  Clock,
  LogOut,
  Filter,
  Building2,
  UserCheck,
  Monitor
} from 'lucide-react'
import { toDateKey, timeAgo, formatSessionTime } from '../../utils'
import { StatusTag, BranchTag } from '../../components'

export default function SessionsPanel({ sessions, accounts, branchById, now, onEnd, onEndIdle, onSignOut }) {
  const [showEnded, setShowEnded] = useState(false)
  const withState = sessions.map((s) => ({ ...s, state: sessionState(s, now), account: accounts.find((a) => a.email.toLowerCase() === s.email) }))
  const active = withState.filter((s) => s.state === 'Active').length
  const idle = withState.filter((s) => s.state === 'Idle')
  const signedInToday = withState.filter((s) => toDateKey(new Date(s.signedInAt)) === toDateKey(now)).length
  const visible = withState
    .filter((s) => showEnded || s.state !== 'Ended')
    .sort((a, b) => (b.current ? 1 : 0) - (a.current ? 1 : 0) || b.lastActiveAt - a.lastActiveAt)

  return (
    <div className="sessions-section">
      <div className="section-header">
        <div>
          <h3><Monitor size={18} /> Session Monitoring &amp; Management</h3>
          <p className="page-desc">See who is signed in, on which device, and end sessions when needed. Sessions go idle after {IDLE_AFTER_MINUTES} minutes without activity.</p>
        </div>
        <button type="button" className="secondary-action-btn" onClick={onEndIdle} disabled={!idle.some((s) => !s.current)}>
          <LogOut size={16} /> End Idle Sessions
        </button>
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

      <div className="filter-summary" style={{ marginTop: 0 }}>
        <span>
          <Filter size={14} /> <strong>{visible.length}</strong> {visible.length === 1 ? 'session' : 'sessions'} shown
        </span>
        <label className="inline-check">
          <input type="checkbox" checked={showEnded} onChange={(e) => setShowEnded(e.target.checked)} /> Show ended sessions
        </label>
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
              <th>Signed In</th>
              <th>Last Active</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((s, index) => {
              const role = s.account?.role
              return (
                <tr key={s.id}>
                  <td>{index + 1}</td>
                  <td className="nowrap">
                    <span className="fw-600">{s.account?.fullName || s.email}</span>
                    {s.current && <span className="current-chip">This device</span>}
                    {role && <span className={`role-tag role-${role.toLowerCase().replace(' ', '-')} session-role`}>{role}</span>}
                  </td>
                  <td>
                    {!s.account ? '—' : s.account.branchId === 'all'
                      ? <span className="branch-tag"><Building2 size={12} /> All Branches</span>
                      : <BranchTag branch={branchById(s.account.branchId)} />}
                  </td>
                  <td className="nowrap">{s.device}</td>
                  <td className="font-mono">{s.ip}</td>
                  <td className="nowrap">{formatSessionTime(new Date(s.signedInAt), now)}</td>
                  <td className="nowrap">{s.state === 'Ended' ? `Ended ${timeAgo(s.endedAt, now)}` : timeAgo(s.lastActiveAt, now)}</td>
                  <td><StatusTag status={s.state} /></td>
                  <td>
                    {s.state === 'Ended' ? (
                      <span className="not-set">—</span>
                    ) : s.current ? (
                      <button type="button" className="link-btn" onClick={onSignOut}>
                        <LogOut size={14} /> Sign Out
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
                <td colSpan="9" style={{ color: 'var(--text-dim)', textAlign: 'center', padding: '2rem' }}>
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
