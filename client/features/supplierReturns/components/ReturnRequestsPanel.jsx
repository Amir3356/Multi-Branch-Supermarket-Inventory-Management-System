import { Check, PackageCheck, X } from 'lucide-react'
import { BranchTag, EmptyRow, StatusTag } from '../../../components'

const requestedDate = (iso) => new Date(iso).toLocaleDateString('en-CA')

// Inventory Officers' requests to send stock back to suppliers. The Procurement Officer approves
// (which records the supplier return) or rejects them, and receives the supplier's replacement for approved ones;
// others only follow along.
export default function ReturnRequestsPanel({ requests, isAllBranches, branchById, canHandle, onApprove, onReject, onReplace }) {
  const colSpan = 9 + (isAllBranches ? 1 : 0) + (canHandle ? 1 : 0)

  return (
    <div style={{ marginTop: '1.5rem' }}>
      <div className="section-header">
        <div>
          <h3>Return Requests</h3>
          <p className="page-desc">
            {canHandle
              ? 'Inventory Officers ask for stock to go back to the supplier. Approve a request to record the return.'
              : 'Requests from Inventory Officers to send stock back to suppliers.'}
          </p>
        </div>
      </div>

      <div className="table-responsive" style={{ marginTop: '1rem' }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>Date</th>
              {isAllBranches && <th>Branch</th>}
              <th>Batch Number</th>
              <th>Product Name</th>
              <th>Supplier</th>
              <th>Quantity</th>
              <th>Reason</th>
              <th>Requested By</th>
              <th>Status</th>
              <th>Handled By</th>
              {canHandle && <th>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {requests.map((r) => (
              <tr key={r.id}>
                <td className="nowrap">{requestedDate(r.requestedAt)}</td>
                {isAllBranches && <td><BranchTag branch={branchById(r.branchId)} /></td>}
                <td className="font-mono">{r.batch}</td>
                <td className="fw-600">{r.product}</td>
                <td>{r.supplier}</td>
                <td>{r.qty} {r.qty === 1 ? 'unit' : 'units'}</td>
                <td>
                  {r.reason}
                  {r.note && <div className="page-desc" style={{ margin: 0 }}>{r.note}</div>}
                </td>
                <td>{r.requestedBy || '—'}</td>
                <td>
                  <StatusTag status={r.status} />
                  {r.responseNote && <div className="page-desc" style={{ margin: 0 }}>{r.responseNote}</div>}
                  {r.replacedQty > 0 && (
                    <div className="page-desc" style={{ margin: 0 }}>
                      {r.replacedQty} of {r.qty} replaced{r.replacementNote ? ` · ${r.replacementNote}` : ''}
                    </div>
                  )}
                </td>
                <td>{r.replacedBy || r.handledBy || '—'}</td>
                {canHandle && (
                  <td>
                    {r.status === 'Pending' && (
                      <div className="row-actions" style={{ justifyContent: 'flex-start' }}>
                        <button type="button" className="icon-btn" onClick={() => onApprove(r)} aria-label={`Approve the return of ${r.product}`} title="Approve and record return">
                          <Check size={15} />
                        </button>
                        <button type="button" className="icon-danger-btn" onClick={() => onReject(r)} aria-label={`Reject the return of ${r.product}`} title="Reject">
                          <X size={15} />
                        </button>
                      </div>
                    )}
                    {r.status === 'Approved' && (
                      <div className="row-actions" style={{ justifyContent: 'flex-start' }}>
                        <button type="button" className="icon-btn" onClick={() => onReplace(r)} aria-label={`Receive the supplier's replacement for ${r.product}`} title="Receive replacement">
                          <PackageCheck size={15} />
                        </button>
                      </div>
                    )}
                  </td>
                )}
              </tr>
            ))}
            {requests.length === 0 && <EmptyRow colSpan={colSpan}>No return requests yet.</EmptyRow>}
          </tbody>
        </table>
      </div>
    </div>
  )
}
