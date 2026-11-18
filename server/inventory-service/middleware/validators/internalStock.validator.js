import { z } from '../../utils/index.js'

const text = (field, maxLength = 255) =>
  z.string({ error: `The ${field} field is required.` }).min(1, { error: `The ${field} field is required.` }).max(maxLength, { error: `The ${field} field is too long.` })
const units = (field) => z.number({ error: `The ${field} field must be a whole number.` }).int({ error: `The ${field} field must be a whole number.` }).positive({ error: `The ${field} field must be at least 1.` })
// Numeric strings too: callers may pass a numeric column ("120.50") straight through
const price = (field) =>
  z.preprocess(
    (v) => (typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v)) ? Number(v) : v),
    z.number({ error: `The ${field} field must be a number.` }).nonnegative({ error: `The ${field} field must not be negative.` }).nullish(),
  )

export const takeSchema = z.object({
  reference: text('reference', 120),
  branchId: text('branchId', 20),
  product: text('product'),
  parts: z.array(z.object({ batch: text('batch', 50), qty: units('qty') }), { error: 'The parts field is required.' }).min(1, { error: 'The parts field is required.' }),
  expiredAction: z.enum(['sold', 'sent'], { error: 'The expiredAction field must be sold, sent or null.' }).nullish(),
})

export const releaseSchema = z.object({ reference: text('reference', 120) })

export const receiveSchema = z.object({
  reference: text('reference', 120),
  branchId: text('branchId', 20),
  product: text('product'),
  category: text('category'),
  medId: z.string({ error: 'The medId field must be a string.' }).max(20).nullish(),
  // The catalog Batch ID the Purchase Officer bought (procurements.product_batch)
  batch: z.string({ error: 'The batch field must be a string.' }).max(50).nullish(),
  expiry: z.iso.date({ error: 'The expiry field must be a date (YYYY-MM-DD).' }).nullish(),
  units: units('units'),
  receivedAt: z.iso.datetime({ offset: true, error: 'The receivedAt field must be an ISO 8601 date and time.' }).nullish(),
  purchasePrice: price('purchasePrice'),
  sellingPrice: price('sellingPrice'),
})

