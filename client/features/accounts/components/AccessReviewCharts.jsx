import { CheckCircle2, UserX } from 'lucide-react'
import { BarChart, ChartCard, DonutChart, PieChart } from '../../dashboard/components/Charts'
import { unusedAccounts, usersByBranch, usersByRole, usersByStatus } from '../services/accessReviewCharts'

const date = (iso) => new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
// 120 → "about 4 months"; 20 → "20 days"
const howLong = (days) => (days >= 60 ? `about ${Math.round(days / 30)} months` : `${days} days`)

// An access review at a glance: who has which role, account status, staff per branch, and dormant accounts.
// The table below the charts holds every figure.
export default function AccessReviewCharts({ review }) {
  const { rows, summary } = review
  const branches = usersByBranch(rows)
  const unused = unusedAccounts(rows, summary.dormantDays)
  const months = Math.round(summary.dormantDays / 30)
  const dormantCount = unused.notUsed.length + unused.neverJoined.length

  return (
    <div className="charts-grid access-review-charts">
      <ChartCard title="Users by role" subtitle={`${rows.length} ${rows.length === 1 ? 'user' : 'users'}`}>
        <PieChart items={usersByRole(rows)} emptyText="No accounts in this period." />
      </ChartCard>

      <ChartCard title="Account status" subtitle="At the end of the period">
        <DonutChart items={usersByStatus(rows)} unit="users" emptyText="No accounts in this period." />
      </ChartCard>

      <ChartCard
        title="Staff per branch"
        subtitle={`Active accounts, by role${branches.notActive ? ` · ${branches.notActive} pending or inactive not shown` : ''}`}
      >
        <BarChart columns={branches.columns} series={branches.series} wrapLabels wholeNumbers emptyText="No active accounts in this period." />
      </ChartCard>

      <ChartCard title="Dormant Accounts" subtitle={`No sign-in for ${months}+ months`}>
        {/* The headline: how many accounts are dormant, as one big number (green tick when none) */}
        <div className={`dormant-hero ${dormantCount ? 'warn' : 'ok'}`} role="status">
          <span className="dormant-hero-icon">{dormantCount ? <UserX size={34} /> : <CheckCircle2 size={34} />}</span>
          <span className="dormant-hero-number">{dormantCount}</span>
          <span className="dormant-hero-label">{dormantCount === 1 ? 'dormant account' : 'dormant accounts'}</span>
        </div>
        {dormantCount > 0 && (
          <>
            <p className="unused-advice">Check these people still work here. If not, deactivate or delete them on Account Provision.</p>
            <ul className="unused-list">
              {unused.notUsed.map((r) => (
                <li key={r.userId}>
                  <UserX size={16} />
                  <span className="fw-600">{r.fullName}</span>
                  <span className="unused-why">{r.lastLoginAt ? `Not used for ${howLong(r.daysSinceLogin)} · last signed in ${date(r.lastLoginAt)}` : 'Has never signed in'}</span>
                </li>
              ))}
              {unused.neverJoined.map((r) => (
                <li key={r.userId}>
                  <UserX size={16} />
                  <span className="fw-600">{r.fullName}</span>
                  <span className="unused-why">Invited, but never set a password</span>
                </li>
              ))}
            </ul>
          </>
        )}
      </ChartCard>
    </div>
  )
}
