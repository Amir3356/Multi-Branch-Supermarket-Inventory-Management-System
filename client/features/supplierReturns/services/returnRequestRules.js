// Field errors for the Inventory Officer's return request. maxQty is the smaller of what is left
// unrequested on the batch and what the branch still holds.
export function validateReturnRequest(form, { batch, qty, maxQty }) {
  const errors = {}
  if (!batch) errors.procurementId = 'Select the batch number'
  if (!Number.isInteger(qty) || qty < 1) errors.qty = 'Enter a whole number of at least 1'
  else if (batch && maxQty === 0) errors.qty = 'Nothing left in this batch to send back'
  else if (batch && qty > maxQty) errors.qty = `At most ${maxQty} units of this batch can be requested`
  if (!form.reason) errors.reason = 'Select a reason'
  if (form.reason === 'Other' && !form.note.trim()) errors.note = 'Describe the problem'
  return errors
}
