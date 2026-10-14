import { prisma } from "@/lib/db";
import { parseJson } from "@/lib/utils";

export async function executeApproveProposedMeeting(proposedActionId: string) {
  const user = await prisma.user.findFirst({ where: { isCurrentUser: true } });
  if (!user) throw new Error("No current user");

  const action = await prisma.proposedAction.findUnique({
    where: { id: proposedActionId },
    include: { run: true },
  });
  if (!action) throw new Error("Proposed action not found");
  if (action.status !== "pending") throw new Error("Action already decided");

  const payload = parseJson<{ meetingId?: string }>(action.payloadJson, {});
  if (!payload.meetingId) throw new Error("Missing meeting payload");

  const meeting = await prisma.meeting.findUnique({ where: { id: payload.meetingId } });
  if (!meeting) throw new Error("Meeting not found");

  await prisma.$transaction(async (tx) => {
    await tx.proposedAction.update({
      where: { id: action.id },
      data: { status: "approved", decidedAt: new Date() },
    });

    await tx.approval.create({
      data: {
        proposedActionId: action.id,
        userId: user.id,
        decision: "approved",
        note: "Approved from Command Center / Coordination",
      },
    });

    await tx.meeting.update({
      where: { id: meeting.id },
      data: { status: "scheduled" },
    });

    await tx.meetingParticipant.updateMany({
      where: { meetingId: meeting.id, response: "pending" },
      data: { response: "accepted" },
    });

    await tx.coordinationRun.update({
      where: { id: action.runId },
      data: {
        meetingId: meeting.id,
        nextAction: "Run meeting and capture decision + stakeholder update",
        summary:
          "Meeting approved and scheduled. Agenda prepared from blocker evidence and open questions.",
      },
    });

    await tx.coordinationEvent.create({
      data: {
        runId: action.runId,
        kind: "approved",
        title: "Human approved meeting proposal",
        detail: `${user.name} approved scheduling “${meeting.title}”.`,
        outcome: "Meeting moved to scheduled",
        actor: "human",
      },
    });

    const decision = await tx.decision.create({
      data: {
        organizationId: user.organizationId,
        projectId: meeting.projectId,
        meetingId: meeting.id,
        ownerId: user.id,
        title: "Proceed with short sync to unblock auth-sdk path",
        summary:
          "Approved AI-proposed 25-min meeting with Platform + Checkout leads. RC path decision deferred to meeting outcome.",
        status: "confirmed",
        confirmedAt: new Date(),
        evidenceJson: JSON.stringify([
          { label: "Approved proposed action", href: `/coordination/${action.runId}` },
          { label: "Scheduled meeting", href: `/meetings/${meeting.id}` },
        ]),
      },
    });

    const maya = await tx.user.findFirst({ where: { email: "maya.chen@northline.io" } });
    await tx.actionItem.create({
      data: {
        organizationId: user.organizationId,
        projectId: meeting.projectId,
        meetingId: meeting.id,
        ownerId: maya?.id,
        title: "Confirm HSM rotate ETA and SDK publish window",
        description: "Bring definitive ETA to the unblock sync; unblock Checkout RC planning.",
        dueAt: meeting.startAt,
        status: "open",
      },
    });

    await tx.stakeholderUpdate.updateMany({
      where: { runId: action.runId, status: "draft" },
      data: {
        status: "sent",
        sentAt: new Date(),
        body: `Update: Alex approved a 25-min sync (${meeting.startAt.toISOString()}) with Maya, Nina, and Jordan to resolve the auth-sdk blocker for Checkout RC. Decision on mock vs slip will follow the meeting. Prior commitment for Mon EOD publish remains overdue.`,
      },
    });

    await tx.coordinationEvent.create({
      data: {
        runId: action.runId,
        kind: "decision",
        title: "Recorded decision and action item",
        detail: decision.title,
        outcome: "Decision confirmed; action assigned to Maya",
        actor: "ai",
      },
    });

    await tx.coordinationEvent.create({
      data: {
        runId: action.runId,
        kind: "update_sent",
        title: "Distributed stakeholder update",
        detail: "Product + engineering audiences notified with facts vs estimates labeled.",
        outcome: "Update marked sent",
        actor: "ai",
      },
    });

    if (action.run.blockerId) {
      await tx.blocker.update({
        where: { id: action.run.blockerId },
        data: { status: "resolving" },
      });
    }

    await tx.notification.create({
      data: {
        organizationId: user.organizationId,
        userId: user.id,
        kind: "success",
        title: "Meeting scheduled",
        body: `“${meeting.title}” is on the calendar. Decision and stakeholder update recorded.`,
        href: `/meetings/${meeting.id}`,
        read: false,
      },
    });

    await tx.auditEvent.create({
      data: {
        organizationId: user.organizationId,
        actor: user.email,
        action: "proposed_action.approved",
        targetType: "ProposedAction",
        targetId: action.id,
        detail: `Scheduled meeting ${meeting.id}; decision ${decision.id}`,
      },
    });
  });

  return { ok: true as const, meetingId: meeting.id, runId: action.runId };
}
