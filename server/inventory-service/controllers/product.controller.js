import * as cache from '../utils/cache.js'
import { PRODUCTS_KEY, PRODUCTS_TTL_SECONDS } from '../services/catalog.service.js'
import { toResource } from '../models/product.model.js'
import * as productService from '../services/product.service.js'

/** GET /products */
/** GET /products: the whole catalog, cached until a product or its prices change (catalog.service.js) */
export async function index(req, res) {
  const data = await cache.remember(PRODUCTS_KEY, PRODUCTS_TTL_SECONDS, async () => (await productService.list()).map(toResource))
  res.json({ data })
}

/** PUT /products/:product/selling-price (req.product from bindProduct, req.validated from the validator) */
export async function updateSellingPrice(req, res) {
  const updated = await productService.setSellingPrice(req, req.product, req.validated)

  // selling_price is the decimal:2 string ("12.50")
  res.json({ message: `${updated.name} now sells for ${updated.selling_price} at every branch.`, product: toResource(updated) })
}

/** POST /products (Purchase Officer) */
export async function store(req, res) {
  const product = await productService.create(req, req.body)
  res.status(201).json({ message: `${product.name} added to ${product.category} with Batch ID ${product.batch}.`, product: toResource(product) })
}

/** PATCH /products/:product (Purchase Officer; only before it has stock) */
export async function update(req, res) {
  const product = await productService.update(req, req.product, req.body)
  res.json({ message: `${product.name} saved.`, product: toResource(product) })
}

/** DELETE /products/:product (Purchase Officer; only before it has stock) */
export async function destroy(req, res) {
  const product = await productService.remove(req, req.product)
  res.json({ message: `${product.name} deleted.` })
}
