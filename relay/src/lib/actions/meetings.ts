"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { DEMO } from "@/lib/demo";
import { parseJson } from "@/lib/utils";
import {
  buildDemoMeetingSummary,
  MeetingSummarySchema,
  type MeetingSummary,
} from "@/lib/domain/meeting-summary";
import {
  buildDemoMeetingPositions,
  MeetingPositionsSchema,
  type MeetingPositions,
} from "@/lib/domain/meeting-positions";
import { shouldSyncMeetingOutside } from "@/lib/domain/meeting-privacy";

export async function createMeeting(input: {
  title: string
  purpose: string
  startAt: string
  durationMinutes: number
  participantIds: string[]
}) {
  const user = await prisma.user.findFirst({ where: { isCurrentUser: true } });
  if (!user) throw new Error("No user");

  const start = new Date(input.startAt);
  const end = new Date(start.getTime() + input.durationMinutes * 60_000);

  const meeting = await prisma.meeting.create({
    data: {
      organizationId: user.organizationId,
      title: input.title,
      purpose: input.purpose,
      status: "scheduled",
      startAt: start,
      endAt: end,
      demoMode: true,
      agendaJson: JSON.stringify([{ item: "Agenda TBD", owner: user.name }]),
      participants: {
        create: [
          { userId: user.id, role: "organizer", response: "accepted" },
          ...input.participantIds
            .filter((id) => id !== user.id)
            .map((userId) => ({ userId, role: "required", response: "accepted" })),
        ],
      },
    },
  });

  revalidatePath("/meetings");
  revalidatePath("/calendar");
  return { ok: true as const, id: meeting.id };
}

