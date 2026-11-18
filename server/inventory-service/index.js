import { createService } from './utils/index.js'
import { registerRoutes } from './routes/index.js'
import { inventoryGrpc } from './controllers/internal.grpc.js'

/** inventory-service: the product catalog, stock at every branch, transfers and damaged items. Routes are mounted in routes/index.js. */
createService({ grpc: inventoryGrpc, name: 'inventory-service', key: 'inventory', routes: registerRoutes })
