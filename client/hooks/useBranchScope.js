import { useCallback } from 'react'
import { useSelector } from 'react-redux'
import { selectBranches } from '../features/branches/store/branchesSlice'
import { selectSelectedBranch } from '../features/ui/store/uiSlice'

// Which branch the list pages show ("all" or one branch), with helpers for filtering and labels
export function useBranchScope() {
  const branches = useSelector(selectBranches)
  const selectedBranch = useSelector(selectSelectedBranch)
  const branchById = useCallback((id) => branches.find((b) => b.id === id), [branches])
  const isAllBranches = selectedBranch === 'all'
  const currentBranch = branchById(selectedBranch)
  return {
    branches,
    branchById,
    selectedBranch,
    isAllBranches,
    currentBranch,
    scopeLabel: isAllBranches ? 'All Branches' : currentBranch?.name,
    inScope: (branchId) => isAllBranches || branchId === selectedBranch
  }
}
