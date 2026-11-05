import { isInternalPath, serviceFor } from '../models/route.model.js'

/** Finds the service that owns the path (req.targetService); unknown and /internal paths are 404 */
export function resolveService(req, res, next) {
  if (isInternalPath(req.path)) return res.status(404).json({ message: 'Not found.' })
  const service = serviceFor(req.path)
  if (!service) return res.status(404).json({ message: `The route api${req.path} could not be found.` })
  req.targetService = service
  next()
}
