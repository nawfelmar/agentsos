"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { clarifyBlocker } from "@/lib/ai/provider";
import { parseJson } from "@/lib/utils";
import { executeApproveProposedMeeting } from "@/lib/domain/approve-meeting";

function revalidateCoordination(runId?: string) {
  revalidatePath("/");
  revalidatePath("/coordination");
  if (runId) revalidatePath(`/coordination/${runId}`);
  revalidatePath("/meetings");
  revalidatePath("/calendar");
  revalidatePath("/memory");
  revalidatePath("/activity");
}

export async function approveProposedMeeting(proposedActionId: string) {
  const result = await executeApproveProposedMeeting(proposedActionId);
  revalidateCoordination(result.runId);
  return result;
}

export async function rejectProposedMeeting(proposedActionId: string, note?: string) {
  const user = await prisma.user.findFirst({ where: { isCurrentUser: true } });
  if (!user) throw new Error("No current user");

  const action = await prisma.proposedAction.findUnique({ where: { id: proposedActionId } });
  if (!action || action.status !== "pending") throw new Error("Invalid action");

  await prisma.$transaction(async (tx) => {
    await tx.proposedAction.update({
      where: { id: action.id },
      data: { status: "rejected", decidedAt: new Date() },
    });
    await tx.approval.create({
      data: {
        proposedActionId: action.id,
        userId: user.id,
        decision: "rejected",
        note: note ?? "Rejected by user",
      },
    });
    const payload = parseJson<{ meetingId?: string }>(action.payloadJson, {});
    if (payload.meetingId) {
      await tx.meeting.update({
        where: { id: payload.meetingId },
        data: { status: "cancelled" },
      });
    }
    await tx.coordinationRun.update({
      where: { id: action.runId },
      data: {
        nextAction: "Continue async follow-up; meeting proposal rejected",
        summary: "Human rejected meeting proposal. Prefer async resolution.",
      },
    });
    await tx.coordinationEvent.create({
      data: {
        runId: action.runId,
        kind: "approved",
        title: "Human rejected meeting proposal",
        detail: note ?? "Prefer async path",
        outcome: "Meeting cancelled",
        actor: "human",
      },
    });
  });

  revalidateCoordination(action.runId);
  return { ok: true as const };
}

export async function pauseCoordinationRun(runId: string) {
  await prisma.coordinationRun.update({
    where: { id: runId },
    data: { status: "paused", nextAction: "Paused by human — awaiting resume" },
  });
  await prisma.coordinationEvent.create({
    data: {
      runId,
      kind: "clarified",
      title: "Automation paused",
      detail: "Human paused autonomous coordination for this issue.",
      outcome: "Paused",
      actor: "human",
    },
  });
  revalidatePath(`/coordination/${runId}`);
  revalidatePath("/coordination");
  return { ok: true as const };
}

export async function resumeCoordinationRun(runId: string) {
  await prisma.coordinationRun.update({
    where: { id: runId },
    data: { status: "active" },
  });
  revalidatePath(`/coordination/${runId}`);
  revalidatePath("/coordination");
  return { ok: true as const };
}

export async function runClarification(blockerId: string) {
  const blocker = await prisma.blocker.findUnique({ where: { id: blockerId } });
  if (!blocker) throw new Error("Blocker not found");
  const evidence = parseJson<{ detail?: string }[]>(blocker.evidenceJson, []);
  const result = await clarifyBlocker({
    title: blocker.title,
    description: blocker.description,
    evidence: evidence.map((e) => e.detail ?? ""),
  });

  const run = await prisma.coordinationRun.findFirst({
    where: { blockerId },
    orderBy: { createdAt: "desc" },
  });
  if (run) {
    await prisma.coordinationEvent.create({
      data: {
        runId: run.id,
        kind: "clarified",
        title: "AI clarification generated",
        detail: result.question,
        outcome: result.rationale,
        actor: "ai",
      },
    });
  }

  revalidatePath(`/coordination/${run?.id ?? ""}`);
  return result;
}
