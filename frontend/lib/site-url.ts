/**
 * frontend/lib/site-url.ts
 *
 * Centralized site URL helper for FLUXA application navigation and callbacks.
 * Official production URL: https://business-health-checkup-fluxa.vercel.app
 */

export const PRODUCTION_SITE_URL = 'https://business-health-checkup-fluxa.vercel.app'
export const DEFAULT_LOCAL_URL = 'http://localhost:3000'

/**
 * Returns the configured production or base site URL.
 *
 * Priority order:
 * 1. NEXT_PUBLIC_SITE_URL environment variable
 * 2. In browser: window.location.origin
 * 3. Vercel deployment variables (VERCEL_PROJECT_PRODUCTION_URL / VERCEL_URL)
 * 4. Production fallback: PRODUCTION_SITE_URL
 * 5. Local development fallback: DEFAULT_LOCAL_URL
 */
export function getSiteUrl(): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim()
  if (configured) {
    return configured.replace(/\/+$/, '')
  }

  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin.replace(/\/+$/, '')
  }

  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL.replace(/\/+$/, '')}`
  }

  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL.replace(/\/+$/, '')}`
  }

  if (process.env.NODE_ENV === 'production') {
    return PRODUCTION_SITE_URL
  }

  return DEFAULT_LOCAL_URL
}

/**
 * Resolves the request origin reliably on the server, taking into account:
 * - Explicit NEXT_PUBLIC_SITE_URL
 * - x-forwarded-host & x-forwarded-proto from reverse proxies (Vercel)
 * - Fallback to PRODUCTION_SITE_URL in production, or request.url origin in development
 */
export function getRequestOrigin(request?: Request): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim()
  const isProd = process.env.NODE_ENV === 'production'

  if (configured && (isProd || !configured.includes('localhost'))) {
    return configured.replace(/\/+$/, '')
  }

  if (request) {
    const forwardedHost = request.headers.get('x-forwarded-host')
    const forwardedProto = request.headers.get('x-forwarded-proto') || 'https'
    if (forwardedHost) {
      return `${forwardedProto}://${forwardedHost}`.replace(/\/+$/, '')
    }

    const originHeader = request.headers.get('origin')
    if (originHeader && (isProd ? !originHeader.includes('localhost') : true)) {
      return originHeader.replace(/\/+$/, '')
    }

    try {
      const parsed = new URL(request.url)
      if (parsed.origin && (isProd ? !parsed.origin.includes('localhost') : true)) {
        return parsed.origin.replace(/\/+$/, '')
      }
    } catch {
      // ignore parsing error
    }
  }

  return getSiteUrl()
}

/**
 * Builds an absolute URL with the correct base domain and destination path.
 *
 * @param path - The target path, e.g. '/login', '/owner/langganan', '/payment/finish'
 * @param request - Optional incoming Request for server-side origin detection
 */
export function getAbsoluteUrl(path: string, request?: Request): string {
  const base = request ? getRequestOrigin(request) : getSiteUrl()
  const cleanPath = path.startsWith('/') ? path : `/${path}`
  return `${base}${cleanPath}`
}
