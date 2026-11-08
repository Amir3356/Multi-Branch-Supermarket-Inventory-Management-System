import { useState } from 'react'
import { EmptyRow } from '../../../components'
import { ACTION_TYPE_LABELS, actionTone, auditDate, auditTime, snapshotRows } from '../model/auditLog'

const COLUMNS = 9
// Fields shown in a Before / After cell until "+N more" is clicked
const FIELDS_SHOWN = 4

/**
 * What goes in an entry's Before and After cells: for an update only the fields that changed (old value under Before,
 * new under After); for a create the new record under After; for a delete the removed record under Before.
 */
function snapshotFields(log) {
  const rows = snapshotRows(log.before, log.after)
  if (log.before && log.after) return { rows: rows.filter((r) => r.changed), kind: 'update' }
  return { rows, kind: log.after ? 'create' : 'delete' }
}

// One Before or After cell: "Field  value" lines
function SnapshotCell({ rows, side, kind, expanded, onToggle }) {
  const shown = expanded ? rows : rows.slice(0, FIELDS_SHOWN)
  const hidden = rows.length - shown.length
  return (
    <dl className={`audit-snap ${side} ${kind}`}>
      {shown.map((r) => (
        <div key={r.key} className="audit-snap-field">
          <dt>{r.label}</dt>
          <dd>{side === 'before' ? r.was : r.now}</dd>
        </div>
      ))}
      {(hidden > 0 || (expanded && rows.length > FIELDS_SHOWN)) && (
        <button type="button" className="audit-snap-more" onClick={onToggle} aria-expanded={expanded}>
          {expanded ? 'Show less' : `+${hidden} more`}
        </button>
      )}
    </dl>
  )
}

// The audit log as a table, newest first: one row per recorded action, with the data before and after it
export default function AuditLogTable({ logs, freshIds, isLoading }) {
  const [expanded, setExpanded] = useState(() => new Set())
  const toggle = (id) => setExpanded((prev) => {
    const next = new Set(prev)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    return next
  })

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
            <th>Before Snapshot</th>
            <th>After Snapshot</th>
            <th>IP Address &amp; Device</th>
          </tr>
        </thead>
        <tbody>
          {logs.map((log) => {
            const { rows, kind } = log.before || log.after ? snapshotFields(log) : { rows: [], kind: null }
            const isExpanded = expanded.has(log.id)
            const cell = (side) => {
              // Views, sign-ins and sign-outs change no data; a create has nothing before, a delete nothing after
              if (!kind || (side === 'before' && !log.before) || (side === 'after' && !log.after)) return <span className="audit-snap-none">—</span>
              if (rows.length === 0) return <span className="audit-snap-none">No fields changed</span>
              return <SnapshotCell rows={rows} side={side} kind={kind} expanded={isExpanded} onToggle={() => toggle(log.id)} />
            }
            return (
              <tr key={log.id} className={freshIds?.has(log.id) ? 'audit-row-new' : undefined}>
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
                  <span className={`audit-action ${actionTone(log.actionType)}`}>{ACTION_TYPE_LABELS[log.actionType] || log.actionType}</span>
                </td>
                {/* What the user did: the full action and its record, then the details */}
                <td className="audit-details">
                  <div className="audit-what">
                    {log.action}
                    {log.recordId && <span className="batch-badge audit-record">{log.recordId}</span>}
                  </div>
                  {log.description}
                </td>
                <td className="audit-snap-cell">{cell('before')}</td>
                <td className="audit-snap-cell">{cell('after')}</td>
                <td className="nowrap">
                  <div>{log.ipAddress || '—'}</div>
                  {log.device && <div className="audit-sub">{log.device}</div>}
                </td>
              </tr>
            )
          })}
          {logs.length === 0 && <EmptyRow colSpan={COLUMNS}>{isLoading ? 'Loading audit logs…' : 'No actions match these filters.'}</EmptyRow>}
        </tbody>
      </table>
    </div>
  )
}
