import { NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import type { NextRequest } from 'next/server';

export async function middleware(req: NextRequest) {
  const token = await getToken({ req });
  const { pathname } = req.nextUrl;

  // ── 1. Unauthenticated users ──────────────────────────────────────────────
  // The root page (/) handles its own login UI via LoginClient, so let it through.
  // Everything else that requires auth gets bounced to /.
  if (!token) {
    if (pathname === '/') return NextResponse.next();
    return NextResponse.redirect(new URL('/', req.url));
  }

  // ── 2. Authenticated users ────────────────────────────────────────────────
  const role = token.role as string;

  // BRANCH: can only access the root control panel and their own inventory section
  if (role === 'BRANCH') {
    const allowed =
      pathname === '/' ||
      pathname.startsWith('/inventory-branch');
    if (!allowed) {
      return NextResponse.redirect(new URL('/', req.url));
    }
  }

  // ADMIN: cannot access staff management or the branch terminal
  if (role === 'ADMIN') {
    const blocked =
      pathname.startsWith('/staff-management') ||
      pathname.startsWith('/inventory-branch');
    if (blocked) {
      return NextResponse.redirect(new URL('/', req.url));
    }
  }

  // SUPERADMIN: full access — no extra rules needed

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
