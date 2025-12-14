import { EmptyRow } from '../../../components'
import { actionTone, actionVerb, auditDate, auditTime } from '../model/auditLog'

// The audit log as a table, newest first: one row per recorded action
export default function AuditLogTable({ logs, isLoading }) {
  return (
    <div className="table-responsive audit-table">
      <table className="data-table">
        <thead>
          <tr>
            <th>Date &amp; Time</th>
            <th>User &amp; Role</th>
            <th>Branch</th>
            <th>Module</th>
            <th>Action</th>
            <th>Description</th>
            <th>IP Address &amp; Device</th>
          </tr>
        </thead>
        <tbody>
          {logs.map((log) => (
            <tr key={log.id}>
              <td className="nowrap">
                <div className="fw-600">{auditDate(log.occurredAt)}</div>
                <div className="audit-sub">{auditTime(log.occurredAt)}</div>
              </td>
              <td>
                <div className="fw-600">{log.userName || '—'}</div>
                <div className="audit-sub">{log.userRole || '—'}</div>
              </td>
              <td>{log.branchName || 'All branches'}</td>
              <td><span className="audit-module">{log.module}</span></td>
              <td>
                {/* One word: Created, Edited, Deleted, Received, Signed in… */}
                <span className={`audit-action ${actionTone(actionVerb(log.action))}`}>{actionVerb(log.action)}</span>
              </td>
              {/* What the user did: the full action and its record, then the details */}
              <td className="audit-details">
                <div className="audit-what">
                  {log.action}
                  {log.recordId && <span className="batch-badge audit-record">{log.recordId}</span>}
                </div>
                {log.description}
              </td>
              <td className="nowrap">
                <div>{log.ipAddress || '—'}</div>
                {log.device && <div className="audit-sub">{log.device}</div>}
              </td>
            </tr>
          ))}
          {logs.length === 0 && <EmptyRow colSpan={7}>{isLoading ? 'Loading audit logs…' : 'No actions match these filters.'}</EmptyRow>}
        </tbody>
      </table>
    </div>
  )
}
