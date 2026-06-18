import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { encode } from 'next-auth/jwt';
import { db } from '@/lib/db';
import type { UserRole } from '@/types';
import { DEMO_ACCOUNTS, DEMO_PASSWORD } from '@/lib/mobileDemo';

// Mobile login: validates credentials (same logic as the NextAuth Credentials
// provider) and returns a NextAuth-encoded session token. The React Native app
// stores it and sends it back as the `next-auth.session-token` cookie, so every
// existing API route that uses getServerSession() accepts it unchanged.
export async function POST(request: NextRequest) {
  let email = '';
  let password = '';
  try {
    const body = await request.json();
    email = (body.email ?? '').trim();
    password = body.password ?? '';
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  if (!email || !password) {
    return NextResponse.json({ error: 'Email and password are required.' }, { status: 400 });
  }

  // DEV DEMO LOGIN — no DB, no secret needed. Disabled in production.
  if (process.env.NODE_ENV !== 'production') {
    const demo = DEMO_ACCOUNTS[email.toLowerCase()];
    if (demo && password === DEMO_PASSWORD) {
      return NextResponse.json({
        token: `demo.${email.toLowerCase()}`,
        user: { id: 'demo', email, name: demo.name, role: demo.role, branchCode: demo.branchCode },
      });
    }
  }

  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) {
    return NextResponse.json({ error: 'Server auth not configured' }, { status: 500 });
  }

  const user = await db.users.findFirst({
    where: { email: { equals: email, mode: 'insensitive' } },
  });
  if (!user || !user.password_hash) {
    return NextResponse.json({ error: 'Invalid Email or Password.' }, { status: 401 });
  }

  // Normalize PHP-style $2y$ hashes to Node's $2b$ format (same as the web login).
  const normalizedHash = user.password_hash.replace(/^\$2y\$/, '$2b$');
  const ok = await bcrypt.compare(password, normalizedHash);
  if (!ok) {
    return NextResponse.json({ error: 'Invalid Email or Password.' }, { status: 401 });
  }

  const role = (user.role ?? 'USER_RM') as UserRole;
  const branchCode = user.branch_name ?? '';

  // Build the same token shape the NextAuth jwt callback produces.
  const token = await encode({
    token: {
      sub: String(user.id),
      email: user.email ?? undefined,
      name: user.name ?? 'User',
      role,
      branchCode,
    },
    secret,
    maxAge: 30 * 24 * 60 * 60, // 30 days
  });

  return NextResponse.json({
    token,
    user: {
      id: String(user.id),
      email: user.email,
      name: user.name ?? 'User',
      role,
      branchCode,
    },
  });
}
