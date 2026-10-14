"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { summarizeConversation } from "@/lib/ai/provider";

export async function sendMessage(channelSlug: string, body: string, parentId?: string) {
  const trimmed = body.trim();
  if (!trimmed) throw new Error("Message cannot be empty");

  const user = await prisma.user.findFirst({ where: { isCurrentUser: true } });
  const channel = await prisma.channel.findFirst({ where: { slug: channelSlug } });
  if (!user || !channel) throw new Error("Channel or user not found");

  await prisma.message.create({
    data: {
      channelId: channel.id,
      authorId: user.id,
      body: trimmed,
      parentId: parentId || null,
    },
  });

  revalidatePath(`/messages/${channelSlug}`);
  revalidatePath("/messages");
  return { ok: true as const };
}

export async function toggleReaction(messageId: string, emoji: string, channelSlug: string) {
  const user = await prisma.user.findFirst({ where: { isCurrentUser: true } });
  if (!user) throw new Error("No user");

  const existing = await prisma.reaction.findFirst({
    where: { messageId, userId: user.id, emoji },
  });
  if (existing) {
    await prisma.reaction.delete({ where: { id: existing.id } });
  } else {
    await prisma.reaction.create({
      data: { messageId, userId: user.id, emoji },
    });
  }
  revalidatePath(`/messages/${channelSlug}`);
  return { ok: true as const };
}

export async function aiSummarizeChannel(channelSlug: string) {
  const channel = await prisma.channel.findFirst({
    where: { slug: channelSlug },
    include: {
      messages: {
        include: { author: true },
        orderBy: { createdAt: "asc" },
        take: 50,
      },
    },
  });
  if (!channel) throw new Error("Channel not found");
  return summarizeConversation(
    channel.messages.map((m) => ({ author: m.author.name, body: m.body }))
  );
}
