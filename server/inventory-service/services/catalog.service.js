import { broadcast } from '../utils/index.js'
import * as cache from '../utils/cache.js'

/**
 * The product catalog as GET /products returns it is cached: almost every screen reads it, and it changes only when a
 * product is added, edited or deleted, or its prices are set. Each of those calls catalogChanged().
 */
export const PRODUCTS_KEY = 'catalog:products'
export const PRODUCTS_TTL_SECONDS = 600

/** Clears the cached catalog, then tells every open screen to reload it */
export async function catalogChanged() {
  await cache.forget(PRODUCTS_KEY)
  broadcast('products', 'products.changed', {})
}
