import { api } from '../../api/http'
import { logAdded } from '../auditLogs/auditLogsSlice'
import { branchRemoved, branchSaved, branchesLoaded } from './branchesSlice'

// Branch thunks call the API and return the confirmation message; failures throw ApiError

export const loadBranches = () => async (dispatch) => {
  const { data } = await api('/branches')
  dispatch(branchesLoaded(data))
}

export const addBranch = (data) => async (dispatch) => {
  const { branch, message } = await api('/branches', { method: 'POST', body: data })
  dispatch(branchSaved(branch))
  dispatch(logAdded('Branch added', 'Branches', branch.id, `${branch.name} added at ${branch.location} (${branch.status}).`))
  return message
}

export const updateBranch = (existing, data) => async (dispatch) => {
  const { branch, message } = await api(`/branches/${existing.id}`, { method: 'PATCH', body: data })
  dispatch(branchSaved(branch))
  dispatch(logAdded('Branch updated', 'Branches', branch.id, `${existing.name} updated: name "${branch.name}", location "${branch.location}", status ${branch.status}.`))
  return message
}

export const toggleBranchStatus = (existing) => async (dispatch) => {
  const status = existing.status === 'Active' ? 'Inactive' : 'Active'
  const { branch } = await api(`/branches/${existing.id}`, { method: 'PATCH', body: { status } })
  dispatch(branchSaved(branch))
  dispatch(logAdded(status === 'Active' ? 'Branch activated' : 'Branch deactivated', 'Branches', branch.id, `${branch.name} is now ${status}.`))
  return status === 'Active'
    ? `${branch.name} is now Active and can record sales again.`
    : `${branch.name} is now Inactive. It can't be chosen when recording new sales.`
}

// The API refuses to delete a branch that still has staff assigned
export const deleteBranch = (branch) => async (dispatch) => {
  const { message } = await api(`/branches/${branch.id}`, { method: 'DELETE' })
  dispatch(branchRemoved(branch.id))
  dispatch(logAdded('Branch deleted', 'Branches', branch.id, `${branch.name} (${branch.location}) was deleted.`))
  return message
}
