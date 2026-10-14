"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { summarizeConversation } from "@/lib/ai/provider";
import { MAX_SUMMARY_MESSAGES } from "@/lib/messages-constants";

function dmSlugFor(aId: string, bId: string) {
  const [x, y] = [aId, bId].sort();
  return `dm-${x}-${y}`.toLowerCase().replace(/[^a-z0-9-]+/g, "-").slice(0, 96);
}

/** Open an existing 1:1 DM or create one, then return its slug for navigation. */
export async function openOrCreateDm(otherUserId: string) {
  const me = await prisma.user.findFirst({ where: { isCurrentUser: true } });
  if (!me) throw new Error("No current user");
  if (otherUserId === me.id) throw new Error("Cannot DM yourself");

  const other = await prisma.user.findUnique({ where: { id: otherUserId } });
  if (!other || other.organizationId !== me.organizationId) {
    throw new Error("Person not found");
  }

  const existing = await prisma.channel.findFirst({
    where: {
      organizationId: me.organizationId,
      type: "dm",
      AND: [
        { members: { some: { userId: me.id } } },
        { members: { some: { userId: otherUserId } } },
      ],
    },
    include: { members: true },
  });

  if (existing) {
    const memberIds = new Set(existing.members.map((m) => m.userId));
    if (memberIds.has(me.id) && memberIds.has(otherUserId)) {
      revalidatePath(`/messages/${existing.slug}`);
      revalidatePath("/messages");
      return { ok: true as const, slug: existing.slug, created: false };
    }
  }

  const slug = dmSlugFor(me.id, other.id);
  const bySlug = await prisma.channel.findFirst({
    where: { organizationId: me.organizationId, slug },
  });
  if (bySlug) {
    return { ok: true as const, slug: bySlug.slug, created: false };
  }

  const channel = await prisma.channel.create({
    data: {
      organizationId: me.organizationId,
      name: `${me.name.split(" ")[0]} ↔ ${other.name.split(" ")[0]}`,
      slug,
      type: "dm",
      description: `Direct messages between ${me.name} and ${other.name}`,
      members: {
        create: [{ userId: me.id }, { userId: other.id }],
      },
    },
  });

  revalidatePath(`/messages/${channel.slug}`);
  revalidatePath("/messages");
  revalidatePath("/people");
  return { ok: true as const, slug: channel.slug, created: true };
}

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
        take: MAX_SUMMARY_MESSAGES,
      },
    },
  });
  if (!channel) throw new Error("Channel not found");
  return summarizeConversation(
    channel.messages.map((m) => ({ author: m.author.name, body: m.body }))
  );
}

/** Summarize an explicit selection of messages (max 30) in a channel. */
export async function aiSummarizeSelectedMessages(
  channelSlug: string,
  messageIds: string[]
) {
  const unique = Array.from(
    new Set(messageIds.map((id) => id.trim()).filter(Boolean))
  );
  if (unique.length === 0) throw new Error("Select at least one message");
  if (unique.length > MAX_SUMMARY_MESSAGES) {
    throw new Error(`Select at most ${MAX_SUMMARY_MESSAGES} messages`);
  }

  const channel = await prisma.channel.findFirst({ where: { slug: channelSlug } });
  if (!channel) throw new Error("Channel not found");

  const messages = await prisma.message.findMany({
    where: {
      channelId: channel.id,
      id: { in: unique },
    },
    include: { author: true },
    orderBy: { createdAt: "asc" },
  });

  if (messages.length === 0) throw new Error("No matching messages in this chat");

  return summarizeConversation(
    messages.map((m) => ({ author: m.author.name, body: m.body }))
  );
}
