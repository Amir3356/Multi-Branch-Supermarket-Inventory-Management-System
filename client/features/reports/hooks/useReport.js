import { useEffect, useState } from 'react'
import { usePeriod } from '../../dashboard/hooks/usePeriod'
import { fetchReport } from '../api/reportsApi'

/** A report's period, branch and figures; loads again whenever the period or branch changes */
export function useReport(kind) {
  const period = usePeriod()
  const [branchId, setBranchId] = useState('all')
  // The figures and which request they answer; anything else selected means they're still loading
  const [result, setResult] = useState({ key: null, data: null, error: null })
  const [from, to] = period.range
  const key = `${kind}|${from}|${to}|${branchId}`

  useEffect(() => {
    if (period.invalid) return undefined
    let cancelled = false
    fetchReport(kind, { from, to, branchId })
      .then(({ data }) => !cancelled && setResult({ key, data, error: null }))
      .catch((e) => !cancelled && setResult({ key, data: null, error: e.message }))
    return () => {
      cancelled = true
    }
  }, [key, kind, from, to, branchId, period.invalid])

  const loading = !period.invalid && result.key !== key
  return { period, branchId, setBranchId, data: result.data, error: loading ? null : result.error, loading }
}
