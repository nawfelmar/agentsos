"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";

export async function markAllNotificationsRead() {
  const user = await prisma.user.findFirst({ where: { isCurrentUser: true } });
  if (!user) return { ok: false as const };
  await prisma.notification.updateMany({
    where: { userId: user.id, read: false },
    data: { read: true },
  });
  revalidatePath("/activity");
  revalidatePath("/");
  return { ok: true as const };
}
