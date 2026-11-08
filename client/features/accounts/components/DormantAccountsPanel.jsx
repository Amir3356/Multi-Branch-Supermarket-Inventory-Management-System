import { CheckCircle2, Power, UserX } from 'lucide-react'
import { BranchTag, EmptyRow } from '../../../components'
import { formatDate } from '../../../utils/dates'
import { howLongUnused } from '../services/accountRules'

const COLUMNS = 8

// Dormant accounts: Active staff logins nobody has used for `dormantDays`, as a table. Each can be deactivated in place.
export default function DormantAccountsPanel({ accounts, dormantDays, branchById, busyId, onDeactivate }) {
  return (
    <section className="dormant-section" id="dormant-accounts" aria-labelledby="dormant-title">
      <div className="dormant-section-header">
        <h3 id="dormant-title">
          <UserX size={18} /> Dormant Accounts
          {accounts.length > 0 && <span className="dormant-count">{accounts.length}</span>}
        </h3>
        <p className="page-desc">
          Active accounts with no sign-in for {dormantDays} days or more. Deactivate the ones that are no longer needed, so
          an unused password can't be used to get in.
        </p>
      </div>

      <div className="table-responsive" style={{ marginTop: '1.25rem' }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>No</th>
              <th>Full Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>Branch</th>
              <th>Last Sign-in</th>
              <th>Unused For</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {accounts.map((a, index) => {
              const never = a.daysSinceLogin === null
              const busy = busyId === a.id
              return (
                <tr key={a.id}>
                  <td>{index + 1}</td>
                  <td className="fw-600 nowrap">{a.fullName}</td>
                  <td>{a.email}</td>
                  <td className="nowrap"><span className={`role-tag role-${a.role.replace('_', '-')}`}>{a.roleLabel}</span></td>
                  <td>{a.branchId === 'all' ? <BranchTag allBranches /> : <BranchTag branch={branchById(a.branchId)} />}</td>
                  <td className="nowrap">{never ? 'Never' : formatDate(new Date(a.lastLoginAt))}</td>
                  <td className="nowrap">
                    <span className={`dormant-idle-tag ${never ? 'never' : ''}`}>{never ? 'Never signed in' : howLongUnused(a.daysSinceLogin)}</span>
                  </td>
                  <td>
                    <button
                      type="button"
                      className="icon-btn deactivate-btn"
                      onClick={() => onDeactivate(a)}
                      disabled={busy}
                      aria-label={`Deactivate ${a.fullName}`}
                      title={busy ? 'Deactivating…' : 'Deactivate'}
                    >
                      <Power size={15} />
                    </button>
                  </td>
                </tr>
              )
            })}
            {accounts.length === 0 && (
              <EmptyRow colSpan={COLUMNS}>
                <span className="dormant-empty-msg">
                  <CheckCircle2 size={18} /> No dormant accounts. Every active staff member has signed in within the last {dormantDays} days.
                </span>
              </EmptyRow>
            )}
          </tbody>
        </table>
      </div>
    </section>
  )
}
