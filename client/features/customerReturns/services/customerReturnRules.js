// Field errors for the Customer Return form; `remaining` is how many units of the sale are not yet returned
export function validateCustomerReturn(form, { sale, qty, remaining }) {
  const errors = {}
  if (!form.category) errors.category = 'Select a category'
  if (!form.product) errors.product = form.category ? 'Select a product' : 'Select a category first'
  if (!sale) errors.saleId = form.product ? 'Select the original sale' : 'Select a product first'
  if (!Number.isInteger(qty) || qty < 1) errors.qty = 'Enter a whole number of at least 1'
  else if (sale && qty > remaining) errors.qty = `Only ${remaining} ${remaining === 1 ? 'unit' : 'units'} from this sale can still be returned`
  if (!form.reason) errors.reason = 'Select a reason'
  if (!form.condition) errors.condition = 'Select the item condition'
  return errors
}
