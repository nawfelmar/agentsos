import path from "node:path";
import { PrismaClient } from "@prisma/client";

/** Ensure Prisma always has an absolute SQLite URL (avoids cwd vs schema-relative drift). */
function ensureDatabaseUrl() {
  const absolute = path.join(process.cwd(), "prisma", "dev.db");
  const absoluteUrl = `file:${absolute}`;
  const current = process.env.DATABASE_URL;
  // Rewrite relative SQLite URLs so Next and scripts hit the same file.
  if (!current || current.startsWith("file:./") || current.startsWith("file:prisma/")) {
    process.env.DATABASE_URL = absoluteUrl;
  }
}

ensureDatabaseUrl();

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
