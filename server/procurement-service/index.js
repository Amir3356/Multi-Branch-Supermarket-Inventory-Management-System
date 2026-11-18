import { createService } from './utils/index.js'
import { registerRoutes } from './routes/index.js'
import { procurementGrpc } from './controllers/internal.grpc.js'

/** procurement-service: purchase orders and their Chapa payments. Routes are mounted in routes/index.js. */
createService({ grpc: procurementGrpc, name: 'procurement-service', key: 'procurement', routes: registerRoutes })
