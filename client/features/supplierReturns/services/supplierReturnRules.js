// Field errors for the Supplier Return form. A return can't exceed what is left unreturned on the
// purchase, nor what the branch still holds (maxReturn is the smaller of the two).
export function validateSupplierReturn(form, { purchase, qty, maxReturn, unreturned, branchStock, branchName }) {
  const errors = {}
  if (!form.category) errors.category = 'Select a category'
  if (!form.product) errors.product = form.category ? 'Select a product' : 'Select a category first'
  if (!purchase) errors.purchaseId = form.product ? 'Select the batch number' : 'Select a product first'
  if (!Number.isInteger(qty) || qty < 1) errors.qty = 'Enter a whole number of at least 1'
  else if (purchase && maxReturn === 0) errors.qty = `${branchName} has no ${purchase.product} left to send back`
  else if (purchase && qty > maxReturn) {
    errors.qty = qty > unreturned
      ? `Only ${unreturned} units from this batch can still be returned`
      : `${branchName} only has ${branchStock} units in stock`
  }
  if (!form.reason) errors.reason = 'Select a reason'
  return errors
}
