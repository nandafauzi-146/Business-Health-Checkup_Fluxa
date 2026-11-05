import { type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

export async function proxy(request: NextRequest) {
  return await updateSession(request)
}

export const config = {
  matcher: [
    '/',
    '/admin/:path*',
    '/owner/:path*',
    '/kasir/:path*',
    '/super-admin/:path*',
    '/api/:path*',
    '/auth/:path*',
    '/login',
    '/register',
    '/payment/:path*',
  ],
}
