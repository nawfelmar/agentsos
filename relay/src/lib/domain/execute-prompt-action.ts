import { prisma } from "@/lib/db";
import { clarifyBlocker } from "@/lib/ai/provider";
import { parseJson } from "@/lib/utils";
import { executeApproveProposedMeeting } from "@/lib/domain/approve-meeting";
import {
  ACTION_META,
  type CoordinationActionKind,
  type InterpretedAction,
} from "@/lib/domain/coordination-actions";

async function currentUser() {
  const user = await prisma.user.findFirst({ where: { isCurrentUser: true } });
  if (!user) throw new Error("No current user");
  return user;
}

async function resolveOwnerByName(name: string) {
  return prisma.user.findFirst({
    where: { name: { contains: name.split(" ")[0] ?? name } },
  });
}

export type ExecuteResult = {
  ok: true
  kind: CoordinationActionKind
  runId: string
  proposedActionId?: string
  message: string
  href?: string
};

/** Execute a structured coordination action against a run. */
export async function executeInterpretedAction(
  runId: string,
  action: InterpretedAction,
  opts?: { forceExecute?: boolean }
): Promise<ExecuteResult> {
  const user = await currentUser();
  const run = await prisma.coordinationRun.findUnique({
    where: { id: runId },
    include: {
      blocker: true,
      proposedActions: { where: { status: "pending" }, orderBy: { createdAt: "desc" } },
    },
  });
  if (!run) throw new Error("Coordination run not found");

  const meta = ACTION_META[action.kind];
  const payload = { ...action.payload, sourcePrompt: action.payload.prompt ?? null };

  // Consequential actions create a ProposedAction first unless forceExecute
  if (meta.requiresApproval && !opts?.forceExecute) {
    const proposed = await prisma.proposedAction.create({
      data: {
        runId,
        kind: action.kind,
        title: action.title,
        description: action.description,
        payloadJson: JSON.stringify(payload),
        status: "pending",
      },
    });
    await prisma.coordinationEvent.create({
      data: {
        runId,
        kind: "proposed_meeting",
        title: `Prompt proposed: ${action.title}`,
        detail: action.description,
        outcome: "Awaiting human confirmation",
        actor: "human",
      },
    });
    await prisma.coordinationRun.update({
      where: { id: runId },
      data: { nextAction: `Confirm prompt action: ${action.title}` },
    });
    return {
      ok: true,
      kind: action.kind,
      runId,
      proposedActionId: proposed.id,
      message: `Created pending action “${action.title}” — confirm to execute.`,
      href: `/coordination/${runId}`,
    };
  }

  switch (action.kind) {
    case "approve_pending": {
      const pending = run.proposedActions[0];
      if (!pending) throw new Error("No pending action to approve");
      await executeGenericProposedAction(pending.id, user.id);
      return {
        ok: true,
        kind: action.kind,
        runId,
        message: "Pending action approved and executed.",
        href: `/coordination/${runId}`,
      };
    }
    case "reject_pending": {
      const pending = run.proposedActions[0];
      if (!pending) throw new Error("No pending action to reject");
      await prisma.proposedAction.update({
        where: { id: pending.id },
        data: { status: "rejected", decidedAt: new Date() },
      });
      await prisma.approval.create({
        data: {
          proposedActionId: pending.id,
          userId: user.id,
          decision: "rejected",
          note: String(action.payload.note ?? action.payload.prompt ?? "Rejected via prompt"),
        },
      });
      await prisma.coordinationEvent.create({
        data: {
          runId,
          kind: "approved",
          title: "Pending action rejected via prompt",
          detail: action.description,
          outcome: "Rejected",
          actor: "human",
        },
      });
      return { ok: true, kind: action.kind, runId, message: "Pending action rejected." };
    }
    case "pause_run": {
      await prisma.coordinationRun.update({
        where: { id: runId },
        data: { status: "paused", nextAction: "Paused by prompt — awaiting resume" },
      });
      await prisma.coordinationEvent.create({
        data: {
          runId,
          kind: "clarified",
          title: "Automation paused via prompt",
          detail: String(action.payload.prompt ?? action.description),
          outcome: "Paused",
          actor: "human",
        },
      });
      return { ok: true, kind: action.kind, runId, message: "Run paused." };
    }
    case "resume_run": {
      await prisma.coordinationRun.update({
        where: { id: runId },
        data: { status: "active", nextAction: "Automation resumed via prompt" },
      });
      await prisma.coordinationEvent.create({
        data: {
          runId,
          kind: "clarified",
          title: "Automation resumed via prompt",
          detail: action.description,
          outcome: "Active",
          actor: "human",
        },
      });
      return { ok: true, kind: action.kind, runId, message: "Run resumed." };
    }
    case "clarify": {
      if (!run.blockerId || !run.blocker) throw new Error("Run has no blocker to clarify");
      const evidence = parseJson<{ detail?: string }[]>(run.blocker.evidenceJson, []);
      const result = await clarifyBlocker({
        title: run.blocker.title,
        description: run.blocker.description,
        evidence: evidence.map((e) => e.detail ?? ""),
      });
      await prisma.coordinationEvent.create({
        data: {
          runId,
          kind: "clarified",
          title: "Clarification from prompt",
          detail: result.question,
          outcome: result.rationale,
          actor: "ai",
        },
      });
      return { ok: true, kind: action.kind, runId, message: result.question };
    }
    case "async_question": {
      const question = String(action.payload.question ?? action.description);
      const to = String(action.payload.to ?? "team");
      await prisma.coordinationEvent.create({
        data: {
          runId,
          kind: "clarified",
          title: `Async question to ${to}`,
          detail: question,
          outcome: "Awaiting response",
          actor: "human",
        },
      });
      await prisma.coordinationRun.update({
        where: { id: runId },
        data: { nextAction: `Await async reply from ${to}` },
      });
      if (run.blockerId) {
        await prisma.blocker.update({
          where: { id: run.blockerId },
          data: { status: "waiting" },
        });
      }
      return { ok: true, kind: action.kind, runId, message: `Asked ${to}: ${question}` };
    }
    case "resolve_check": {
      const stillBlocked = run.blocker && run.blocker.status !== "resolved";
      const outcome = stillBlocked
        ? "Blocker still open — continue coordination"
        : "No open blocker — safe to close";
      await prisma.coordinationEvent.create({
        data: {
          runId,
          kind: "resolved_check",
          title: "Resolution check via prompt",
          detail: action.description,
          outcome,
          actor: "ai",
        },
      });
      await prisma.coordinationRun.update({
        where: { id: runId },
        data: { nextAction: outcome },
      });
      return { ok: true, kind: action.kind, runId, message: outcome };
    }
    case "schedule_meeting": {
      return executeScheduleFromPrompt(runId, action, user.organizationId, true);
    }
    case "send_update": {
      return executeSendUpdate(runId, action, user.organizationId, true);
    }
    case "escalate": {
      return executeEscalate(runId, action, user, true);
    }
    case "reassign": {
      return executeReassign(runId, action, true);
    }
    case "mark_resolved": {
      return executeMarkResolved(runId, action, true);
    }
    default:
      throw new Error(`Unhandled action kind: ${action.kind}`);
  }
}

