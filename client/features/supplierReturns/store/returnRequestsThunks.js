import { findCatalogProduct } from '../../../utils'
import { logAdded } from '../../auditLogs/store/auditLogsSlice'
import { stockAdjusted } from '../../inventory/store/stockSlice'
import { approveReturnRequestRequest, createReturnRequest, fetchReturnRequests, rejectReturnRequestRequest, replaceReturnRequestRequest } from '../api/returnRequestsApi'
import { replacementStocked, returnRequestSaved, returnRequestsLoaded, returnStockHeld, returnStockReleased } from './returnRequestsSlice'
import { supplierReturnReplaced } from './supplierReturnsSlice'
import { isExtraQuantity } from '../model/returnRequest'
import { recordSupplierReturn } from './supplierReturnsThunks'

// Return request thunks call the API and return the confirmation message; failures throw ApiError

// Stock follows each request once: Pending holds its units out of sellable stock, Approved keeps them out
// (they went back to the supplier), Rejected puts them back. A supplier replacement puts the replaced units back into
// the same batch, once. Extra units (more than were ordered) were never in stock, so they move nothing.
// Unit prices don't change.
const syncReturnStock = () => (dispatch, getState) => {
  const { returnRequests, products, stock } = getState()
  for (const request of returnRequests.items) {
    const medId = findCatalogProduct(products.items, request.medId, request.product)?.id
    // The branch's stock hasn't arrived in this browser yet (procurements still loading): try again next sync
    if (!stock.some((row) => row.medId === medId && row.branchId === request.branchId)) continue

    const held = returnRequests.heldIds.includes(request.id)
    const shouldHold = request.status !== 'Rejected' && !isExtraQuantity(request)
    if (held !== shouldHold) {
      dispatch(stockAdjusted({ medId, branchId: request.branchId, delta: shouldHold ? -request.qty : request.qty }))
      dispatch(shouldHold ? returnStockHeld(request.id) : returnStockReleased(request.id))
    }

    if (request.replacedQty && !returnRequests.replacedIds.includes(request.id)) {
      dispatch(stockAdjusted({ medId, branchId: request.branchId, delta: request.replacedQty }))
      dispatch(replacementStocked(request.id))
      dispatch(supplierReturnReplaced({ requestId: request.id, replacedQty: request.replacedQty }))
    }
  }
}

// A change pushed over the WebSocket (sent, approved, rejected or replaced on another screen): applied at once
export const returnRequestPushed = (request) => (dispatch) => {
  dispatch(returnRequestSaved(request))
  dispatch(syncReturnStock())
}

export const loadReturnRequests = () => async (dispatch) => {
  const { data } = await fetchReturnRequests()
  dispatch(returnRequestsLoaded(data))
  dispatch(syncReturnStock())
}

// Inventory Officer → the branch's Procurement Officer; the units are held out of stock right away
export const sendReturnRequest = (payload) => async (dispatch) => {
  const { request, message } = await createReturnRequest(payload)
  dispatch(returnRequestSaved(request))
  dispatch(syncReturnStock())
  dispatch(logAdded('Return requested', 'Inventory', request.batch, `${request.qty} × ${request.product} (batch ${request.batch}) held for return to ${request.supplier}: ${request.reason}.`))
  return message
}

// Procurement Officer: approving records the supplier return and its credit (the units were already held)
export const approveReturnRequest = (request, supplierReturn) => async (dispatch) => {
  const { request: approved } = await approveReturnRequestRequest(request.id)
  dispatch(returnRequestSaved(approved))
  dispatch(syncReturnStock())
  return dispatch(recordSupplierReturn({ ...supplierReturn, requestId: request.id }))
}

// Rejecting puts the held units back into stock
export const rejectReturnRequest = (request, responseNote) => async (dispatch) => {
  const { request: rejected, message } = await rejectReturnRequestRequest(request.id, responseNote)
  dispatch(returnRequestSaved(rejected))
  dispatch(syncReturnStock())
  dispatch(logAdded('Return request rejected', 'Supplier Returns', request.batch, `${request.qty} × ${request.product} (batch ${request.batch}) back in stock: ${responseNote}`))
  return message
}

// Procurement Officer: the supplier sent good units in place of an approved return. They go back into the same
// batch with no new procurement or payment, and settle that much of the supplier's credit.
export const receiveReplacement = (request, payload) => async (dispatch) => {
  const { request: replaced, message } = await replaceReturnRequestRequest(request.id, payload)
  dispatch(returnRequestSaved(replaced))
  dispatch(syncReturnStock())
  dispatch(logAdded('Supplier replacement received', 'Supplier Returns', request.batch, `${replaced.replacedQty} × ${request.product} from ${request.supplier} back into batch ${request.batch}, no new payment.${payload.note ? ` ${payload.note}` : ''}`))
  return message
}
