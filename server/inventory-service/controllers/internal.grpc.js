import { validate } from '../utils/index.js'
import { receiveSchema, releaseSchema, takeSchema } from '../middleware/validators/internalStock.validator.js'
import { categoryCountQuery } from '../middleware/validators/product.validator.js'
import { receiveStock, releaseStock, takeStock } from '../services/stockMovement.service.js'
import * as productService from '../services/product.service.js'

/**
 * inventory-service's internal gRPC API (service Inventory in proto/supermarket.proto). Each handler checks its
 * request with the same rules the REST endpoints had and calls the same service function; ctx is the caller
 * ({ user, … }) forwarded in the call's metadata.
 */
const orNull = (value) => (value === '' || value === undefined ? null : value)

export const inventoryGrpc = {
  Inventory: {
    /** A sale or transfer takes units from named batches; a retry with the same reference gets the same answer */
    async TakeStock(request) {
      const body = validate(takeSchema, {
        reference: request.reference,
        branchId: request.branchId,
        product: request.product,
        parts: request.parts.map((p) => ({ batch: p.batch, qty: p.qty })),
        expiredAction: orNull(request.expiredAction),
      })
      const result = await takeStock(body)
      return { batchesJson: JSON.stringify(result.batches ?? []) }
    },

    /** The saga's compensation: puts back what a reference took */
    async ReleaseStock(request) {
      return releaseStock(validate(releaseSchema, { reference: request.reference }))
    },

    /** A paid procurement's units, under its Batch ID; the forwarded user is recorded as having set the prices */
    async ReceiveStock(request, ctx) {
      const body = validate(receiveSchema, {
        reference: request.reference,
        branchId: request.branchId,
        product: request.product,
        category: request.category,
        medId: orNull(request.medId),
        batch: orNull(request.batch),
        expiry: orNull(request.expiry),
        units: request.units,
        receivedAt: orNull(request.receivedAt),
        purchasePrice: request.pricesGiven ? request.purchasePrice : null,
        sellingPrice: request.pricesGiven ? request.sellingPrice : null,
      })
      const result = await receiveStock(body, ctx.user)
      return { batch: result.batch, productJson: JSON.stringify(result.product ?? null) }
    },

    /** How many catalog products are filed under a category */
    async CountProductsInCategory(request) {
      const { category } = validate(categoryCountQuery, { category: request.category })
      return { count: await productService.productsInCategory(category) }
    },
  },
}
