import { one, query } from '../utils/index.js'
import { nowSeconds } from '../utils/support.js'

/** The whole catalog, by category then name */
export const allProducts = () => query('select * from products order by category, name')

export const findProduct = (id, client) => one('select * from products where id = $1', [id], client)

/**
 * Sets the shared prices of a product (either may be null: left as is) and who set them; returns the product row, or
 * null when it isn't in the catalog. Postgres rounds to 2 decimals on save, as PHP's round($x, 2) did.
 * Like Eloquent's update(), nothing is written (updated_at kept) when the values are already the same.
 */
export async function setPrices(client, id, purchasePrice, sellingPrice, byUserId) {
  if (!id) return null
  const purchase = purchasePrice === null || purchasePrice === undefined ? null : String(purchasePrice)
  const selling = sellingPrice === null || sellingPrice === undefined ? null : String(sellingPrice)
  const by = byUserId ?? null

  const updated = await one(
    `update products set
       purchase_price = coalesce($2::numeric(12, 2), purchase_price),
       selling_price = coalesce($3::numeric(12, 2), selling_price),
       price_set_by = $4,
       updated_at = $5
     where id = $1
       and (purchase_price is distinct from coalesce($2::numeric(12, 2), purchase_price)
         or selling_price is distinct from coalesce($3::numeric(12, 2), selling_price)
         or price_set_by is distinct from $4::bigint)
     returning *`,
    [id, purchase, selling, by, nowSeconds()],
    client,
  )
  return updated ?? findProduct(id, client)
}
