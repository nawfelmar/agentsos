import { prisma } from "@/lib/db";
import { parseJson } from "@/lib/utils";

export async function getCurrentUser() {
  return prisma.user.findFirst({
    where: { isCurrentUser: true },
    include: { organization: true },
  });
}

export async function getCommandCenter() {
  const user = await getCurrentUser();
  if (!user) return null;

  const orgId = user.organizationId;

  const [blockers, pendingActions, commitments, meetings, runs, notifications, decisions] =
    await Promise.all([
      prisma.blocker.findMany({
        where: { organizationId: orgId, status: { not: "resolved" } },
        include: { owner: true, project: true },
        orderBy: { updatedAt: "desc" },
      }),
      prisma.proposedAction.findMany({
        where: { status: "pending", run: { organizationId: orgId } },
        include: { run: { include: { blocker: true } } },
        orderBy: { createdAt: "desc" },
      }),
      prisma.commitment.findMany({
        where: { organizationId: orgId },
        orderBy: { dueAt: "asc" },
      }),
      prisma.meeting.findMany({
        where: {
          organizationId: orgId,
          status: { in: ["scheduled", "proposed", "in_progress"] },
          startAt: { gte: new Date(Date.now() - 1000 * 60 * 30) },
        },
        include: { participants: { include: { user: true } } },
        orderBy: { startAt: "asc" },
        take: 5,
      }),
      prisma.coordinationRun.findMany({
        where: { organizationId: orgId },
        include: {
          events: { orderBy: { createdAt: "desc" }, take: 8 },
          blocker: true,
          proposedActions: true,
        },
        orderBy: { updatedAt: "desc" },
        take: 6,
      }),
      prisma.notification.findMany({
        where: { userId: user.id, read: false },
        orderBy: { createdAt: "desc" },
      }),
      prisma.decision.findMany({
        where: { organizationId: orgId, status: "proposed" },
      }),
    ]);

  const attention = [
    ...blockers.map((b) => ({
      id: `blocker-${b.id}`,
      kind: "blocker" as const,
      title: b.title,
      explanation: b.description,
      owner: b.owner?.name ?? "Unassigned",
      severity: b.severity,
      href: `/coordination/${runs.find((r) => r.blockerId === b.id)?.id ?? "run_auth_blocker"}`,
      meta: b.project?.key,
    })),
    ...pendingActions.map((a) => ({
      id: `action-${a.id}`,
      kind: "proposed_meeting" as const,
      title: a.title,
      explanation: a.description,
      owner: "Relay AI → you",
      severity: "high",
      href: `/coordination/${a.runId}`,
      meta: a.kind,
      proposedActionId: a.id,
    })),
    ...commitments
      .filter((c) => c.status === "overdue")
      .map((c) => ({
        id: `commit-${c.id}`,
        kind: "overdue" as const,
        title: c.title,
        explanation: c.description ?? "Overdue commitment",
        owner: c.ownerName ?? "Unassigned",
        severity: "high",
        href: "/memory",
        meta: "commitment",
      })),
    ...decisions.map((d) => ({
      id: `decision-${d.id}`,
      kind: "decision" as const,
      title: d.title,
      explanation: d.summary,
      owner: "Needs confirmation",
      severity: "medium",
      href: "/memory",
      meta: "decision",
    })),
  ];

  return {
    user,
    attention,
    blockers,
    pendingActions,
    commitments,
    meetings,
    runs,
    notifications,
    health: {
      unresolvedBlockers: blockers.length,
      pendingDecisions: decisions.length + pendingActions.length,
      overdueCommitments: commitments.filter((c) => c.status === "overdue").length,
    },
  };
}

export async function getChannels() {
  return prisma.channel.findMany({
    include: {
      messages: {
        orderBy: { createdAt: "desc" },
        take: 1,
        include: { author: true },
      },
      _count: { select: { messages: true } },
    },
    orderBy: { name: "asc" },
  });
}

export async function getChannelBySlug(slug: string) {
  return prisma.channel.findFirst({
    where: { slug },
    include: {
      messages: {
        where: { parentId: null },
        include: {
          author: true,
          reactions: true,
          replies: { include: { author: true }, orderBy: { createdAt: "asc" } },
        },
        orderBy: { createdAt: "asc" },
      },
      project: true,
      team: true,
    },
  });
}

export async function getMeetings() {
  return prisma.meeting.findMany({
    include: {
      participants: { include: { user: true } },
      project: true,
    },
    orderBy: { startAt: "asc" },
  });
}