/** One-click dummy meeting with a bunch of dummy employees + statement highlights. */
export async function createDummyMeeting(templateIndex?: number) {
  const { DUMMY_MEETING_TEMPLATES } = await import("@/lib/domain/dummy-org");
  const user = await prisma.user.findFirst({ where: { isCurrentUser: true } });
  if (!user) throw new Error("No user");

  const employees = await prisma.user.findMany({
    where: { organizationId: user.organizationId },
    orderBy: { name: "asc" },
  });
  if (employees.length < 3) throw new Error("Need more employees — run npm run db:seed");

  const idx =
    typeof templateIndex === "number"
      ? templateIndex % DUMMY_MEETING_TEMPLATES.length
      : Math.floor(Math.random() * DUMMY_MEETING_TEMPLATES.length);
  const template = DUMMY_MEETING_TEMPLATES[idx]!;

  // Invite 5–8 people including current user
  const others = employees.filter((e) => e.id !== user.id);
  const shuffled = [...others].sort(() => Math.random() - 0.5);
  const inviteCount = Math.min(7, Math.max(5, shuffled.length));
  const invitees = shuffled.slice(0, inviteCount);

  const start = new Date(Date.now() + 45 * 60_000);
  const end = new Date(start.getTime() + 30 * 60_000);

  const participants = [user, ...invitees];
  const positions = buildDemoMeetingPositions({
    title: template.title,
    purpose: template.purpose,
    participants: participants.map((p) => ({
      name: p.name,
      title: p.title,
      color: p.avatarColor,
    })),
    isAiProposed: false,
  });

  // Enrich positions so every invitee has a stance on the shared board
  const stances = ["for", "against", "conditional", "questioning", "neutral"] as const;
  const highlights = participants.map((p, i) => {
    const existing = positions.highlights.find((h) => h.speaker === p.name);
    if (existing) return existing;
    const stance = stances[i % stances.length]!;
    const lines: Record<(typeof stances)[number], { position: string; highlight: string }> = {
      for: {
        position: `Supports moving ahead on “${template.title}” with clear owners.`,
        highlight: `I'm good to proceed if we name owners in this room.`,
      },
      against: {
        position: `Wants to slow down — sees unresolved risk in the current plan.`,
        highlight: `We're not ready. Shipping this without the open risks closed is a mistake.`,
      },
      conditional: {
        position: `OK to proceed only if a named condition is met this week.`,
        highlight: `I'll support the plan if we lock the dependency ETA before Friday.`,
      },
      questioning: {
        position: `Still needs clarity before taking a side.`,
        highlight: `What does success look like by EOD Thursday? I need that spelled out.`,
      },
      neutral: {
        position: `Facilitating — not staking a product/engineering position yet.`,
        highlight: `I'll track decisions and make sure every open question has an owner.`,
      },
    };
    return {
      id: `hl_dummy_${p.id}`,
      speaker: p.name,
      stance,
      position: lines[stance].position,
      highlight: lines[stance].highlight,
      topic: template.purpose,
      atLabel: `0${(i % 9) + 1}:${10 + i}`,
    };
  });

  const meeting = await prisma.meeting.create({
    data: {
      organizationId: user.organizationId,
      title: template.title,
      purpose: template.purpose,
      status: "scheduled",
      startAt: start,
      endAt: end,
      demoMode: true,
      isAiProposed: false,
      preparationStatus: "ready",
      agendaJson: JSON.stringify(template.agenda),
      outcomesJson: JSON.stringify({
        positions: {
          ...positions,
          topic: template.purpose,
          highlights,
          alignmentLabel: "Dummy meeting — positions seeded for the shared board",
          mode: "demo",
          generatedAt: new Date().toISOString(),
        },
      }),
      participants: {
        create: [
          { userId: user.id, role: "organizer", response: "accepted" },
          ...invitees.map((e) => ({
            userId: e.id,
            role: "required" as const,
            response: "accepted",
          })),
        ],
      },
    },
  });

  await prisma.notification.create({
    data: {
      organizationId: user.organizationId,
      userId: user.id,
      kind: "meeting",
      title: "Dummy meeting created",
      body: `“${meeting.title}” with ${invitees.length + 1} employees is on the board.`,
      href: `/meetings/${meeting.id}`,
      read: false,
    },
  });

  revalidatePath("/meetings");
  revalidatePath(`/meetings/${meeting.id}`);
  revalidatePath("/calendar");
  revalidatePath("/activity");
  revalidatePath("/people");
  return { ok: true as const, id: meeting.id };
}

export async function cancelMeeting(meetingId: string) {
  await prisma.meeting.update({
    where: { id: meetingId },
    data: { status: "cancelled" },
  });
  revalidatePath("/meetings");
  revalidatePath(`/meetings/${meetingId}`);
  revalidatePath("/calendar");
  return { ok: true as const };
}

async function loadSummaryContext(meetingId: string) {
  const meeting = await prisma.meeting.findUnique({
    where: { id: meetingId },
    include: {
      participants: { include: { user: true } },
      decisions: true,
      actionItems: { include: { owner: true } },
      project: true,
    },
  });
  if (!meeting) throw new Error("Meeting not found");

  const run = await prisma.coordinationRun.findFirst({
    where: { meetingId },
    include: { blocker: true },
  });
  // Also match AI-proposed seed meeting via run link without meetingId yet
  const fallbackRun =
    run ??
    (meeting.isAiProposed
      ? await prisma.coordinationRun.findFirst({
          where: { id: "run_auth_blocker" },
          include: { blocker: true },
        })
      : null);

  return {
    meeting,
    context: {
      title: meeting.title,
      purpose: meeting.purpose,
      agenda: parseJson<{ item: string; owner: string }[]>(meeting.agendaJson, []),
      participants: meeting.participants.map((p) => p.user.name),
      existingDecisions: meeting.decisions.map((d) => ({
        title: d.title,
        summary: d.summary,
        status: d.status,
      })),
      existingActions: meeting.actionItems.map((a) => ({
        title: a.title,
        owner: a.owner?.name,
        status: a.status,
      })),
      relatedBlocker: fallbackRun?.blocker
        ? { title: fallbackRun.blocker.title, status: fallbackRun.blocker.status }
        : null,
      isAiProposed: meeting.isAiProposed,
    },
  };
}

