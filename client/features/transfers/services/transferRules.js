// Field errors for the New Stock Transfer form; empty when the transfer can be made
export function validateTransfer(form, product, batchRow, qty, maxQty) {
  const errors = {}
  if (!form.from) errors.from = 'Select the branch sending the stock'
  if (!form.to) errors.to = 'Select the branch receiving the stock'
  else if (form.to === form.from) errors.to = 'Choose a different branch from the sending branch'
  if (!form.category) errors.category = form.from ? 'Select a category' : 'Select the sending branch first'
  if (!product) errors.key = form.category ? 'Select a product' : 'Select a category first'
  else if (!batchRow) errors.batch = 'Select the batch number'
  if (!Number.isInteger(qty) || qty < 1) errors.qty = 'Enter a whole number of at least 1'
  else if (batchRow && qty > batchRow.stock) errors.qty = `Only ${batchRow.stock} units left in batch ${batchRow.batch}`
  else if (qty > maxQty) errors.qty = `A single transfer can move at most ${maxQty} units`
  return errors
}
