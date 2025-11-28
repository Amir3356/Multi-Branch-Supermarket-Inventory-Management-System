// Field errors for the New Sale form; empty when the sale can be recorded
export function validateSale(form, product, qty) {
  const errors = {}
  if (!form.branchId) errors.branchId = 'Select the branch making this sale'
  if (!form.category) errors.category = form.branchId ? 'Select a category' : 'Select a branch first'
  if (!product) errors.key = form.category ? 'Select a product' : 'Select a category first'
  if (!Number.isInteger(qty) || qty < 1) errors.qty = 'Enter a whole number of at least 1'
  // Expired batches don't count: they can't be sold
  else if (product && qty > product.stock) errors.qty = `Only ${product.stock} units in stock at this branch (expired batches can’t be sold)`
  return errors
}