async function maybeLiveSummary(
  ctx: Awaited<ReturnType<typeof loadSummaryContext>>["context"]
): Promise<MeetingSummary | null> {
  if (!DEMO.hasLlm || !process.env.OPENAI_API_KEY) return null;
  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.2,
        messages: [
          {
            role: "system",
            content:
              "Produce a clear structured meeting summary as JSON matching keys: headline, tldr, decisions[{text,status}], actionItems[{text,owner,due}], openQuestions[], risks[], audienceNotes{engineering,product,management}. Be concise. Separate confirmed decisions from proposals. Do not invent facts not supported by context.",
          },
          { role: "user", content: JSON.stringify(ctx) },
        ],
        response_format: { type: "json_object" },
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const parsed = MeetingSummarySchema.parse({
      ...JSON.parse(data.choices[0].message.content),
      generatedAt: new Date().toISOString(),
      mode: "live",
    });
    return parsed;
  } catch {
    return null;
  }
}

function buildPositionsForMeeting(
  meeting: Awaited<ReturnType<typeof loadSummaryContext>>["meeting"]
): MeetingPositions {
  return buildDemoMeetingPositions({
    title: meeting.title,
    purpose: meeting.purpose,
    participants: meeting.participants.map((p) => ({
      name: p.user.name,
      title: p.user.title,
      color: p.user.avatarColor,
    })),
    isAiProposed: meeting.isAiProposed,
  });
}

/** Capture per-person statement highlights so positions are obvious. */
export async function generateMeetingPositions(meetingId: string) {
  const { meeting } = await loadSummaryContext(meetingId);
  let positions = buildPositionsForMeeting(meeting);

  if (DEMO.hasLlm && process.env.OPENAI_API_KEY) {
    try {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          temperature: 0.2,
          messages: [
            {
              role: "system",
              content:
                "Extract each participant's clear position on the meeting topic. Return JSON: {topic, alignmentLabel, highlights:[{id,speaker,position,highlight,stance,topic,atLabel}]}. stance must be for|against|conditional|neutral|questioning. position = plain language; highlight = short quote. Do not invent speakers not in the participant list when possible.",
            },
            {
              role: "user",
              content: JSON.stringify({
                title: meeting.title,
                purpose: meeting.purpose,
                participants: meeting.participants.map((p) => p.user.name),
              }),
            },
          ],
          response_format: { type: "json_object" },
        }),
      });
      if (res.ok) {
        const data = await res.json();
        positions = MeetingPositionsSchema.parse({
          ...JSON.parse(data.choices[0].message.content),
          generatedAt: new Date().toISOString(),
          mode: "live",
        });
      }
    } catch {
      // keep demo positions
    }
  }

  const previous = parseJson<Record<string, unknown>>(meeting.outcomesJson, {});
  await prisma.meeting.update({
    where: { id: meetingId },
    data: {
      outcomesJson: JSON.stringify({
        ...previous,
        positions,
      }),
    },
  });

  revalidatePath(`/meetings/${meetingId}`);
  return { ok: true as const, positions };
}

/** Toggle privacy mode: outcomes stay in-meeting only (no org memory / broader project sync). */
export async function setMeetingPrivacyMode(meetingId: string, enabled: boolean) {
  const meeting = await prisma.meeting.findUnique({ where: { id: meetingId } });
  if (!meeting) throw new Error("Meeting not found");

  await prisma.meeting.update({
    where: { id: meetingId },
    data: { privacyMode: enabled },
  });

  await prisma.auditEvent.create({
    data: {
      organizationId: meeting.organizationId,
      actor: "human",
      action: enabled ? "meeting.privacy.enabled" : "meeting.privacy.disabled",
      targetType: "Meeting",
      targetId: meeting.id,
      detail: enabled
        ? "Privacy mode on — nothing leaves this meeting toward org memory or project sync"
        : "Privacy mode off — summaries may sync to Memory and the broader project",
    },
  });

  revalidatePath(`/meetings/${meetingId}`);
  revalidatePath("/meetings");
  revalidatePath("/activity");
  return { ok: true as const, privacyMode: enabled };
}

