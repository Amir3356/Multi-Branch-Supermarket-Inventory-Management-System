import { useEffect, useRef, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useSearchParams } from 'react-router-dom'
import { CreditCard, Plus } from 'lucide-react'
import { BranchTag, EmptyRow, Notice, PageHeader, StatusTag } from '../components'
import { useBranchScope, useFormatMoney, useMoneyColumns } from '../hooks'
import { selectPurchases, selectSupplierPayments } from '../features/purchases/store/purchasesSlice'
import { selectSupplierReturns } from '../features/supplierReturns/store/supplierReturnsSlice'
import { selectCategories, selectProducts } from '../features/inventory/store/productsSlice'
import { selectCurrentUser } from '../features/auth/store/authSlice'
import { startProcurement, verifyProcurement } from '../features/purchases/store/purchasesThunks'
import { deliveryStatus } from '../features/purchases/model/procurement'
import NewPurchaseModal from '../features/purchases/components/NewPurchaseModal'
import './PurchasePage.css'

const POLL_MS = 3000

// Chapa's checkout opens in a centered popup so the officer never leaves this page
const openCheckoutPopup = (url = '') => {
  const width = 520
  const height = 760
  const left = Math.max(0, window.screenX + (window.outerWidth - width) / 2)
  const top = Math.max(0, window.screenY + (window.outerHeight - height) / 2)
  return window.open(url, 'chapa-checkout', `popup,width=${width},height=${height},left=${left},top=${top}`)
}

