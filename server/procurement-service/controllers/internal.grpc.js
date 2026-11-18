import { notFound } from '../utils/index.js'
import { toResource } from '../models/category.model.js'
import { findByName } from '../repositories/category.repository.js'

/** procurement-service's internal gRPC API (service Procurement in proto/supermarket.proto) */
export const procurementGrpc = {
  Procurement: {
    /** A category by name, as the Purchase Officer spelled it; NOT_FOUND (404) when there is none */
    async LookupCategory(request) {
      const name = String(request.name ?? '').trim()
      const category = name ? await findByName(name) : null
      if (!category) throw notFound('No category with that name.')
      const resource = toResource(category)
      return { category: { id: resource.id, name: resource.name, createdAt: resource.createdAt ?? '' } }
    },
  },
}
