import { useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useNavigate } from 'react-router-dom'
import { CheckCircle2, Pencil, Power, Trash2, UserCog, UserPlus } from 'lucide-react'
import { BranchTag, EmptyRow, Notice, PageHeader, StatCard, StatusTag } from '../components'
import { useBranchScope, useNow } from '../hooks'
import { PATHS } from '../routes/paths'
import { loggedOut, selectAuth } from '../features/auth/authSlice'
import { selectAccounts } from '../features/accounts/accountsSlice'
import { selectSessions } from '../features/accounts/sessionsSlice'
import { deleteAccount, endIdleSessions, endSessions, saveAccount, toggleAccountStatus } from '../features/accounts/accountsThunks'
import AccountModal from '../features/accounts/AccountModal'
import SessionsPanel from '../features/accounts/SessionsPanel'

export default function AccountProvisionPage() {
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const now = useNow()
  const { branches, branchById } = useBranchScope()
  const { email: signedInEmail } = useSelector(selectAuth)
  const accounts = useSelector(selectAccounts)
  const sessions = useSelector(selectSessions)
  const [editingAccount, setEditingAccount] = useState(null)
  const [notice, setNotice] = useState(null)

  const isOwnAccount = (account) => account.email.toLowerCase() === (signedInEmail || '').toLowerCase()
  const showResult = (result) => setNotice(result.error ? { type: 'error', text: result.error } : { type: 'success', text: result.message })

  const handleSave = (data) => {
    setNotice({ type: 'success', text: dispatch(saveAccount(editingAccount, data)) })
    setEditingAccount(null)
  }

  const handleDelete = (account) => {
    if (account.role !== 'Owner' && !isOwnAccount(account) && !window.confirm(`Delete the account for ${account.fullName}? They will no longer be able to sign in.`)) return
    showResult(dispatch(deleteAccount(account, signedInEmail)))
  }

  const handleEndSession = (session) => {
    if (!window.confirm(`End ${session.email}'s session on ${session.device}? They will be signed out on that device.`)) return
    dispatch(endSessions((s) => s.id === session.id, 'ended by the Owner'))
    setNotice({ type: 'success', text: `${session.email} was signed out on ${session.device}.` })
  }

  const handleEndIdle = () => {
    const count = dispatch(endIdleSessions())
    setNotice({ type: 'success', text: count ? `${count} idle ${count === 1 ? 'session was' : 'sessions were'} ended.` : 'There are no idle sessions to end.' })
  }

  const signOut = () => {
    dispatch(loggedOut())
    navigate(PATHS.login, { replace: true })
  }

  return (
    <div className="content-section-card">
      <PageHeader title="Account Provision" description="The Owner creates and manages staff accounts: Pharmacist, Cashier, and Purchase Officer.">
        <button className="primary-action-btn" onClick={() => setEditingAccount({})}>
          <UserPlus size={16} /> Create Account
        </button>
      </PageHeader>

      <Notice notice={notice} onDismiss={() => setNotice(null)} />

      <div className="stats-grid" style={{ margin: '1.5rem 0' }}>
        <StatCard title="Total Accounts" icon={UserCog} tone="cyan" value={accounts.length} chip="Staff logins" />
        <StatCard title="Active" icon={CheckCircle2} tone="teal" value={accounts.filter((a) => a.status === 'Active').length} chip="Can sign in" chipTone="positive" />
        <StatCard title="Inactive" icon={Power} tone="danger" value={accounts.filter((a) => a.status === 'Inactive').length} chip="Sign-in blocked" chipTone="negative" />
      </div>

      <div className="table-responsive">
        <table className="data-table">
          <thead>
            <tr>
              <th>No</th>
              <th>Full Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>Branch</th>
              <th>Status</th>
              <th>Created</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {accounts.map((a, index) => {
              const own = isOwnAccount(a)
              const locked = own || a.role === 'Owner'
              const lockReason = a.role === 'Owner' ? 'The Owner account' : 'Your own account'
              const isActive = a.status === 'Active'
              const role = a.role || 'Pharmacist'
              return (
                <tr key={a.id}>
                  <td>{index + 1}</td>
                  <td className="fw-600 nowrap">
                    {a.fullName}
                    {own && <span className="current-chip">You</span>}
                  </td>
                  <td>{a.email}</td>
                  <td className="nowrap"><span className={`role-tag role-${role.toLowerCase().replace(' ', '-')}`}>{role}</span></td>
                  <td>{a.branchId === 'all' ? <BranchTag allBranches /> : <BranchTag branch={branchById(a.branchId)} />}</td>
                  <td><StatusTag status={a.status} /></td>
                  <td className="nowrap">{a.createdAt}</td>
                  <td>
                    <div className="row-actions" style={{ justifyContent: 'flex-start' }}>
                      <button type="button" className="icon-btn" onClick={() => setEditingAccount(a)} aria-label={`Edit ${a.fullName}`} title="Edit">
                        <Pencil size={15} />
                      </button>
                      <button
                        type="button"
                        className={`icon-btn ${isActive ? 'deactivate-btn' : 'activate-btn'}`}
                        onClick={() => showResult(dispatch(toggleAccountStatus(a, signedInEmail)))}
                        disabled={locked}
                        aria-label={`${isActive ? 'Deactivate' : 'Activate'} ${a.fullName}`}
                        title={locked ? `${lockReason} can't be deactivated` : isActive ? 'Deactivate' : 'Activate'}
                      >
                        <Power size={15} />
                      </button>
                      <button
                        type="button"
                        className="icon-danger-btn"
                        onClick={() => handleDelete(a)}
                        disabled={locked}
                        aria-label={`Delete ${a.fullName}`}
                        title={locked ? `${lockReason} can't be deleted` : 'Delete'}
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
            {accounts.length === 0 && <EmptyRow colSpan={8}>No accounts yet. Click Create Account to add one.</EmptyRow>}
          </tbody>
        </table>
      </div>

      <SessionsPanel sessions={sessions} accounts={accounts} branchById={branchById} now={now} onEnd={handleEndSession} onEndIdle={handleEndIdle} onSignOut={signOut} />

      {editingAccount && <AccountModal account={editingAccount} accounts={accounts} branches={branches} onClose={() => setEditingAccount(null)} onSave={handleSave} />}
    </div>
  )
}