/** Confirm and execute a pending ProposedAction created from a prompt (any kind). */
export async function executeGenericProposedAction(proposedActionId: string, userId?: string) {
  const user = userId
    ? await prisma.user.findUniqueOrThrow({ where: { id: userId } })
    : await currentUser();

  const proposed = await prisma.proposedAction.findUnique({ where: { id: proposedActionId } });
  if (!proposed) throw new Error("Proposed action not found");
  if (proposed.status !== "pending") throw new Error("Action already decided");

  // Seeded meeting approval path
  if (proposed.kind === "schedule_meeting") {
    const payload = parseJson<{ meetingId?: string }>(proposed.payloadJson, {});
    if (payload.meetingId) {
      return executeApproveProposedMeeting(proposedActionId);
    }
  }

  const payload = parseJson<Record<string, unknown>>(proposed.payloadJson, {});
  const interpreted: InterpretedAction = {
    kind: proposed.kind as CoordinationActionKind,
    title: proposed.title,
    description: proposed.description,
    rationale: "Confirmed pending prompt action",
    payload,
    confidence: 1,
  };

  await prisma.proposedAction.update({
    where: { id: proposed.id },
    data: { status: "approved", decidedAt: new Date() },
  });
  await prisma.approval.create({
    data: {
      proposedActionId: proposed.id,
      userId: user.id,
      decision: "approved",
      note: "Confirmed prompt action",
    },
  });

  // Force-execute the underlying kind
  return executeInterpretedAction(proposed.runId, interpreted, { forceExecute: true });
}

async function executeScheduleFromPrompt(
  runId: string,
  action: InterpretedAction,
  organizationId: string,
  force: boolean
): Promise<ExecuteResult> {
  if (!force) {
    return executeInterpretedAction(runId, action, { forceExecute: false });
  }
  const start = new Date(Date.now() + 90 * 60_000);
  const duration = Number(action.payload.durationMinutes ?? 25);
  const end = new Date(start.getTime() + duration * 60_000);
  const names = (action.payload.participants as string[] | undefined) ?? [
    "Maya Chen",
    "Nina Volkov",
    "Jordan Lee",
  ];
  const users = await prisma.user.findMany({
    where: { OR: names.map((n) => ({ name: { contains: n.split(" ")[0] } })) },
  });
  const meeting = await prisma.meeting.create({
    data: {
      organizationId,
      title: action.title,
      purpose: action.description,
      status: "scheduled",
      startAt: start,
      endAt: end,
      isAiProposed: true,
      demoMode: true,
      agendaJson: JSON.stringify([
        { item: "Confirm blocker scope", owner: "Jordan" },
        { item: "Agree next unblock step", owner: "Maya" },
      ]),
      participants: {
        create: users.map((u) => ({
          userId: u.id,
          role: "required",
          response: "accepted",
        })),
      },
    },
  });
  await prisma.coordinationRun.update({
    where: { id: runId },
    data: {
      meetingId: meeting.id,
      nextAction: "Run meeting and capture outcomes",
      summary: `Meeting scheduled via prompt: ${meeting.title}`,
    },
  });
  await prisma.coordinationEvent.create({
    data: {
      runId,
      kind: "proposed_meeting",
      title: "Meeting scheduled from prompt",
      detail: meeting.title,
      outcome: "Scheduled",
      actor: "human",
    },
  });
  return {
    ok: true,
    kind: "schedule_meeting",
    runId,
    message: `Meeting scheduled: ${meeting.title}`,
    href: `/meetings/${meeting.id}`,
  };
}

