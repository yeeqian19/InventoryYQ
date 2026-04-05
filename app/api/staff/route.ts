import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import bcrypt from 'bcrypt';
import { sendWelcomeEmail } from '@/lib/mail';

export async function POST(req: Request) {
  try {
    const { name, email, password, role, branchCode } = await req.json();

    if (!name || !email || !password || !role) {
      return NextResponse.json({ error: 'All required fields must be filled.' }, { status: 400 });
    }

    // 1. Check if email is already in use
    const existingUser = await db.users.findUnique({ where: { email } });
    if (existingUser) {
      return NextResponse.json({ error: 'Email already exists!' }, { status: 400 });
    }

    // 2. Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);

    // 3. Save to database
    await db.users.create({
      data: {
        name,
        email,
        password_hash: hashedPassword,
        role,
        branch_name: role === 'BRANCH' ? branchCode : null,
      },
    });

    // 4. Send welcome email (non-blocking — we don't fail the request if email fails)
    sendWelcomeEmail({
      name,
      email,
      role,
      branchCode: role === 'BRANCH' ? branchCode : null,
      temporaryPassword: password,        // raw password before hashing
    }).catch((err) => {
      console.error('Welcome email failed to send:', err);
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error creating user:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
