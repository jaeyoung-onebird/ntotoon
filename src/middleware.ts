import { NextRequest, NextResponse } from 'next/server';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Cache-Control for uploaded assets
  if (pathname.startsWith('/uploads/')) {
    const response = NextResponse.next();
    response.headers.set('Cache-Control', 'public, max-age=31536000, immutable');
    return response;
  }

  // CSRF protection for mutating API requests (exclude auth routes)
  if (
    pathname.startsWith('/api/') &&
    !pathname.startsWith('/api/auth/') &&
    ['POST', 'PUT', 'DELETE'].includes(request.method)
  ) {
    const origin = request.headers.get('origin');
    const referer = request.headers.get('referer');
    const host = request.headers.get('host');

    if (!host) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const isOriginValid = origin && new URL(origin).host === host;
    const isRefererValid = referer && new URL(referer).host === host;

    if (!isOriginValid && !isRefererValid) {
      return NextResponse.json({ error: 'Forbidden: CSRF validation failed' }, { status: 403 });
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/api/:path*', '/uploads/:path*'],
};
