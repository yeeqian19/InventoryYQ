import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import bcrypt from 'bcrypt';
import { sendWelcomeEmail } from '@/lib/mail';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { canManageUsers } from '@/lib/permissions';
import { ALL_ROLES } from '@/types';

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!canManageUsers(session.user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { name, email, password, role, branchCode } = await req.json();

    if (!name || !email || !password || !role) {
      return NextResponse.json({ error: 'All required fields must be filled.' }, { status: 400 });
    }

    if (!ALL_ROLES.includes(role)) {
      return NextResponse.json({ error: `Invalid role. Must be one of: ${ALL_ROLES.join(', ')}` }, { status: 400 });
    }

    if (role === 'USER_BM' && !branchCode) {
      return NextResponse.json({ error: 'Branch Manager (USER_BM) requires a branch code.' }, { status: 400 });
    }

    const existingUser = await db.users.findUnique({ where: { email } });
    if (existingUser) {
      return NextResponse.json({ error: 'Email already exists!' }, { status: 400 });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    await db.users.create({
      data: {
        name,
        email,
        password_hash: hashedPassword,
        role,
        branch_name: role === 'USER_BM' ? branchCode : null,
      },
    });

    sendWelcomeEmail({
      name,
      email,
      role,
      branchCode: role === 'USER_BM' ? branchCode : null,
      temporaryPassword: password,
    }).catch((err) => console.error('Welcome email failed:', err));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error creating user:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
