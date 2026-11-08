import { CheckCircle2, Clock3, Power, UserX } from 'lucide-react'
import { BranchTag } from '../../../components'
import { formatDate } from '../../../utils/dates'
import { howLongUnused } from '../services/accountRules'

const initials = (name) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('')

// Dormant accounts: Active staff logins nobody has used for `dormantDays`. Each card can be deactivated in place.
export default function DormantAccountsPanel({ accounts, dormantDays, branchById, busyId, onDeactivate }) {
  return (
    <section className="dormant-section" id="dormant-accounts" aria-labelledby="dormant-title">
      <div className="dormant-section-header">
        <div>
          <h3 id="dormant-title">
            <UserX size={18} /> Dormant Accounts
            {accounts.length > 0 && <span className="dormant-count">{accounts.length}</span>}
          </h3>
          <p className="page-desc">
            Active accounts with no sign-in for {dormantDays} days or more. Deactivate the ones that are no longer needed, so
            an unused password can't be used to get in.
          </p>
        </div>
      </div>

      {accounts.length === 0 ? (
        <div className="dormant-empty" role="status">
          <CheckCircle2 size={20} />
          <span>No dormant accounts. Every active staff member has signed in within the last {dormantDays} days.</span>
        </div>
      ) : (
        <ul className="dormant-grid">
          {accounts.map((a) => {
            const never = a.daysSinceLogin === null
            const busy = busyId === a.id
            return (
              <li key={a.id} className={`dormant-card ${never ? 'never' : ''}`}>
                <div className="dormant-card-top">
                  <span className="dormant-avatar" aria-hidden="true">{initials(a.fullName)}</span>
                  <div className="dormant-who">
                    <span className="dormant-name">{a.fullName}</span>
                    <span className="dormant-email">{a.email}</span>
                  </div>
                </div>

                <div className="dormant-tags">
                  <span className={`role-tag role-${a.role.replace('_', '-')}`}>{a.roleLabel}</span>
                  {a.branchId === 'all' ? <BranchTag allBranches /> : <BranchTag branch={branchById(a.branchId)} />}
                </div>

                <div className="dormant-idle">
                  <Clock3 size={15} />
                  {never ? (
                    <span>
                      <strong>Never signed in</strong>
                      {a.createdAt && <> · added {formatDate(new Date(a.createdAt))}</>}
                    </span>
                  ) : (
                    <span>
                      <strong>Unused for {howLongUnused(a.daysSinceLogin)}</strong> · last sign-in {formatDate(new Date(a.lastLoginAt))}
                    </span>
                  )}
                </div>

                <button type="button" className="dormant-deactivate" onClick={() => onDeactivate(a)} disabled={busy} aria-label={`Deactivate ${a.fullName}`}>
                  <Power size={14} /> {busy ? 'Deactivating…' : 'Deactivate'}
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
