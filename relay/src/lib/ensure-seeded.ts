import { prisma } from "@/lib/db";

/** Soft check — seed is applied via `npm run db:setup`. */
export async function ensureSeeded() {
  const count = await prisma.organization.count().catch(() => 0);
  return count > 0;
}
