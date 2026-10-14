"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";

async function requireCurrentUser() {
  const user = await prisma.user.findFirst({ where: { isCurrentUser: true } });
  if (!user) throw new Error("No current user");
  return user;
}

/** True when the user is already on an active/ringing direct call. */
export async function userIsInDirectCall(userId: string) {
  const open = await prisma.directCall.findFirst({
    where: {
      status: { in: ["ringing", "active"] },
      OR: [{ callerId: userId }, { calleeId: userId }],
    },
  });
  return Boolean(open);
}

export type ActiveDirectCallSummary = {
  id: string
  status: string
  privacyMode: boolean
  startedAt: string
  answeredAt: string | null
  peerName: string
  peerTitle: string
  peerColor: string
  peerId: string
};

/** Serializable summary for the global ongoing-call chrome. */
export async function getActiveDirectCallSummary(): Promise<ActiveDirectCallSummary | null> {
  const me = await prisma.user.findFirst({ where: { isCurrentUser: true } });
  if (!me) return null;
  const call = await prisma.directCall.findFirst({
    where: {
      status: { in: ["ringing", "active"] },
      OR: [{ callerId: me.id }, { calleeId: me.id }],
    },
    include: { caller: true, callee: true },
    orderBy: { startedAt: "desc" },
  });
  if (!call) return null;
  const peer = call.callerId === me.id ? call.callee : call.caller;
  return {
    id: call.id,
    status: call.status,
    privacyMode: call.privacyMode,
    startedAt: call.startedAt.toISOString(),
    answeredAt: call.answeredAt?.toISOString() ?? null,
    peerName: peer.name,
    peerTitle: peer.title,
    peerColor: peer.avatarColor,
    peerId: peer.id,
  };
}

/** Start a 1:1 direct call with another person. Fails if you are already in a call. */
export async function startDirectCall(calleeId: string) {
  const me = await requireCurrentUser();
  if (calleeId === me.id) throw new Error("Cannot call yourself");

  const busy = await userIsInDirectCall(me.id);
  if (busy) {
    throw new Error("You are already in a call — end it before starting another");
  }

  const callee = await prisma.user.findUnique({ where: { id: calleeId } });
  if (!callee || callee.organizationId !== me.organizationId) {
    throw new Error("Person not found");
  }

  const calleeBusy = await userIsInDirectCall(calleeId);
  if (calleeBusy) {
    throw new Error(`${callee.name} is already in a call`);
  }

  // Start ringing — client plays Relay ring, then answerDirectCall connects
  const call = await prisma.directCall.create({
    data: {
      organizationId: me.organizationId,
      callerId: me.id,
      calleeId,
      status: "ringing",
      privacyMode: false,
    },
  });

  await prisma.user.update({
    where: { id: me.id },
    data: { status: "busy" },
  });
  await prisma.user.update({
    where: { id: calleeId },
    data: { status: "busy" },
  });

  await prisma.auditEvent.create({
    data: {
      organizationId: me.organizationId,
      actor: me.email,
      action: "direct_call.started",
      targetType: "DirectCall",
      targetId: call.id,
      detail: `1:1 call ringing → ${callee.name}`,
    },
  });

  revalidatePath("/people");
  revalidatePath(`/calls/${call.id}`);
  revalidatePath("/activity");
  return { ok: true as const, id: call.id };
}

/** Demo answer — peer picks up after the Relay ring motif. */
export async function answerDirectCall(callId: string) {
  const me = await requireCurrentUser();
  const call = await prisma.directCall.findUnique({ where: { id: callId } });
  if (!call) throw new Error("Call not found");
  if (call.callerId !== me.id && call.calleeId !== me.id) {
    throw new Error("Not a participant");
  }
  if (call.status === "active") return { ok: true as const };
  if (call.status !== "ringing") throw new Error("Call is not ringing");

  await prisma.directCall.update({
    where: { id: callId },
    data: { status: "active", answeredAt: new Date() },
  });

  revalidatePath(`/calls/${callId}`);
  revalidatePath("/people");
  return { ok: true as const };
}

export async function endDirectCall(callId: string) {
  const me = await requireCurrentUser();
  const call = await prisma.directCall.findUnique({ where: { id: callId } });
  if (!call) throw new Error("Call not found");
  if (call.callerId !== me.id && call.calleeId !== me.id) {
    throw new Error("Not a participant");
  }
  if (call.status === "ended") return { ok: true as const };

  await prisma.directCall.update({
    where: { id: callId },
    data: { status: "ended", endedAt: new Date() },
  });

  await prisma.user.updateMany({
    where: { id: { in: [call.callerId, call.calleeId] }, status: "busy" },
    data: { status: "online" },
  });

  await prisma.auditEvent.create({
    data: {
      organizationId: call.organizationId,
      actor: me.email,
      action: "direct_call.ended",
      targetType: "DirectCall",
      targetId: call.id,
      detail: call.privacyMode ? "Ended private 1:1 call" : "Ended 1:1 call",
    },
  });

  revalidatePath("/");
  revalidatePath("/people");
  revalidatePath("/messages");
  revalidatePath(`/calls/${callId}`);
  revalidatePath("/activity");
  return { ok: true as const };
}

export async function setDirectCallPrivacyMode(callId: string, enabled: boolean) {
  const me = await requireCurrentUser();
  const call = await prisma.directCall.findUnique({ where: { id: callId } });
  if (!call) throw new Error("Call not found");
  if (call.callerId !== me.id && call.calleeId !== me.id) {
    throw new Error("Not a participant");
  }

  await prisma.directCall.update({
    where: { id: callId },
    data: { privacyMode: enabled },
  });

  revalidatePath(`/calls/${callId}`);
  revalidatePath("/people");
  return { ok: true as const, privacyMode: enabled };
}
