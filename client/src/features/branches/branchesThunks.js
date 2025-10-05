import { nextId } from '../../utils'
import { logAdded } from '../auditLogs/auditLogsSlice'
import { branchAdded, branchRemoved, branchUpdated } from './branchesSlice'
import EXPENSES from '../../data/expenses.json'
import DAILY_PERFORMANCE from '../../data/dailyPerformance.json'

export const addBranch = (data) => (dispatch, getState) => {
  const branch = { ...data, id: nextId(getState().branches, 'BR', 2), revenue: 0, expenses: 0 }
  dispatch(branchAdded(branch))
  dispatch(logAdded('Branch added', 'Branches', branch.id, `${branch.name} added at ${branch.location} (${branch.status}).`))
  return branch
}

export const updateBranch = (branch, data) => (dispatch) => {
  dispatch(branchUpdated({ id: branch.id, changes: data }))
  dispatch(logAdded('Branch updated', 'Branches', branch.id, `${branch.name} updated: name "${data.name}", location "${data.location}", status ${data.status}.`))
}

export const toggleBranchStatus = (branch) => (dispatch) => {
  const status = branch.status === 'Active' ? 'Inactive' : 'Active'
  dispatch(branchUpdated({ id: branch.id, changes: { status } }))
  dispatch(logAdded(status === 'Active' ? 'Branch activated' : 'Branch deactivated', 'Branches', branch.id, `${branch.name} is now ${status}.`))
  return status
}

// A branch with stock or history can't be deleted (its records would lose their branch); deactivate it instead
// `confirm` is asked only once the branch is known to be deletable
export const deleteBranch = (branch, confirm = () => true) => (dispatch, getState) => {
  const s = getState()
  const id = branch.id
  const hasRecords =
    s.stock.some((e) => e.branchId === id) ||
    s.sales.some((x) => x.branchId === id) ||
    s.purchases.items.some((p) => p.branchId === id) ||
    s.transfers.some((t) => t.from === id || t.to === id) ||
    s.damaged.some((d) => d.branchId === id) ||
    s.customerReturns.some((r) => r.branchId === id) ||
    s.supplierReturns.some((r) => r.branchId === id) ||
    s.accounts.some((a) => a.branchId === id) ||
    EXPENSES.some((e) => e.branchId === id) ||
    DAILY_PERFORMANCE.some((r) => r.branchId === id)
  if (hasRecords) return { error: `${branch.name} can't be deleted because it has stock, sales, or other records. Deactivate it instead.` }
  if (!confirm()) return { cancelled: true }
  dispatch(branchRemoved(id))
  dispatch(logAdded('Branch deleted', 'Branches', id, `${branch.name} (${branch.location}) was deleted.`))
  return { ok: true }
}
