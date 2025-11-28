import { useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, Filter, Radio, Search } from 'lucide-react'
import { PageHeader } from '../components'
import { useBranchScope } from '../hooks'
import { realtime, watchConnection } from '../api/realtime'
import { fetchAuditLogs } from '../features/auditLogs/api/auditLogsApi'
import AuditLogTable from '../features/auditLogs/components/AuditLogTable'
import { usePeriod } from '../features/dashboard/hooks/usePeriod'
import { PeriodError, PeriodPicker } from '../features/dashboard/components/DashboardParts'

// Without a live connection the page checks for new entries this often
const FALLBACK_REFRESH_MS = 60000

// Owner: every important action, recorded on the server (who, what, where, when, from which device). Read only.
export default function AuditLogsPage() {
  const { branches } = useBranchScope()
  const period = usePeriod()
  const [module, setModule] = useState('all')
  const [branchId, setBranchId] = useState('all')
  const [searchText, setSearchText] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [result, setResult] = useState({ data: [], meta: null, modules: [] })
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)
  const [isLive, setIsLive] = useState(false)
  const [from, to] = period.range

  // Typing waits a moment before searching, so each letter doesn't send a request
  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchText.trim()), 350)
    return () => clearTimeout(timer)
  }, [searchText])

  // Any filter change starts again from page 1
  const filtersKey = `${from}|${to}|${module}|${branchId}|${search}`
  const [shownFilters, setShownFilters] = useState(filtersKey)
  if (shownFilters !== filtersKey) {
    setShownFilters(filtersKey)
    setPage(1)
  }

  const load = useRef(() => {})
  useEffect(() => {
    if (period.invalid) return
    let cancelled = false
    load.current = () => {
      setIsLoading(true)
      fetchAuditLogs({ from, to, module, branchId, search, page })
        .then((data) => {
          if (cancelled) return
          setResult(data)
          setError(null)
        })
        .catch((e) => !cancelled && setError(e.message))
        .finally(() => !cancelled && setIsLoading(false))
    }
    load.current()
    return () => {
      cancelled = true
    }
  }, [from, to, module, branchId, search, page, period.invalid])

  // New entries arrive live; without the connection, the list refreshes every minute
  useEffect(() => {
    const refresh = () => load.current()
    const echo = realtime()
    echo?.private('audit-logs').listen('.audit-log.recorded', refresh)
    const stopWatching = watchConnection((connected) => {
      setIsLive(connected)
      if (connected) refresh()
    })
    const timer = setInterval(refresh, FALLBACK_REFRESH_MS)
    return () => {
      echo?.leave('audit-logs')
      stopWatching()
      clearInterval(timer)
    }
  }, [])

  const { data: logs, meta, modules } = result
  const filtersActive = module !== 'all' || branchId !== 'all' || search !== ''
  const clearFilters = () => {
    setModule('all')
    setBranchId('all')
    setSearchText('')
  }

  return (
    <div className="content-section-card">
      <PageHeader title="Audit Logs" description="Every important action in the system: who did it, at which branch, when, and from which device. Entries can't be changed or deleted.">
        <span className={`stat-chip ${isLive ? 'positive' : 'neutral'}`} title={isLive ? 'New actions appear the moment they happen' : 'Live connection unavailable; the list refreshes every minute'}>
          <Radio size={13} /> {isLive ? 'Live' : 'Refreshes every minute'}
        </span>
      </PageHeader>

      <div className="dashboard-toolbar">
        <PeriodPicker state={period} errorId="audit-range-error" />
        {!period.invalid && <p className="page-desc">{period.text}</p>}
      </div>

      <div className="filter-bar">
        <div className="filter-search">
          <Search size={16} className="filter-search-icon" />
          <input type="search" className="input-field" placeholder="Search by user, action, record or details…" aria-label="Search audit logs" value={searchText} onChange={(e) => setSearchText(e.target.value)} />
        </div>
        <select className="input-field filter-select" aria-label="Filter by module" value={module} onChange={(e) => setModule(e.target.value)}>
          <option value="all">All Modules</option>
          {modules.map((m) => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
        <select className="input-field filter-select" aria-label="Filter by branch" value={branchId} onChange={(e) => setBranchId(e.target.value)}>
          <option value="all">All Branches</option>
          {branches.map((b) => (
            <option key={b.id} value={b.id}>{b.name}</option>
          ))}
        </select>
      </div>

      {period.invalid ? <PeriodError id="audit-range-error" /> : (
        <>
          <div className="filter-summary">
            <span>
              <Filter size={14} /> <strong>{meta?.total ?? 0}</strong> {meta?.total === 1 ? 'action' : 'actions'} recorded
            </span>
            {filtersActive && <button type="button" className="link-btn" onClick={clearFilters}>Clear filters</button>}
          </div>
          {error && <p className="error-msg" style={{ marginTop: '0.75rem' }}>{error}</p>}

          <AuditLogTable logs={logs} isLoading={isLoading && !logs.length} />

          {meta && meta.last_page > 1 && (
            <div className="audit-pager">
              <span className="page-desc">Showing {meta.from}–{meta.to} of {meta.total}</span>
              <div className="audit-pager-buttons">
                <button type="button" className="secondary-action-btn" onClick={() => setPage((p) => p - 1)} disabled={page <= 1 || isLoading}>
                  <ChevronLeft size={16} /> Newer
                </button>
                <span className="page-desc">Page {meta.current_page} of {meta.last_page}</span>
                <button type="button" className="secondary-action-btn" onClick={() => setPage((p) => p + 1)} disabled={page >= meta.last_page || isLoading}>
                  Older <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
