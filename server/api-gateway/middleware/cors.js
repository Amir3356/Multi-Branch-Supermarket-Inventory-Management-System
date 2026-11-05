import cors from 'cors'

// Same open policy the Laravel API had: any origin may call it; it authenticates with bearer tokens, not cookies
export const corsPolicy = cors({ origin: true, credentials: false, exposedHeaders: ['RateLimit', 'RateLimit-Policy', 'Retry-After'] })
