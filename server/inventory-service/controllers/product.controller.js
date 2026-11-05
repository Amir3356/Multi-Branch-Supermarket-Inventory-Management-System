import { toResource } from '../models/product.model.js'
import * as productService from '../services/product.service.js'

/** GET /products */
export async function index(req, res) {
  res.json({ data: (await productService.list()).map(toResource) })
}

/** PUT /products/:product/selling-price (req.product from bindProduct, req.validated from the validator) */
export async function updateSellingPrice(req, res) {
  const updated = await productService.setSellingPrice(req, req.product, req.validated)

  // selling_price is the decimal:2 string ("12.50"), as the PHP message showed it
  res.json({ message: `${updated.name} now sells for ${updated.selling_price} at every branch.`, product: toResource(updated) })
}
