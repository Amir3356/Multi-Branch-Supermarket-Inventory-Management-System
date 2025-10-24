import { createSelector } from '@reduxjs/toolkit'
import { todayKey } from '../../../utils'
import { selectBranches } from '../../branches/store/branchesSlice'
import { selectSales } from '../../sales/store/salesSlice'
import { selectPurchases } from '../../purchases/store/purchasesSlice'
import { selectCustomerReturns } from '../../customerReturns/store/customerReturnsSlice'
import { selectSupplierReturns } from '../../supplierReturns/store/supplierReturnsSlice'
import { selectProducts } from '../../inventory/store/productsSlice'
import EXPENSES from '../../../data/expenses.json'
import DAILY_PERFORMANCE from '../../../data/dailyPerformance.json'
import CATEGORY_SALES from '../../../data/categorySales.json'

// Daily performance per branch: the history file covers past days; today comes from live records
export const selectPerformanceRows = createSelector(
  [selectBranches, selectSales, selectPurchases, selectCustomerReturns, selectSupplierReturns, selectProducts],
  (branches, sales, purchases, customerReturns, supplierReturns, products) => {
    const today = todayKey()
    const costOf = (name, qty) => (products.find((m) => m.name === name)?.purchasePrice || 0) * qty
    const todayRows = branches.map((b) => {
      const branchSales = sales.filter((s) => s.branchId === b.id && s.date === today)
      const refunds = customerReturns.filter((r) => r.branchId === b.id && r.date === today)
      return {
        date: today,
        branchId: b.id,
        transactions: branchSales.length,
        unitsSold: branchSales.reduce((sum, s) => sum + s.qty, 0),
        // Refunds given today reduce revenue; resellable returns also give back their cost of goods
        revenue: branchSales.reduce((sum, s) => sum + s.total, 0) - refunds.reduce((sum, r) => sum + r.refund, 0),
        costOfGoods:
          branchSales.reduce((sum, s) => sum + costOf(s.product, s.qty), 0) -
          refunds.filter((r) => r.condition === 'Resellable').reduce((sum, r) => sum + costOf(r.product, r.qty), 0),
        // Credits from stock sent back to suppliers today reduce what was spent on purchases
        purchases:
          purchases.filter((p) => p.branchId === b.id && p.date === today).reduce((sum, p) => sum + p.total, 0) -
          supplierReturns.filter((r) => r.branchId === b.id && r.date === today).reduce((sum, r) => sum + r.credit, 0),
        expenses: EXPENSES.filter((e) => e.branchId === b.id && e.date === today).reduce((sum, e) => sum + e.amount, 0)
      }
    })
    return [...DAILY_PERFORMANCE.filter((r) => r.date < today), ...todayRows]
  }
)

// Units and revenue per category per day (history + today's sales)
export const selectCategoryRows = createSelector([selectSales], (sales) => {
  const today = todayKey()
  return [
    ...CATEGORY_SALES.filter((r) => r.date < today),
    ...sales.filter((s) => s.date === today).map((s) => ({ date: today, branchId: s.branchId, category: s.category, unitsSold: s.qty, revenue: s.total }))
  ]
})
