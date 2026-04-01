import { NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import type { NextRequest } from 'next/server';

export async function middleware(req: NextRequest) {
  // 1. Get the "ID Badge" (Token) from the browser cookies
  const token = await getToken({ req });
  const { pathname } = req.nextUrl;

  // 2. If NOT logged in and NOT on the login page, kick them to /login
  if (!token && pathname !== '/login') {
    return NextResponse.redirect(new URL('/login', req.url));
  }

  // 3. If they ARE logged in, check their Role vs the Room they want to enter
  if (token) {
    const role = token.role as string;

    // --- RULE A: BRANCH USERS ---
    // If a Branch user tries to go ANYWHERE except their specific folder, stop them.
    if (role === 'BRANCH' && !pathname.startsWith('/inventory-branch')) {
      return NextResponse.redirect(new URL('/inventory-branch', req.url));
    }

    // --- RULE B: ADMIN USERS ---
    // Admins can see RM Dashboard, HQ, and Stock, but NOT the login page again.
    const adminAllowedPaths = ['/rm_dashboard', '/stock-management', '/scan-approve', '/scan-log', '/student-manager'];
    
    if (role === 'ADMIN' && pathname === '/login') {
        return NextResponse.redirect(new URL('/rm_dashboard', req.url));
    }

    // --- RULE C: SUPERADMIN ---
    // They have the master key. If they log in, send them to the main HQ Dashboard.
    if (role === 'SUPERADMIN' && pathname === '/login') {
        return NextResponse.redirect(new URL('/scan-approve', req.url));
    }
  }

  return NextResponse.next();
}

// 🛡️ This part tells the middleware WHICH folders to guard
export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};