export default function PurchasePage() {
  const dispatch = useDispatch()
  const formatMoney = useFormatMoney()
  const { moneyHeader, formatAmount } = useMoneyColumns()
  const { branches, branchById, isAllBranches, scopeLabel, inScope } = useBranchScope()
  const allPurchases = useSelector(selectPurchases)
  const purchases = allPurchases.filter((p) => inScope(p.branchId))
  const payments = useSelector(selectSupplierPayments).filter((p) => inScope(p.branchId))
  const supplierReturns = useSelector(selectSupplierReturns)
  const products = useSelector(selectProducts)
  const categories = useSelector(selectCategories)
  const user = useSelector(selectCurrentUser)
  const [showNewPurchase, setShowNewPurchase] = useState(false)
  const [searchParams, setSearchParams] = useSearchParams()
  const returnedFrom = searchParams.get('procurement')
  const [notice, setNotice] = useState(() => (returnedFrom ? { type: 'info', text: `Checking the Chapa payment for ${returnedFrom}…` } : null))
  const [awaitingPayment, setAwaitingPayment] = useState(null) // procurement id paid for in the popup
  const checkoutPopup = useRef(null)

  // While the checkout popup is open, check the payment every few seconds. Paid or failed: close the popup and say so.
  // The officer closed it: one last check, then report whatever it is (still Pending means not paid).
  useEffect(() => {
    if (!awaitingPayment) return undefined
    let active = true
    let timer
    const check = async () => {
      const popupOpen = Boolean(checkoutPopup.current && !checkoutPopup.current.closed)
      let result
      try {
        result = await dispatch(verifyProcurement(awaitingPayment))
      } catch (error) {
        result = { type: 'error', text: error.message, status: null }
      }
      if (!active) return
      if (popupOpen && (result.status === 'Pending' || result.status === null)) {
        timer = setTimeout(check, POLL_MS)
        return
      }
      if (popupOpen) checkoutPopup.current.close()
      checkoutPopup.current = null
      setAwaitingPayment(null)
      setNotice(result)
    }
    timer = setTimeout(check, POLL_MS)
    return () => {
      active = false
      clearTimeout(timer)
    }
  }, [awaitingPayment, dispatch])

  const watchPayment = (id, popup) => {
    checkoutPopup.current = popup
    setAwaitingPayment(id)
    setNotice({ type: 'info', text: `Waiting for the payment of ${id}. Complete it in the Chapa window.` })
  }

  // Chapa sends the officer back here with ?procurement=PO-…; confirm the payment, then tidy the URL
  useEffect(() => {
    if (!returnedFrom) return
    dispatch(verifyProcurement(returnedFrom))
      .then(setNotice)
      .catch((error) => setNotice({ type: 'error', text: error.message }))
    setSearchParams({}, { replace: true })
  }, [dispatch, returnedFrom, setSearchParams])

  // Purchases with stock sent back show how much was returned instead of just "Paid"
  const purchaseStatus = (po) => {
    const returned = supplierReturns.filter((r) => r.purchaseId === po.id).reduce((sum, r) => sum + r.qty, 0)
    if (!returned) return po.status
    return returned >= po.qty ? 'Returned' : 'Partially Returned'
  }

  // Saved as Pending on the server, then paid in Chapa's checkout popup; stock arrives once the payment is verified.
  // The popup opens before the API call, while the click still counts, or the browser would block it.
  // Errors are thrown back to the modal so it can show them next to the form.
  const handleCreatePurchase = async (data) => {
    const popup = openCheckoutPopup()
    if (popup) popup.document.body.textContent = 'Opening Chapa checkout…'
    let started
    try {
      started = await dispatch(startProcurement(data))
    } catch (error) {
      popup?.close()
      throw error
    }
    if (!popup || popup.closed) {
      window.location.assign(started.checkoutUrl) // popups blocked: pay in this tab and come back
      return
    }
    popup.location.href = started.checkoutUrl
    setShowNewPurchase(false)
    watchPayment(started.id, popup)
  }

  const resumePayment = (e, po) => {
    const popup = openCheckoutPopup(po.checkoutUrl)
    if (!popup) return // popups blocked: the link opens the checkout in this tab instead
    e.preventDefault()
    watchPayment(po.id, popup)
  }

  return (
    <div className="content-section-card">
      <PageHeader title={`Procurement · ${scopeLabel}`} description="Generate purchase orders to distributors and receive incoming stock into a specific branch.">
        <button className="primary-action-btn" onClick={() => setShowNewPurchase(true)}>
          <Plus size={16} /> Create Procurement
        </button>
      </PageHeader>

      <Notice notice={notice} onDismiss={() => setNotice(null)} />

      <div className="table-responsive" style={{ marginTop: '1.5rem' }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>Supplier</th>
              {isAllBranches && <th>Receiving Branch</th>}
              <th>Category</th>
              <th>Product Name</th>
              <th>Quantity</th>
              <th>{moneyHeader('Unit Purchase Price')}</th>
              <th>{moneyHeader('Total Cost')}</th>
              <th>Purchased On</th>
              <th>Status</th>
              <th>Delivery</th>
            </tr>
          </thead>
          <tbody>
            {purchases.map((po) => (
              <tr key={po.id}>
                <td className="fw-600">{po.supplier}</td>
                {isAllBranches && <td><BranchTag branch={branchById(po.branchId)} /></td>}
                <td>{po.category}</td>
                <td className="fw-600">{po.product}</td>
                <td>{po.qty.toLocaleString()} units</td>
                <td>{formatAmount(po.purchasePrice)}</td>
                <td className="fw-600">{formatAmount(po.total)}</td>
                <td>{po.date}</td>
                <td>
                  <StatusTag status={purchaseStatus(po)} />
                  {po.status === 'Pending' && po.checkoutUrl && (
                    <a className="secondary-action-btn" style={{ marginLeft: '0.5rem' }} href={po.checkoutUrl} onClick={(e) => resumePayment(e, po)}>
                      <CreditCard size={14} /> Complete payment
                    </a>
                  )}
                </td>
                {/* Pending until the receiving branch's Inventory Officer adds the stock (Add Medicine), then Arrived */}
                <td>
                  {deliveryStatus(po) ? <StatusTag status={deliveryStatus(po)} /> : '—'}
                  {po.receivedAt && po.batch && <div className="page-desc" style={{ margin: 0 }}>Batch {po.batch}</div>}
                </td>
              </tr>
            ))}
            {purchases.length === 0 && <EmptyRow colSpan={isAllBranches ? 10 : 9}>No procurement records found.</EmptyRow>}
          </tbody>
        </table>
      </div>

      {/* Supplier payments */}
      <div style={{ marginTop: '2.5rem' }}>
        <div className="section-header">
          <div>
            <h3>Payment & Transaction History</h3>
            <p className="page-desc">Supplier settlement history and payment transaction records.</p>
          </div>
        </div>

        <div className="table-responsive" style={{ marginTop: '1rem' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Transaction Ref</th>
                {isAllBranches && <th>Branch</th>}
                <th>Supplier</th>
                <th>Category</th>
                <th>Product Name</th>
                <th>Quantity</th>
                <th>{moneyHeader('Unit Purchase Price')}</th>
                <th>{moneyHeader('Total Cost')}</th>
                <th>Payment Method</th>
                <th>Transaction Date</th>
                <th>Payment Status</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((txn) => {
                // Category, product and quantity come from the purchase this payment settles
                const purchase = allPurchases.find((p) => p.id === txn.purchaseId)
                return (
                  <tr key={txn.id}>
                    <td className="font-mono">{txn.id}</td>
                    {isAllBranches && <td><BranchTag branch={branchById(txn.branchId)} /></td>}
                    <td className="fw-600">{txn.supplier}</td>
                    <td>{purchase?.category || '—'}</td>
                    <td className="fw-600">{purchase?.product || '—'}</td>
                    <td>{purchase ? `${purchase.qty.toLocaleString()} units` : '—'}</td>
                    <td>{purchase ? formatAmount(purchase.purchasePrice) : '—'}</td>
                    <td className="fw-600">{formatAmount(txn.amount)}</td>
                    <td><span className="batch-badge">{txn.method}</span></td>
                    <td>{txn.date}</td>
                    <td><StatusTag status={txn.status} /></td>
                  </tr>
                )
              })}
              {payments.length === 0 && <EmptyRow colSpan={isAllBranches ? 11 : 10}>No payment transaction records found.</EmptyRow>}
            </tbody>
          </table>
        </div>
      </div>

      {showNewPurchase && (
        <NewPurchaseModal
          branches={branches}
          assignedBranchId={user?.branchId === 'all' ? null : user?.branchId}
          products={products}
          categories={categories}
          suppliers={[...new Set(allPurchases.map((p) => p.supplier))].sort()}
          formatMoney={formatMoney}
          onClose={() => setShowNewPurchase(false)}
          onSave={handleCreatePurchase}
        />
      )}
    </div>
  )
}