/** Generate a structured summary without necessarily closing the meeting. */
export async function generateMeetingSummary(meetingId: string) {
  const { meeting, context } = await loadSummaryContext(meetingId);
  const summary = (await maybeLiveSummary(context)) ?? buildDemoMeetingSummary(context);
  const positions = buildPositionsForMeeting(meeting);
  const privateMeeting = meeting.privacyMode;
  const syncOutside = shouldSyncMeetingOutside(privateMeeting);

  const previous = parseJson<Record<string, unknown>>(meeting.outcomesJson, {});
  await prisma.meeting.update({
    where: { id: meetingId },
    data: {
      outcomesJson: JSON.stringify({
        ...previous,
        summary: summary.tldr,
        structured: summary,
        positions: (previous.positions as MeetingPositions | undefined) ?? positions,
        privacyMode: privateMeeting,
      }),
      preparationStatus: "complete",
    },
  });

  // Mirror confirmed decisions / actions into org memory — skipped in privacy mode
  if (syncOutside) {
    const user = await prisma.user.findFirst({ where: { isCurrentUser: true } });
    if (user) {
      for (const d of summary.decisions) {
        const exists = meeting.decisions.some((x) => x.title === d.text);
        if (!exists) {
          await prisma.decision.create({
            data: {
              organizationId: user.organizationId,
              projectId: meeting.projectId,
              meetingId: meeting.id,
              ownerId: user.id,
              title: d.text,
              summary: summary.tldr,
              status: d.status === "confirmed" ? "confirmed" : "proposed",
              confirmedAt: d.status === "confirmed" ? new Date() : null,
              evidenceJson: JSON.stringify([
                { label: "Meeting summary", href: `/meetings/${meeting.id}` },
              ]),
            },
          });
        }
      }
      for (const a of summary.actionItems) {
        const exists = meeting.actionItems.some((x) => x.title === a.text);
        if (!exists) {
          const owner = await prisma.user.findFirst({
            where: { name: { contains: a.owner.split(" ")[0] ?? a.owner } },
          });
          await prisma.actionItem.create({
            data: {
              organizationId: user.organizationId,
              projectId: meeting.projectId,
              meetingId: meeting.id,
              ownerId: owner?.id,
              title: a.text,
              description: a.due ? `Due: ${a.due}` : null,
              status: "open",
            },
          });
        }
      }
    }
  }

  await prisma.auditEvent.create({
    data: {
      organizationId: meeting.organizationId,
      actor: "relay-ai",
      action: privateMeeting ? "meeting.summary.generated.private" : "meeting.summary.generated",
      targetType: "Meeting",
      targetId: meeting.id,
      detail: privateMeeting
        ? "Private summary kept in-meeting only (not synced to Memory or project)"
        : summary.headline,
    },
  });

  revalidatePath(`/meetings/${meetingId}`);
  revalidatePath("/meetings");
  if (syncOutside) revalidatePath("/memory");
  return { ok: true as const, summary, privacyMode: privateMeeting };
}

export async function markMeetingComplete(meetingId: string) {
  const { summary, privacyMode } = await generateMeetingSummary(meetingId);
  await prisma.meeting.update({
    where: { id: meetingId },
    data: { status: "completed" },
  });
  revalidatePath(`/meetings/${meetingId}`);
  revalidatePath("/meetings");
  revalidatePath("/calendar");
  if (shouldSyncMeetingOutside(privacyMode)) revalidatePath("/memory");
  return { ok: true as const, summary, privacyMode };
}
