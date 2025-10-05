import { useState } from 'react'
import { useDispatch } from 'react-redux'
import { Plus } from 'lucide-react'
import { Notice, PageHeader } from '../components'
import { useBranchScope } from '../hooks'
import { addBranch, deleteBranch, toggleBranchStatus, updateBranch } from '../features/branches/branchesThunks'
import BranchesTable from '../features/branches/BranchesTable'
import BranchModal from '../features/branches/BranchModal'

export default function BranchesPage() {
  const dispatch = useDispatch()
  const { branches, selectedBranch } = useBranchScope()
  const [showAddBranch, setShowAddBranch] = useState(false)
  const [editingBranch, setEditingBranch] = useState(null)
  const [notice, setNotice] = useState(null)

  const handleAdd = (data) => {
    const branch = dispatch(addBranch(data))
    setShowAddBranch(false)
    setNotice({ type: 'success', text: `${branch.name} (${branch.id}) was added successfully.` })
  }

  const handleEdit = (data) => {
    dispatch(updateBranch(editingBranch, data))
    setEditingBranch(null)
    setNotice({ type: 'success', text: `${data.name} was updated.` })
  }

  const handleToggleStatus = (branch) => {
    const status = dispatch(toggleBranchStatus(branch))
    setNotice({
      type: 'success',
      text: status === 'Active'
        ? `${branch.name} is now Active and can record sales again.`
        : `${branch.name} is now Inactive. It can't be chosen when recording new sales.`
    })
  }

  const handleDelete = (branch) => {
    const result = dispatch(deleteBranch(branch, () => window.confirm(`Delete ${branch.name}? This cannot be undone.`)))
    if (result.error) setNotice({ type: 'error', text: result.error })
    else if (result.ok) setNotice({ type: 'success', text: `${branch.name} was deleted.` })
  }

  return (
    <div className="content-section-card">
      <PageHeader title="Branches" description="Manage pharmacy locations across the network: edit details, activate or deactivate, and delete branches.">
        <button className="primary-action-btn" onClick={() => setShowAddBranch(true)}>
          <Plus size={16} /> Add Branch
        </button>
      </PageHeader>

      <Notice notice={notice} onDismiss={() => setNotice(null)} />

      <BranchesTable data={branches} selectedBranch={selectedBranch} onEdit={setEditingBranch} onToggleStatus={handleToggleStatus} onDelete={handleDelete} />

      {editingBranch && <BranchModal branch={editingBranch} branches={branches} onClose={() => setEditingBranch(null)} onSave={handleEdit} />}
      {showAddBranch && <BranchModal branches={branches} onClose={() => setShowAddBranch(false)} onSave={handleAdd} />}
    </div>
  )
}