/** Active live meeting, if any. */
export async function getLiveMeeting() {
  return prisma.meeting.findFirst({
    where: { status: "in_progress" },
    include: {
      participants: true,
    },
    orderBy: { startAt: "desc" },
  });
}

/** Open 1:1 direct call for the current user (ringing or active). */
export async function getActiveDirectCall(userId?: string) {
  const id =
    userId ??
    (await prisma.user.findFirst({ where: { isCurrentUser: true } }))?.id;
  if (!id) return null;
  return prisma.directCall.findFirst({
    where: {
      status: { in: ["ringing", "active"] },
      OR: [{ callerId: id }, { calleeId: id }],
    },
    include: {
      caller: true,
      callee: true,
    },
    orderBy: { startedAt: "desc" },
  });
}

export async function getDirectCall(id: string) {
  return prisma.directCall.findUnique({
    where: { id },
    include: {
      caller: true,
      callee: true,
    },
  });
}

export async function getMeeting(id: string) {
  return prisma.meeting.findUnique({
    where: { id },
    include: {
      participants: { include: { user: true } },
      project: true,
      decisions: true,
      actionItems: { include: { owner: true } },
    },
  });
}

export async function getCoordinationRuns() {
  return prisma.coordinationRun.findMany({
    include: {
      blocker: { include: { owner: true, project: true } },
      events: { orderBy: { createdAt: "asc" } },
      proposedActions: true,
      meeting: true,
    },
    orderBy: { updatedAt: "desc" },
  });
}

export async function getCoordinationRun(id: string) {
  const run = await prisma.coordinationRun.findUnique({
    where: { id },
    include: {
      blocker: { include: { owner: true, project: true } },
      events: { orderBy: { createdAt: "asc" } },
      proposedActions: { include: { approvals: { include: { user: true } } } },
      meeting: { include: { participants: { include: { user: true } } } },
    },
  });
  if (!run) return null;
  const updates = await prisma.stakeholderUpdate.findMany({
    where: { runId: run.id },
    orderBy: { createdAt: "desc" },
  });
  const evidence = run.blocker ? parseJson(run.blocker.evidenceJson, []) : [];
  return { ...run, updates, evidence };
}

export async function getMemory() {
  const org = await prisma.organization.findFirst();
  if (!org) return null;
  const [decisions, commitments, actionItems, blockers, questions] = await Promise.all([
    prisma.decision.findMany({
      where: { organizationId: org.id },
      include: { owner: true, project: true, meeting: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.commitment.findMany({
      where: { organizationId: org.id },
      include: { project: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.actionItem.findMany({
      where: { organizationId: org.id },
      include: { owner: true, project: true, meeting: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.blocker.findMany({
      where: { organizationId: org.id },
      include: { owner: true, project: true },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.coordinationEvent.findMany({
      where: { kind: "clarified", run: { organizationId: org.id } },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
  ]);
  return { decisions, commitments, actionItems, blockers, questions };
}

export async function getNotifications() {
  const user = await getCurrentUser();
  if (!user) return [];
  return prisma.notification.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
  });
}

export async function getPolicies() {
  const org = await prisma.organization.findFirst();
  if (!org) return [];
  return prisma.autonomyPolicy.findMany({ where: { organizationId: org.id } });
}

export async function getUsers() {
  return prisma.user.findMany({ orderBy: { name: "asc" } });
}

export async function getCoordinationPrompts() {
  const org = await prisma.organization.findFirst();
  if (!org) return [];
  return prisma.coordinationPrompt.findMany({
    where: { organizationId: org.id },
    orderBy: { updatedAt: "desc" },
  });
}

export async function searchMemory(query: string) {
  const q = query.trim();
  if (!q) return { decisions: [], commitments: [], messages: [] };
  const [decisions, commitments, messages] = await Promise.all([
    prisma.decision.findMany({
      where: {
        OR: [{ title: { contains: q } }, { summary: { contains: q } }],
      },
      take: 20,
    }),
    prisma.commitment.findMany({
      where: {
        OR: [{ title: { contains: q } }, { description: { contains: q } }],
      },
      take: 20,
    }),
    prisma.message.findMany({
      where: { body: { contains: q } },
      include: { author: true, channel: true },
      take: 20,
      orderBy: { createdAt: "desc" },
    }),
  ]);
  return { decisions, commitments, messages };
}
