import { NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import type { NextRequest } from 'next/server';
import type { UserRole } from '@/types';

export async function middleware(req: NextRequest) {
  const token = await getToken({ req });
  const { pathname } = req.nextUrl;

  // ── 1. Unauthenticated users ──────────────────────────────────────────────
  if (!token) {
    if (pathname === '/') return NextResponse.next();
    return NextResponse.redirect(new URL('/', req.url));
  }

  // ── 2. Authenticated users ────────────────────────────────────────────────
  const role = token.role as UserRole;

  if (role === 'USER_BM') {
    const allowed = pathname === '/' || pathname.startsWith('/inventory-branch');
    if (!allowed) return NextResponse.redirect(new URL('/inventory-branch', req.url));
  } else if (role === 'USER_RM') {
    const blocked =
      pathname.startsWith('/staff-management') ||
      pathname.startsWith('/stock-management') ||
      pathname.startsWith('/scan-approve') ||
      pathname.startsWith('/bm-pickup');
    if (blocked) return NextResponse.redirect(new URL('/', req.url));
  } else if (role === 'ADMIN_HQ') {
    const blocked =
      pathname.startsWith('/staff-management') ||
      pathname.startsWith('/RM_Dashboard');
    if (blocked) return NextResponse.redirect(new URL('/', req.url));
  }
  // SUPERADMIN: full access

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
