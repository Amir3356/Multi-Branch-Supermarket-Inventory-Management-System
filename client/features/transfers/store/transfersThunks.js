import { findCatalogProduct } from '../../../utils'
import { thunkContext } from '../../../redux/thunkHelpers'
import { logAdded } from '../../auditLogs/store/auditLogsSlice'
import { productUpdated } from '../../inventory/store/productsSlice'
import { stockAdjusted, stockReceived } from '../../inventory/store/stockSlice'
import { createTransfer, fetchTransfers, receiveTransfer } from '../api/transfersApi'
import { transferReceivedApplied, transferSaved, transferSentApplied, transfersLoaded } from './transfersSlice'

// Transfer thunks call the API and return the confirmation message; failures throw ApiError

const productOf = (state, transfer) => findCatalogProduct(state.products.items, transfer.medId, transfer.product)

// Stock follows each transfer once: the units leave the sending branch when it is sent, and enter the receiving
// branch only when its Inventory Officer adds them (Received)
const syncTransferStock = () => (dispatch, getState) => {
  const state = getState()
  const { items, sentIds, receivedIds } = state.transfers
  for (const transfer of items) {
    const medId = productOf(state, transfer)?.id
    if (!medId) continue // the product reaches this browser's catalog with its procurement: try again next sync

    if (!sentIds.includes(transfer.id)) {
      // The sending branch's stock arrives in this browser with its procurements: try again next sync
      if (!state.stock.some((row) => row.medId === medId && row.branchId === transfer.from)) continue
      dispatch(stockAdjusted({ medId, branchId: transfer.from, delta: -transfer.qty }))
      dispatch(transferSentApplied(transfer.id))
    }
    if (transfer.status === 'Received' && !receivedIds.includes(transfer.id)) {
      // The receiving branch holds it under its own new batch number (the sender's stays on the transfer for tracing)
      dispatch(stockReceived({ medId, branchId: transfer.to, qty: transfer.qty, batch: transfer.receivedBatch || transfer.batch, expiry: transfer.expiry }))
      dispatch(transferReceivedApplied(transfer.id))
    }
  }
}

export const loadTransfers = () => async (dispatch) => {
  const { data } = await fetchTransfers()
  dispatch(transfersLoaded(data))
  dispatch(syncTransferStock())
}

// Sent or received on another screen: applied here at once
export const transferPushed = (transfer) => (dispatch) => {
  dispatch(transferSaved(transfer))
  dispatch(syncTransferStock())
}

// Inventory Officer: send stock to another branch. It leaves this branch now and is Pending until the receiving
// branch adds it with Add Medicine.
export const sendTransfer = ({ medId, expiry, ...data }) => async (dispatch, getState) => {
  const { transfer, message } = await createTransfer({ ...data, medId, expiry })
  dispatch(transferSaved(transfer))
  dispatch(syncTransferStock())
  const { branchName } = thunkContext(getState)
  dispatch(logAdded('Stock sent', 'Stock Transfers', transfer.id, `${transfer.qty} × ${transfer.product} (batch ${transfer.batch}) sent from ${branchName(transfer.from)} to ${branchName(transfer.to)}; pending until they add it.`))
  return message
}

// Receiving branch's Inventory Officer (Add Medicine): the units enter this branch's stock, and the product's selling
// price is set
export const receiveTransferToStock = (transfer, sellingPrice) => async (dispatch, getState) => {
  const { transfer: received } = await receiveTransfer(transfer.id)
  dispatch(transferSaved(received))
  dispatch(syncTransferStock())
  const { state, money, branchName } = thunkContext(getState)
  const product = productOf(state, received)
  if (product) dispatch(productUpdated({ id: product.id, changes: { sellingPrice } }))
  dispatch(logAdded('Transfer received', 'Stock Transfers', received.id, `${received.qty} × ${received.product} from ${branchName(received.from)} (their batch ${received.batch}) added to ${branchName(received.to)}'s stock as batch ${received.receivedBatch}; selling price ${money(sellingPrice)}.`))
  return `${received.qty} × ${received.product} from ${branchName(received.from) || 'the other branch'} added to stock as batch ${received.receivedBatch || received.batch}, at ${money(sellingPrice)} per unit.`
}
