// prisma.config.ts
import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  // This satisfies the CLI (P1012 error) for Prisma 7
  datasource: {
    url: process.env["DATABASE_URL"],
  },
});