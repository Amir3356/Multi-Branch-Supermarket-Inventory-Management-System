import { serviceProxies } from '../services/proxy.service.js'

/** Hands the request to the proxy of the service resolveService chose */
export function forward(req, res, next) {
  return serviceProxies[req.targetService](req, res, next)
}
