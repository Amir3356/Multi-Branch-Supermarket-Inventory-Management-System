import { AUDIT_MODULES } from './auditLogsSlice'
import { useState } from 'react'
import {
  Search,
  Filter,
  X
} from 'lucide-react'
import { toDateKey } from '../../utils'

export default function AuditLogPanel({ logs }) {
  const [search, setSearch] = useState('')
  const [module, setModule] = useState('all')
  const query = search.trim().toLowerCase()
  const sorted = [...logs].sort((a, b) => (b.date + b.time + b.id).localeCompare(a.date + a.time + a.id))
  const visible = sorted.filter(
    (l) =>
      (module === 'all' || l.module === module) &&
      (!query || [l.action, l.record, l.description].some((field) => field.toLowerCase().includes(query)))
  )
  const today = toDateKey(new Date())
  const todayCount = logs.filter((l) => l.date === today).length

  return (
    <div className="content-section-card">
      <div className="section-header">
        <div>
          <h2 className="page-title">Audit Logs</h2>
          <p className="page-desc">Track important actions performed in the system.</p>
        </div>
        <span className="unsaved-chip audit-today-chip">{todayCount} {todayCount === 1 ? 'action' : 'actions'} today</span>
      </div>

      <div className="filter-bar">
        <div className="filter-search">
          <Search size={16} className="filter-search-icon" />
          <input
            type="search"
            className="input-field"
            placeholder="Search action, record, or description..."
            aria-label="Search audit logs"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select className="input-field filter-select" aria-label="Filter by module" value={module} onChange={(e) => setModule(e.target.value)}>
          <option value="all">All Modules</option>
          {AUDIT_MODULES.map((m) => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
      </div>

      <div className="filter-summary">
        <span>
          <Filter size={14} /> <strong>{visible.length}</strong> of {logs.length} actions
        </span>
        {(query || module !== 'all') && (
          <button type="button" className="link-btn" onClick={() => { setSearch(''); setModule('all') }}>
            <X size={14} /> Clear filters
          </button>
        )}
      </div>

      <div className="table-responsive" style={{ marginTop: '0.75rem' }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>No</th>
              <th>Date</th>
              <th>Time</th>
              <th>Module</th>
              <th>Action</th>
              <th>Record</th>
              <th>Description</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((l, index) => (
              <tr key={l.id}>
                <td>{index + 1}</td>
                <td className="nowrap">{l.date}</td>
                <td className="nowrap">{l.time}</td>
                <td><span className="batch-badge">{l.module}</span></td>
                <td className="fw-600 nowrap">{l.action}</td>
                <td className="font-mono">{l.record}</td>
                <td className="audit-description">{l.description}</td>
              </tr>
            ))}
            {visible.length === 0 && (
              <tr>
                <td colSpan="7" style={{ color: 'var(--text-dim)', textAlign: 'center', padding: '2rem' }}>
                  No actions match your search or filter.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
