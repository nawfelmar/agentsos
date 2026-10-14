import path from "node:path";
import { PrismaClient } from "@prisma/client";

/** Ensure Prisma always has a SQLite URL, even if `.env` was not copied yet. */
function ensureDatabaseUrl() {
  if (process.env.DATABASE_URL) return;
  const absolute = path.join(process.cwd(), "prisma", "dev.db");
  process.env.DATABASE_URL = `file:${absolute}`;
}

ensureDatabaseUrl();

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
