// Field errors for the Record Damaged Item form; empty when the write-off can be recorded
export function validateDamage(form, product, qty) {
  const errors = {}
  if (!form.branchId) errors.branchId = 'Select the branch where the damage happened'
  if (!form.category) errors.category = form.branchId ? 'Select a category' : 'Select a branch first'
  if (!product) errors.key = form.category ? 'Select a product' : 'Select a category first'
  if (!Number.isInteger(qty) || qty < 1) errors.qty = 'Enter a whole number of at least 1'
  else if (product && qty > product.stock) errors.qty = `Only ${product.stock} units in stock at this branch`
  if (!form.reason) errors.reason = 'Select a reason'
  return errors
}
