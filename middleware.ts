import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function middleware(req: NextRequest) {
  let res = NextResponse.next({
    request: {
      headers: req.headers,
    },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://mock.supabase.co',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'mock-key',
    {
      cookies: {
        getAll() {
          return req.cookies.getAll().map(({ name, value }) => ({ name, value }));
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => req.cookies.set({ name, value, ...options }));
          res = NextResponse.next({
            request: {
              headers: req.headers,
            },
          });
          cookiesToSet.forEach(({ name, value, options }) => res.cookies.set({ name, value, ...options }));
        },
      },
    }
  );

  // Safely retrieve the current session
  const { data: { session } } = await supabase.auth.getSession();


  const { pathname } = req.nextUrl;

  // Protected paths list
  const isProtectedPath = 
    pathname.startsWith('/dashboard') ||
    pathname.startsWith('/aoi') ||
    pathname.startsWith('/analysis') ||
    pathname.startsWith('/reports') ||
    pathname.startsWith('/settings');

  const isAuthPath = pathname === '/login' || pathname === '/register';

  // Redirect to login if path is protected and user has no session
  if (!session && isProtectedPath) {
    const redirectUrl = new URL('/login', req.url);
    // Remember redirect destination
    redirectUrl.searchParams.set('redirectedFrom', pathname);
    return NextResponse.redirect(redirectUrl);
  }

  // Redirect to dashboard if logged in and attempting to access login/register
  if (session && isAuthPath) {
    return NextResponse.redirect(new URL('/dashboard', req.url));
  }

  return res;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - api/auth (auth routes)
     * - mock (static mocks)
     */
    '/((?!_next/static|_next/image|favicon.ico|api/auth|mock).*)',
  ],
};
