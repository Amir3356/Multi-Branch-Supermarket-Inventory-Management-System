import express from 'express'
import { forward } from '../controllers/proxy.controller.js'
import { authenticate, resolveService } from '../middleware/index.js'

// /api/*: find the owning service → identify the caller → proxy
export const apiRouter = express.Router()
apiRouter.use(resolveService, authenticate, forward)
