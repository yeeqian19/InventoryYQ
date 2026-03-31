import { PrismaClient } from './generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const globalForPrisma = global as unknown as { prisma: PrismaClient };

// 1. Create a standard connection pool using your DATABASE_URL
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
}) as any;

// 2. Wrap the pool in the official Prisma adapter
const adapter = new PrismaPg(pool);

// 3. Pass the adapter into the PrismaClient constructor
export const db = globalForPrisma.prisma || new PrismaClient({ adapter });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db;

export default db;
