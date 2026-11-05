/**
 * stock_movements: one row per reference of a stock move requested by another service (the idempotency ledger of
 * /internal/stock/*). `result` is the first call's answer, replayed on a retry; `released_at` marks a take put back.
 */
export const TABLE = 'stock_movements'
export const KINDS = Object.freeze({ TAKE: 'take', ADD: 'add' })
