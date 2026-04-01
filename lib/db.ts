/* 🟢 FIX: Removed '/client' because your files are directly in 'prisma' folder */
import { PrismaClient } from './generated/prisma'; 
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

// 1. Setup Global Prisma to prevent multiple connections during development
const globalForPrisma = global as unknown as { prisma: PrismaClient };

// 2. Create the connection pool with 'as any' to fix the Type Error (Pool Config)
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
}) as any;

// 3. Wrap the pool in the official Prisma adapter
const adapter = new PrismaPg(pool);

// 4. Create and export the DB instance using the adapter
export const db = globalForPrisma.prisma || new PrismaClient({ adapter });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db;

export default db;