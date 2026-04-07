import { NextResponse } from 'next/server';
import bcrypt from 'bcrypt';
import { db } from '@/lib/db';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]/route';
import { canManageUsers } from '@/lib/permissions';
import { ALL_ROLES } from '@/types';

// POST /api/admin/create-user
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    if (!canManageUsers(session.user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { email, password, role, branch_name, name } = body;

    if (!email || !password || !role) {
      return NextResponse.json({ error: 'Missing required fields: email, password, role' }, { status: 400 });
    }

    if (!ALL_ROLES.includes(role)) {
      return NextResponse.json({ error: `Invalid role. Must be one of: ${ALL_ROLES.join(', ')}` }, { status: 400 });
    }

    // USER_BM must have a branch assigned
    if (role === 'USER_BM' && !branch_name) {
      return NextResponse.json({ error: 'USER_BM requires a branch_name.' }, { status: 400 });
    }

    const existingUser = await db.users.findUnique({ where: { email: email.toLowerCase().trim() } });
    if (existingUser) {
      return NextResponse.json({ error: 'User with this email already exists' }, { status: 409 });
    }

    const password_hash = await bcrypt.hash(password, 10);

    const newUser = await db.users.create({
      data: {
        email: email.toLowerCase().trim(),
        password_hash,
        role,
        branch_name: role === 'USER_BM' ? branch_name || null : null,
        name: name || null,
      },
    });

    return NextResponse.json({ success: true, user: { id: newUser.id, email: newUser.email, role: newUser.role, branch_name: newUser.branch_name } });
  } catch (error) {
    console.error('Create user error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