async function executeSendUpdate(
  runId: string,
  action: InterpretedAction,
  organizationId: string,
  force: boolean
): Promise<ExecuteResult> {
  if (!force) return executeInterpretedAction(runId, action);
  const audience = String(action.payload.audience ?? "engineering");
  const update = await prisma.stakeholderUpdate.create({
    data: {
      organizationId,
      runId,
      audience,
      title: action.title,
      body: `${action.description}\n\nSource prompt: ${String(action.payload.prompt ?? "")}`,
      status: "sent",
      sentAt: new Date(),
      factsJson: JSON.stringify([
        { claim: action.description, kind: "recommendation" },
        { claim: "Generated from human coordination prompt", kind: "fact" },
      ]),
    },
  });
  await prisma.coordinationEvent.create({
    data: {
      runId,
      kind: "update_sent",
      title: `Stakeholder update sent (${audience})`,
      detail: update.title,
      outcome: "Sent",
      actor: "human",
    },
  });
  return {
    ok: true,
    kind: "send_update",
    runId,
    message: `Update sent to ${audience}.`,
    href: `/coordination/${runId}`,
  };
}

async function executeEscalate(
  runId: string,
  action: InterpretedAction,
  user: { id: string; organizationId: string },
  force: boolean
): Promise<ExecuteResult> {
  if (!force) return executeInterpretedAction(runId, action);
  const recipient = String(action.payload.recipient ?? "Priya Nair");
  await prisma.coordinationEvent.create({
    data: {
      runId,
      kind: "approved",
      title: `Escalated to ${recipient}`,
      detail: action.description,
      outcome: "Escalation recorded",
      actor: "human",
    },
  });
  await prisma.stakeholderUpdate.create({
    data: {
      organizationId: user.organizationId,
      runId,
      audience: "management",
      title: `Escalation: ${action.title}`,
      body: action.description,
      status: "sent",
      sentAt: new Date(),
      factsJson: JSON.stringify([{ claim: "Human-initiated escalation via prompt", kind: "fact" }]),
    },
  });
  const priya = await resolveOwnerByName(recipient);
  if (priya) {
    await prisma.notification.create({
      data: {
        organizationId: user.organizationId,
        userId: user.id,
        kind: "escalation",
        title: `Escalated to ${recipient}`,
        body: action.description,
        href: `/coordination/${runId}`,
        read: false,
      },
    });
  }
  await prisma.coordinationRun.update({
    where: { id: runId },
    data: {
      severity: "critical",
      nextAction: `Await response from ${recipient}`,
    },
  });
  return { ok: true, kind: "escalate", runId, message: `Escalated to ${recipient}.` };
}

async function executeReassign(
  runId: string,
  action: InterpretedAction,
  force: boolean
): Promise<ExecuteResult> {
  if (!force) return executeInterpretedAction(runId, action);
  const ownerName = String(action.payload.ownerName ?? "Chris Park");
  const owner = await resolveOwnerByName(ownerName);
  const run = await prisma.coordinationRun.findUnique({ where: { id: runId } });
  if (run?.blockerId && owner) {
    await prisma.blocker.update({
      where: { id: run.blockerId },
      data: { ownerId: owner.id },
    });
  }
  await prisma.coordinationEvent.create({
    data: {
      runId,
      kind: "decision",
      title: `Ownership reassigned to ${ownerName}`,
      detail: action.description,
      outcome: "Reassigned",
      actor: "human",
    },
  });
  await prisma.coordinationRun.update({
    where: { id: runId },
    data: { nextAction: `${ownerName} owns next unblock step` },
  });
  return { ok: true, kind: "reassign", runId, message: `Reassigned to ${ownerName}.` };
}

async function executeMarkResolved(
  runId: string,
  action: InterpretedAction,
  force: boolean
): Promise<ExecuteResult> {
  if (!force) return executeInterpretedAction(runId, action);
  const run = await prisma.coordinationRun.findUnique({ where: { id: runId } });
  if (run?.blockerId) {
    await prisma.blocker.update({
      where: { id: run.blockerId },
      data: { status: "resolved", resolvedAt: new Date() },
    });
  }
  await prisma.coordinationRun.update({
    where: { id: runId },
    data: {
      status: "completed",
      nextAction: "Resolved via prompt — no further action",
      summary: action.description,
    },
  });
  await prisma.coordinationEvent.create({
    data: {
      runId,
      kind: "resolved_check",
      title: "Marked resolved via prompt",
      detail: action.description,
      outcome: "Completed",
      actor: "human",
    },
  });
  return { ok: true, kind: "mark_resolved", runId, message: "Blocker marked resolved; run completed." };
}
