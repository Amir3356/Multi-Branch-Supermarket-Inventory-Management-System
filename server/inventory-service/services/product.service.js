import { audit, broadcast, money } from '../utils/index.js'
import { allProducts, setPrices } from '../repositories/product.repository.js'

/** The whole catalog, by category then name */
export const list = () => allProducts()

/** Every screen reloads the catalog (e.g. a cashier can sell the product right away) */
export const announceProducts = () => broadcast('products', 'products.changed', {})

/** The product's selling price, at every branch. Returns the updated products row. */
export async function setSellingPrice(req, product, data) {
  const previous = product.selling_price
  // A single UPDATE, as in Laravel (no surrounding transaction)
  const updated = await setPrices(undefined, product.id, null, Number(data.sellingPrice), req.user.id)

  audit(req, {
    module: 'Products',
    action: 'Selling price changed',
    recordId: updated.id,
    description: `${updated.name}: ${previous === null ? 'not set' : money(previous)} → ${money(updated.selling_price)} at every branch.`,
    branchId: req.user.branchId,
  })
  announceProducts()

  return updated
}
