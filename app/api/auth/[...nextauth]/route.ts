import NextAuth, { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { db } from '@/lib/db';
import type { UserRole } from '@/types';

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        console.log("🔑 LOGIN ATTEMPT FOR:", credentials.email);

        try {
          // 1. Fetch user from DB
          const user = await db.users.findFirst({
            where: { email: { equals: credentials.email.trim(), mode: 'insensitive' } },
          });

          if (!user) {
            console.log("❌ USER NOT FOUND IN HEIDISQL");
            return null;
          }

          console.log("✅ USER FOUND! ROLE:", user.role);

          // 2. Password Check Logic
          if (!user.password_hash) {
            console.log("❌ NO PASSWORD HASH ON RECORD");
            return null;
          }

          // Normalize PHP-style $2y$ hashes to Node.js $2b$ format
          const normalizedHash = user.password_hash.replace(/^\$2y\$/, '$2b$');
          const isHashValid = await bcrypt.compare(credentials.password, normalizedHash);
          if (!isHashValid) {
            console.log("❌ PASSWORD MISMATCH");
            return null;
          }

          console.log("🎉 LOGIN SUCCESSFUL!");

          // 3. Return user object for the session
          return {
            id: String(user.id),
            email: user.email,
            name: user.name || 'User',
            role: (user.role || 'USER_RM') as UserRole,
            branchCode: user.branch_name || '',
          };
        } catch (error) {
          console.error("🔥 DATABASE ERROR:", error);
          return null;
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = user.role;
        token.branchCode = user.branchCode;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.role = token.role;
        session.user.branchCode = token.branchCode;
      }
      return session;
    },
  },
  pages: {
    signIn: '/',
  },
  session: {
    strategy: 'jwt',
  },
  secret: process.env.NEXTAUTH_SECRET,
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };