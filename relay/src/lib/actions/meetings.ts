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
            .map((userId) => ({ userId, role: "required", response: "pending" })),
        ],
      },
    },
  });

  revalidatePath("/meetings");
  revalidatePath("/calendar");
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

/** Generate a structured summary without necessarily closing the meeting. */
export async function generateMeetingSummary(meetingId: string) {
  const { meeting, context } = await loadSummaryContext(meetingId);
  const summary = (await maybeLiveSummary(context)) ?? buildDemoMeetingSummary(context);

  const previous = parseJson<Record<string, unknown>>(meeting.outcomesJson, {});
  await prisma.meeting.update({
    where: { id: meetingId },
    data: {
      outcomesJson: JSON.stringify({
        ...previous,
        summary: summary.tldr,
        structured: summary,
      }),
      preparationStatus: "complete",
    },
  });

  // Mirror confirmed decisions / actions into memory if missing
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
            evidenceJson: JSON.stringify([{ label: "Meeting summary", href: `/meetings/${meeting.id}` }]),
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

  await prisma.auditEvent.create({
    data: {
      organizationId: meeting.organizationId,
      actor: "relay-ai",
      action: "meeting.summary.generated",
      targetType: "Meeting",
      targetId: meeting.id,
      detail: summary.headline,
    },
  });

  revalidatePath(`/meetings/${meetingId}`);
  revalidatePath("/meetings");
  revalidatePath("/memory");
  return { ok: true as const, summary };
}

export async function markMeetingComplete(meetingId: string) {
  const { summary } = await generateMeetingSummary(meetingId);
  await prisma.meeting.update({
    where: { id: meetingId },
    data: { status: "completed" },
  });
  revalidatePath(`/meetings/${meetingId}`);
  revalidatePath("/meetings");
  revalidatePath("/calendar");
  revalidatePath("/memory");
  return { ok: true as const, summary };
}
