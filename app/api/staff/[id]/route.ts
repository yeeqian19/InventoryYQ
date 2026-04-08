import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import bcrypt from 'bcryptjs';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { canManageUsers } from '@/lib/permissions';
import { ALL_ROLES } from '@/types';

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!canManageUsers(session.user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;
    const userId = parseInt(id, 10);
    if (isNaN(userId)) return NextResponse.json({ error: 'Invalid user ID.' }, { status: 400 });

    const { name, email, password, role, branchCode } = await req.json();

    if (!name || !email || !role) {
      return NextResponse.json({ error: 'Name, email, and role are required.' }, { status: 400 });
    }

    if (!ALL_ROLES.includes(role)) {
      return NextResponse.json({ error: `Invalid role. Must be one of: ${ALL_ROLES.join(', ')}` }, { status: 400 });
    }

    const existing = await db.users.findUnique({ where: { email } });
    if (existing && existing.id !== userId) {
      return NextResponse.json({ error: 'Email is already in use by another account.' }, { status: 400 });
    }

    const updateData: Record<string, unknown> = {
      name,
      email,
      role,
      branch_name: role === 'USER_BM' ? branchCode || null : null,
    };

    if (password && password.trim() !== '') {
      updateData.password_hash = await bcrypt.hash(password, 10);
    }

    await db.users.update({ where: { id: userId }, data: updateData });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating user:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!canManageUsers(session.user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;
    const userId = parseInt(id, 10);
    if (isNaN(userId)) return NextResponse.json({ error: 'Invalid user ID.' }, { status: 400 });

    await db.users.delete({ where: { id: userId } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting user:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
