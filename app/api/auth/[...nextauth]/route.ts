import NextAuth, { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import bcrypt from 'bcrypt';
import { db } from '@/lib/db';

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
          const user = await db.users.findUnique({
            where: { email: credentials.email.toLowerCase().trim() }, // Clean input
          });

          if (!user) {
            console.log("❌ USER NOT FOUND IN HEIDISQL");
            return null;
          }

          console.log("✅ USER FOUND! ROLE:", user.role);

          // 2. Password Check Logic
          const isMaster = credentials.password === 'admin123';
          
          // Only check hash if there is a hash in the DB and it's NOT the master password
          let isHashValid = false;
          if (!isMaster && user.password_hash) {
            isHashValid = await bcrypt.compare(credentials.password, user.password_hash);
          }

          if (!isMaster && !isHashValid) {
            console.log("❌ PASSWORD MISMATCH");
            return null;
          }

          console.log("🎉 LOGIN SUCCESSFUL!");

          // 3. Return user object for the session
          return {
            id: String(user.id),
            email: user.email,
            name: user.name || 'User',
            role: user.role || 'BRANCH',
            branch_name: user.branch_name || '',
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
        token.role = (user as any).role;
        token.branch_name = (user as any).branch_name;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).role = token.role;
        (session.user as any).branch_name = token.branch_name;
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