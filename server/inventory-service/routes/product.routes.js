import { Router } from '../utils/index.js'
import { requireAuth, requireRole } from '../middleware/index.js'
import { bindProduct } from '../middleware/bindings.js'
import { validateSellingPrice } from '../middleware/validators/product.validator.js'
import * as productController from '../controllers/product.controller.js'

/**
 * The product catalog: every page that picks a product reads it; prices are shared by every branch.
 *   GET /products                         every signed-in role
 *   PUT /products/:product/selling-price  Inventory Officer (pharmacist)
 */
export const productRouter = Router()

productRouter.get('/products', requireAuth, productController.index)
productRouter.put('/products/:product/selling-price', requireRole('pharmacist'), bindProduct, validateSellingPrice, productController.updateSellingPrice)
