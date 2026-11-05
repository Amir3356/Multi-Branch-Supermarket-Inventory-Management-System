import { gt, max, numeric, required, validateRules } from '../../utils/rules.js'

/** UpdateSellingPriceRequest (also used when a transfer is received) */
export const SELLING_PRICE_RULES = (() => {
  const message = 'Enter a selling price greater than 0'
  return { sellingPrice: [required(message), numeric(message), gt(0, message), max(10000000, message)] }
})()

/** PUT /products/:product/selling-price → req.validated { sellingPrice } */
export async function validateSellingPrice(req, res, next) {
  req.validated = await validateRules(SELLING_PRICE_RULES, req.body)
  next()
}
