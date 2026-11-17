import { NextRequest, NextResponse } from 'next/server'
import { SESSION_COOKIE, verifySessionJwt } from '@/lib/session'

export const config = {
  matcher: ['/((?!api|login|_next/static|_next/image|favicon\\.ico|.*\\..*).*)'],
}

export async function middleware(request: NextRequest): Promise<NextResponse> {
  // Fail closed: an unusable session (missing cookie, tampered JWT, or unset JWT_SECRET)
  // sends the user to /login rather than raising a 500 on every protected page.
  try {
    const sub = await verifySessionJwt(request.cookies.get(SESSION_COOKIE)?.value)
    if (!sub) {
      return NextResponse.redirect(new URL('/login', request.url))
    }
  } catch {
    return NextResponse.redirect(new URL('/login', request.url))
  }
  return NextResponse.next()
}
