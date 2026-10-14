import path from "node:path";
import { PrismaClient } from "@prisma/client";

if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = `file:${path.join(process.cwd(), "prisma", "dev.db")}`;
}

const prisma = new PrismaClient();

async function main() {
  await prisma.reaction.deleteMany();
  await prisma.message.deleteMany();
  await prisma.channelMember.deleteMany();
  await prisma.approval.deleteMany();
  await prisma.proposedAction.deleteMany();
  await prisma.coordinationEvent.deleteMany();
  await prisma.coordinationRun.deleteMany();
  await prisma.stakeholderUpdate.deleteMany();
  await prisma.coordinationPrompt.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.auditEvent.deleteMany();
  await prisma.autonomyPolicy.deleteMany();
  await prisma.actionItem.deleteMany();
  await prisma.commitment.deleteMany();
  await prisma.decision.deleteMany();
  await prisma.dependency.deleteMany();
  await prisma.blocker.deleteMany();
  await prisma.meetingParticipant.deleteMany();
  await prisma.meeting.deleteMany();
  await prisma.channel.deleteMany();
  await prisma.project.deleteMany();
  await prisma.teamMembership.deleteMany();
  await prisma.team.deleteMany();
  await prisma.user.deleteMany();
  await prisma.organization.deleteMany();

  const org = await prisma.organization.create({
    data: { name: "Northline Systems", slug: "northline" },
  });

  const users = await Promise.all(
    [
      {
        id: "user_alex",
        email: "alex.rivera@northline.io",
        name: "Alex Rivera",
        title: "Staff Engineer",
        role: "engineer",
        avatarColor: "#5B8DEF",
        isCurrentUser: true,
        status: "online",
      },
      {
        id: "user_maya",
        email: "maya.chen@northline.io",
        name: "Maya Chen",
        title: "Tech Lead · Platform",
        role: "tech_lead",
        avatarColor: "#E07A5F",
        status: "busy",
      },
      {
        id: "user_jordan",
        email: "jordan.lee@northline.io",
        name: "Jordan Lee",
        title: "Senior Engineer · Checkout",
        role: "engineer",
        avatarColor: "#81B29A",
        status: "online",
      },
      {
        id: "user_sam",
        email: "sam.okonkwo@northline.io",
        name: "Sam Okonkwo",
        title: "Product Manager",
        role: "product",
        avatarColor: "#F2CC8F",
        status: "away",
      },
      {
        id: "user_priya",
        email: "priya.nair@northline.io",
        name: "Priya Nair",
        title: "VP Engineering",
        role: "executive",
        avatarColor: "#9B8CDB",
        status: "online",
      },
      {
        id: "user_chris",
        email: "chris.park@northline.io",
        name: "Chris Park",
        title: "Engineer · Payments",
        role: "engineer",
        avatarColor: "#4ECDC4",
        status: "offline",
      },
      {
        id: "user_nina",
        email: "nina.volkov@northline.io",
        name: "Nina Volkov",
        title: "Tech Lead · Checkout",
        role: "tech_lead",
        avatarColor: "#FF6B6B",
        status: "online",
      },
    ].map((u) =>
      prisma.user.create({
        data: { ...u, organizationId: org.id },
      })
    )
  );

  const byId = Object.fromEntries(users.map((u) => [u.id, u]));

  const platform = await prisma.team.create({
    data: {
      organizationId: org.id,
      name: "Platform",
      slug: "platform",
      description: "Auth, identity, shared services",
    },
  });
  const checkout = await prisma.team.create({
    data: {
      organizationId: org.id,
      name: "Checkout",
      slug: "checkout",
      description: "Cart, payments, order confirmation",
    },
  });

  await prisma.teamMembership.createMany({
    data: [
      { teamId: platform.id, userId: byId.user_maya.id, role: "lead" },
      { teamId: platform.id, userId: byId.user_chris.id, role: "member" },
      { teamId: platform.id, userId: byId.user_alex.id, role: "member" },
      { teamId: checkout.id, userId: byId.user_nina.id, role: "lead" },
      { teamId: checkout.id, userId: byId.user_jordan.id, role: "member" },
      { teamId: checkout.id, userId: byId.user_sam.id, role: "member" },
    ],
  });

  const project = await prisma.project.create({
    data: {
      organizationId: org.id,
      teamId: checkout.id,
      name: "Checkout Redesign",
      key: "CHK",
      description: "Q2 checkout reliability and auth-sdk migration",
    },
  });

  const eng = await prisma.channel.create({
    data: {
      organizationId: org.id,
      name: "engineering",
      slug: "engineering",
      type: "public",
      description: "Org-wide engineering",
    },
  });
  const chkChannel = await prisma.channel.create({
    data: {
      organizationId: org.id,
      teamId: checkout.id,
      projectId: project.id,
      name: "checkout-redesign",
      slug: "checkout-redesign",
      type: "public",
      description: "Checkout redesign delivery",
    },
  });
  const platformChan = await prisma.channel.create({
    data: {
      organizationId: org.id,
      teamId: platform.id,
      name: "platform-auth",
      slug: "platform-auth",
      type: "private",
      description: "Auth SDK releases",
    },
  });
  const dm = await prisma.channel.create({
    data: {
      organizationId: org.id,
      name: "Alex ↔ Maya",
      slug: "dm-alex-maya",
      type: "dm",
    },
  });

  for (const ch of [eng, chkChannel, platformChan, dm]) {
    await prisma.channelMember.createMany({
      data: users.slice(0, ch.id === dm.id ? 2 : undefined).map((u) => ({
        channelId: ch.id,
        userId: u.id,
      })),
    });
  }

  const now = Date.now();
  const msgs = [
    {
      channelId: chkChannel.id,
      authorId: byId.user_jordan.id,
      body: "Integration tests for checkout are blocked — auth-sdk@2.4.0 isn't published to our private registry yet. CI has been red for 6 hours on `checkout-integration`.",
      createdAt: new Date(now - 1000 * 60 * 95),
    },
    {
      channelId: chkChannel.id,
      authorId: byId.user_nina.id,
      body: "Confirming — without the SDK we can't exercise the new session handoff path. This blocks release candidate cut for Thursday.",
      createdAt: new Date(now - 1000 * 60 * 88),
    },
    {
      channelId: chkChannel.id,
      authorId: byId.user_sam.id,
      body: "Product needs a firm call by EOD: slip Thursday RC or ship with a temporary auth mock?",
      createdAt: new Date(now - 1000 * 60 * 70),
    },
    {
      channelId: chkChannel.id,
      authorId: byId.user_maya.id,
      body: "Platform side: 2.4.0 is code-complete but artifact signing is stuck on the new HSM rotate. ETA tomorrow AM if nothing else slips.",
      createdAt: new Date(now - 1000 * 60 * 55),
    },
    {
      channelId: platformChan.id,
      authorId: byId.user_chris.id,
      body: "Signing pipeline still waiting on ops approval for the HSM key rotate ticket OPS-1842.",
      createdAt: new Date(now - 1000 * 60 * 50),
    },
    {
      channelId: dm.id,
      authorId: byId.user_alex.id,
      body: "Maya — Relay flagged the checkout blocker. Want me to approve the 25-min sync if async doesn't clear it?",
      createdAt: new Date(now - 1000 * 60 * 20),
    },
    {
      channelId: dm.id,
      authorId: byId.user_maya.id,
      body: "Yes — keep it to Jordan, Nina, and me. Sam can get the written update.",
      createdAt: new Date(now - 1000 * 60 * 18),
    },
    {
      channelId: eng.id,
      authorId: byId.user_priya.id,
      body: "Reminder: freeze window opens Friday 16:00 PT. No risky merges without a named owner.",
      createdAt: new Date(now - 1000 * 60 * 200),
    },
  ];

  for (const m of msgs) {
    await prisma.message.create({ data: m });
  }

  const blocker = await prisma.blocker.create({
    data: {
      id: "blocker_auth_sdk",
      organizationId: org.id,
      projectId: project.id,
      ownerId: byId.user_maya.id,
      title: "Checkout integration blocked on auth-sdk@2.4.0",
      description:
        "Checkout integration CI cannot run without the Platform Auth SDK 2.4.0 artifact. Blocking Thursday RC cut.",
      severity: "critical",
      status: "investigating",
      sourceType: "message",
      sourceId: chkChannel.id,
      evidenceJson: JSON.stringify([
        {
          type: "ci",
          label: "CI job checkout-integration failed",
          detail: "ModuleNotFoundError: @northline/auth-sdk@2.4.0 — 14 consecutive failures since 08:12 PT",
          href: "/messages/checkout-redesign",
        },
        {
          type: "message",
          label: "Jordan Lee in #checkout-redesign",
          detail: "Integration tests blocked — auth-sdk@2.4.0 isn't published yet.",
          href: "/messages/checkout-redesign",
        },
        {
          type: "commitment",
          label: "Prior commitment",
          detail: "Platform committed to auth-sdk@2.4.0 availability by Mon EOD for Checkout RC.",
          href: "/memory",
        },
        {
          type: "dependency",
          label: "OPS-1842 HSM rotate",
          detail: "Artifact signing blocked on ops approval for HSM key rotate.",
          href: "/coordination",
        },
      ]),
    },
  });

  await prisma.dependency.create({
    data: {
      projectId: project.id,
      blockerId: blocker.id,
      title: "auth-sdk@2.4.0 publish",
      description: "Requires HSM rotate + registry publish",
      ownerTeam: "Platform",
      status: "blocked",
    },
  });

  const run = await prisma.coordinationRun.create({
    data: {
      id: "run_auth_blocker",
      organizationId: org.id,
      blockerId: blocker.id,
      title: "Resolve auth-sdk blocker for Checkout RC",
      status: "active",
      severity: "critical",
      summary:
        "Detected integration blocker. Clarification sent to Jordan. Async path insufficient — proposing a short sync with Platform + Checkout leads.",
      nextAction: "Await approval to schedule 25-minute dependency resolution meeting",
    },
  });

  await prisma.coordinationEvent.createMany({
    data: [
      {
        runId: run.id,
        kind: "detected",
        title: "Detected integration blocker",
        detail:
          "CI signal + #checkout-redesign thread indicate missing auth-sdk@2.4.0 is blocking integration tests.",
        outcome: "Opened coordination run",
        actor: "ai",
        createdAt: new Date(now - 1000 * 60 * 90),
      },
      {
        runId: run.id,
        kind: "clarified",
        title: "Asked Jordan for clarification",
        detail:
          "Is the missing Platform Auth SDK still the only blocker, or has a temporary mock been approved?",
        outcome: "Jordan confirmed SDK publish is required; mock not approved for RC path",
        actor: "ai",
        createdAt: new Date(now - 1000 * 60 * 75),
      },
      {
        runId: run.id,
        kind: "proposed_meeting",
        title: "Proposed dependency-resolution meeting",
        detail:
          "Async insufficient — HSM rotate ownership + RC risk require a 25-min sync with Maya, Nina, Jordan.",
        outcome: "Pending human approval",
        actor: "ai",
        createdAt: new Date(now - 1000 * 60 * 40),
      },
    ],
  });

  const proposedStart = new Date(now + 1000 * 60 * 90);
  const proposedEnd = new Date(now + 1000 * 60 * 115);

  const proposedMeeting = await prisma.meeting.create({
    data: {
      id: "meeting_proposed_auth",
      organizationId: org.id,
      projectId: project.id,
      title: "Unblock auth-sdk for Checkout RC",
      purpose:
        "Decide whether to wait on HSM rotate / SDK publish or approve a scoped mock for Thursday RC.",
      status: "proposed",
      startAt: proposedStart,
      endAt: proposedEnd,
      isAiProposed: true,
      demoMode: true,
      preparationStatus: "ready",
      agendaJson: JSON.stringify([
        { item: "Confirm current blocker scope", owner: "Jordan" },
        { item: "HSM rotate / publish ETA", owner: "Maya" },
        { item: "RC risk: slip vs scoped mock", owner: "Nina" },
        { item: "Stakeholder update wording", owner: "Relay AI" },
      ]),
      // Preload shared-board statement highlights so positions are visible in-room.
      outcomesJson: JSON.stringify({
        positions: {
          topic:
            "Whether to wait on auth-sdk@2.4.0 or approve a scoped mock for Thursday RC",
          alignmentLabel: "Mostly conditional — agreement depends on a named condition",
          mode: "demo",
          generatedAt: new Date(now).toISOString(),
          highlights: [
            {
              id: "hl_jordan",
              speaker: "Jordan Lee",
              stance: "against",
              position:
                "Against shipping RC without the real SDK — integration tests stay blocked.",
              highlight:
                "Without auth-sdk@2.4.0 we can’t exercise the session handoff path. A mock isn’t good enough for RC.",
              topic: "auth-sdk RC path",
              atLabel: "04:12",
            },
            {
              id: "hl_maya",
              speaker: "Maya Chen",
              stance: "conditional",
              position:
                "Can commit to tomorrow AM publish if HSM rotate clears — not promising earlier.",
              highlight:
                "2.4.0 is code-complete. If OPS-1842 lands tonight, artifact should be in the registry by tomorrow morning.",
              topic: "auth-sdk RC path",
              atLabel: "07:40",
            },
            {
              id: "hl_nina",
              speaker: "Nina Volkov",
              stance: "questioning",
              position:
                "Needs a hard go/no-go criterion before Thursday cut — won’t accept fuzzy ETAs.",
              highlight:
                "I need a binary call: publish by 10:00 AM or we slip RC. Product can’t sit in limbo.",
              topic: "auth-sdk RC path",
              atLabel: "11:05",
            },
            {
              id: "hl_alex",
              speaker: "Alex Rivera",
              stance: "for",
              position:
                "Supports keeping the short sync + written stakeholder update rather than expanding the meeting.",
              highlight:
                "Let’s keep this to the dependency owners and send Sam a written update.",
              topic: "auth-sdk RC path",
              atLabel: "12:20",
            },
          ],
        },
      }),
    },
  });

  await prisma.meetingParticipant.createMany({
    data: [
      { meetingId: proposedMeeting.id, userId: byId.user_maya.id, role: "required", response: "pending" },
      { meetingId: proposedMeeting.id, userId: byId.user_nina.id, role: "required", response: "pending" },
      { meetingId: proposedMeeting.id, userId: byId.user_jordan.id, role: "required", response: "pending" },
      { meetingId: proposedMeeting.id, userId: byId.user_alex.id, role: "optional", response: "accepted" },
    ],
  });

  await prisma.proposedAction.create({
    data: {
      id: "action_approve_meeting",
      runId: run.id,
      kind: "schedule_meeting",
      title: "Schedule 25-min auth-sdk unblock sync",
      description:
        "Invite Maya Chen, Nina Volkov, and Jordan Lee. Agenda prepared from open questions and prior commitment.",
      payloadJson: JSON.stringify({ meetingId: proposedMeeting.id }),
      status: "pending",
    },
  });

  // Existing scheduled meetings
  const standupStart = new Date(now + 1000 * 60 * 30);
  const standup = await prisma.meeting.create({
    data: {
      organizationId: org.id,
      projectId: project.id,
      title: "Checkout daily sync",
      purpose: "Surface blockers and RC readiness",
      status: "scheduled",
      startAt: standupStart,
      endAt: new Date(standupStart.getTime() + 1000 * 60 * 15),
      agendaJson: JSON.stringify([
        { item: "RC checklist", owner: "Nina" },
        { item: "Auth SDK status", owner: "Jordan" },
      ]),
      demoMode: true,
    },
  });
  await prisma.meetingParticipant.createMany({
    data: [
      { meetingId: standup.id, userId: byId.user_nina.id, role: "organizer", response: "accepted" },
      { meetingId: standup.id, userId: byId.user_jordan.id, role: "required", response: "accepted" },
      { meetingId: standup.id, userId: byId.user_sam.id, role: "optional", response: "accepted" },
      { meetingId: standup.id, userId: byId.user_alex.id, role: "optional", response: "accepted" },
    ],
  });

  const past = await prisma.meeting.create({
    data: {
      organizationId: org.id,
      projectId: project.id,
      title: "Auth SDK kickoff",
      purpose: "Align Checkout + Platform on 2.4.0 contract",
      status: "completed",
      startAt: new Date(now - 1000 * 60 * 60 * 48),
      endAt: new Date(now - 1000 * 60 * 60 * 47),
      outcomesJson: JSON.stringify({
        summary: "Agreed on session handoff contract and Mon EOD publish target.",
      }),
      agendaJson: JSON.stringify([{ item: "Contract review", owner: "Maya" }]),
      demoMode: true,
    },
  });

  await prisma.decision.create({
    data: {
      organizationId: org.id,
      projectId: project.id,
      meetingId: past.id,
      ownerId: byId.user_maya.id,
      title: "auth-sdk@2.4.0 publish target: Mon EOD",
      summary:
        "Platform committed to publishing auth-sdk@2.4.0 by Monday EOD to unblock Checkout integration tests.",
      status: "confirmed",
      confirmedAt: new Date(now - 1000 * 60 * 60 * 47),
      evidenceJson: JSON.stringify([{ label: "Auth SDK kickoff outcome", href: `/meetings/${past.id}` }]),
    },
  });

  await prisma.commitment.createMany({
    data: [
      {
        organizationId: org.id,
        projectId: project.id,
        title: "Publish auth-sdk@2.4.0",
        description: "Artifact available in private registry",
        ownerName: "Maya Chen",
        dueAt: new Date(now - 1000 * 60 * 60 * 20),
        status: "overdue",
      },
      {
        organizationId: org.id,
        projectId: project.id,
        title: "Checkout RC cut",
        description: "Release candidate tagged for staging soak",
        ownerName: "Nina Volkov",
        dueAt: new Date(now + 1000 * 60 * 60 * 36),
        status: "open",
      },
    ],
  });

  await prisma.actionItem.create({
    data: {
      organizationId: org.id,
      projectId: project.id,
      meetingId: past.id,
      ownerId: byId.user_chris.id,
      title: "Complete HSM rotate ticket OPS-1842",
      description: "Unblocks artifact signing for SDK publish",
      dueAt: new Date(now - 1000 * 60 * 60 * 12),
      status: "in_progress",
    },
  });

  await prisma.notification.createMany({
    data: [
      {
        organizationId: org.id,
        userId: byId.user_alex.id,
        kind: "approval",
        title: "Meeting proposal needs approval",
        body: "Relay proposes a 25-min sync to unblock auth-sdk for Checkout RC.",
        href: "/coordination/run_auth_blocker",
        read: false,
      },
      {
        organizationId: org.id,
        userId: byId.user_alex.id,
        kind: "blocker",
        title: "Critical blocker detected",
        body: "Checkout integration blocked on auth-sdk@2.4.0",
        href: "/coordination/run_auth_blocker",
        read: false,
      },
      {
        organizationId: org.id,
        userId: byId.user_alex.id,
        kind: "message",
        title: "Maya replied in DM",
        body: "Yes — keep it to Jordan, Nina, and me.",
        href: "/messages/dm-alex-maya",
        read: true,
      },
    ],
  });

  await prisma.autonomyPolicy.createMany({
    data: [
      {
        organizationId: org.id,
        key: "auto_schedule_meetings",
        label: "Auto-schedule meetings",
        description: "When false, meeting proposals require human approval.",
        valueJson: JSON.stringify({ enabled: false, maxDurationMinutes: 30, minNoticeMinutes: 60 }),
      },
      {
        organizationId: org.id,
        key: "prefer_async",
        label: "Prefer asynchronous resolution",
        description: "Attempt DM/thread clarification before proposing meetings.",
        valueJson: JSON.stringify({ enabled: true }),
      },
      {
        organizationId: org.id,
        key: "stakeholder_updates",
        label: "Stakeholder update approval",
        description: "Require approval for management-facing updates.",
        valueJson: JSON.stringify({ requireApprovalFor: ["management"], autoSend: ["engineering"] }),
      },
      {
        organizationId: org.id,
        key: "working_hours",
        label: "Working hours",
        description: "Meetings only scheduled within these hours (participant local time).",
        valueJson: JSON.stringify({ start: "09:00", end: "17:00", timezone: "America/Los_Angeles" }),
      },
    ],
  });

  await prisma.auditEvent.create({
    data: {
      organizationId: org.id,
      actor: "relay-ai",
      action: "coordination.run.created",
      targetType: "CoordinationRun",
      targetId: run.id,
      detail: "Opened run for auth-sdk blocker",
    },
  });

  await prisma.stakeholderUpdate.create({
    data: {
      organizationId: org.id,
      runId: run.id,
      audience: "product",
      title: "Checkout RC risk — auth-sdk dependency",
      body: "Checkout integration tests remain blocked on auth-sdk@2.4.0. Platform ETA is tomorrow AM pending HSM rotate. Product decision on mock vs slip still open.",
      status: "draft",
      factsJson: JSON.stringify([
        { claim: "CI red for 6+ hours on checkout-integration", kind: "fact" },
        { claim: "SDK publish ETA tomorrow AM", kind: "estimate" },
        { claim: "Scoped mock not yet approved for RC path", kind: "fact" },
      ]),
    },
  });

  await prisma.coordinationPrompt.createMany({
    data: [
      {
        organizationId: org.id,
        title: "Approve pending meeting",
        prompt: "Approve the pending meeting for the auth-sdk blocker",
        actionKind: "approve_pending",
        runId: run.id,
        createdById: byId.user_alex.id,
      },
      {
        organizationId: org.id,
        title: "Escalate to VP Eng",
        prompt: "Escalate this to Priya and draft a management update",
        actionKind: "escalate",
        runId: run.id,
        createdById: byId.user_alex.id,
      },
      {
        organizationId: org.id,
        title: "Prefer async clarification",
        prompt: "Ask Jordan asynchronously whether a mock is acceptable for RC",
        actionKind: "async_question",
        runId: run.id,
        createdById: byId.user_alex.id,
      },
      {
        organizationId: org.id,
        title: "Pause until OPS clears",
        prompt: "Pause automation on this run until OPS-1842 lands",
        actionKind: "pause_run",
        runId: run.id,
        createdById: byId.user_alex.id,
      },
    ],
  });

  console.log("Seeded Northline Systems workspace for Relay demo.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
