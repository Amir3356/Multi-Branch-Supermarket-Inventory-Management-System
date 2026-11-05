import { Router } from '../utils/index.js'
import { requireActiveBranch, requireRole } from '../middleware/index.js'
import { validateStoreExpense } from '../middleware/validators/expense.validator.js'
import * as controller from '../controllers/expense.controller.js'

// A branch's expenses, recorded by its Inventory Officer; the Owner and Procurement Officer can read all
const router = Router()

router.get('/expenses', requireRole('pharmacist', 'owner', 'purchase_officer'), controller.index)
// A deactivated (closed) branch records none
router.post('/expenses', requireRole('pharmacist'), requireActiveBranch('record expenses'), validateStoreExpense, controller.store)
router.delete('/expenses/:expense', requireRole('pharmacist'), controller.destroy)

export default router
