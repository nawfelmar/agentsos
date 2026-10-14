"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { parseJson } from "@/lib/utils";
import type { MeetingPositions, Stance } from "@/lib/domain/meeting-positions";
import { STANCES } from "@/lib/domain/meeting-positions";
import { shouldSyncMeetingOutside } from "@/lib/domain/meeting-privacy";

function revalidateMeeting(meetingId: string) {
  revalidatePath(`/meetings/${meetingId}`);
  revalidatePath("/meetings");
  revalidatePath("/calendar");
  revalidatePath("/activity");
  revalidatePath("/people");
}

export async function startLiveMeeting(meetingId: string) {
  const meeting = await prisma.meeting.findUnique({ where: { id: meetingId } });
  if (!meeting) throw new Error("Meeting not found");
  if (meeting.status === "cancelled" || meeting.status === "completed") {
    throw new Error("Cannot start a cancelled or completed meeting");
  }

  await prisma.meeting.update({
    where: { id: meetingId },
    data: { status: "in_progress" },
  });

  await prisma.meetingParticipant.updateMany({
    where: { meetingId, response: { in: ["pending", "accepted", "tentative"] } },
    data: { response: "in_call" },
  });

  const user = await prisma.user.findFirst({ where: { isCurrentUser: true } });
  // Privacy mode: skip org-wide notifications so nothing leaks outside the room
  if (user && shouldSyncMeetingOutside(meeting.privacyMode)) {
    await prisma.notification.create({
      data: {
        organizationId: user.organizationId,
        userId: user.id,
        kind: "meeting",
        title: "Meeting in progress",
        body: `“${meeting.title}” is live — call anyone from People into the room.`,
        href: `/meetings/${meetingId}`,
        read: false,
      },
    });
  }

  revalidateMeeting(meetingId);
  return { ok: true as const };
}

/** Call any employee into the live meeting (demo dial → join). */
export async function callPersonIntoMeeting(meetingId: string, userId: string) {
  const [meeting, person, caller] = await Promise.all([
    prisma.meeting.findUnique({
      where: { id: meetingId },
      include: { participants: true },
    }),
    prisma.user.findUnique({ where: { id: userId } }),
    prisma.user.findFirst({ where: { isCurrentUser: true } }),
  ]);
  if (!meeting || !person || !caller) throw new Error("Meeting or person not found");
  if (meeting.status !== "in_progress" && meeting.status !== "scheduled" && meeting.status !== "proposed") {
    throw new Error("Start the meeting before calling people");
  }

  // Auto-start if still scheduled/proposed
  if (meeting.status !== "in_progress") {
    await prisma.meeting.update({
      where: { id: meetingId },
      data: { status: "in_progress" },
    });
  }

  const existing = meeting.participants.find((p) => p.userId === userId);
  if (existing) {
    await prisma.meetingParticipant.update({
      where: { id: existing.id },
      data: { response: "ringing" },
    });
  } else {
    await prisma.meetingParticipant.create({
      data: {
        meetingId,
        userId,
        role: "optional",
        response: "ringing",
      },
    });
  }

  // Demo: after "ring", they join the call
  await prisma.meetingParticipant.updateMany({
    where: { meetingId, userId },
    data: { response: "in_call" },
  });

  // Pin a starter statement so they show up clearly on the shared board
  const outcomes = parseJson<{ positions?: MeetingPositions }>(meeting.outcomesJson, {});
  const positions = outcomes.positions ?? {
    topic: meeting.purpose ?? meeting.title,
    alignmentLabel: "Live meeting — people joining",
    highlights: [],
    generatedAt: new Date().toISOString(),
    mode: "demo" as const,
  };

  if (!positions.highlights.some((h) => h.speaker === person.name)) {
    positions.highlights.push({
      id: `hl_call_${person.id}_${Date.now()}`,
      speaker: person.name,
      stance: "neutral",
      position: `Just joined the call — listening before taking a position on “${meeting.title}”.`,
      highlight: `Thanks for looping me in — catch me up on the open question.`,
      topic: positions.topic,
      atLabel: new Date().toLocaleTimeString([], { minute: "2-digit", second: "2-digit" }),
    });
    positions.alignmentLabel = `${positions.highlights.length} people on the shared board`;
    positions.generatedAt = new Date().toISOString();

    await prisma.meeting.update({
      where: { id: meetingId },
      data: {
        outcomesJson: JSON.stringify({ ...outcomes, positions }),
        status: "in_progress",
      },
    });
  }

  if (shouldSyncMeetingOutside(meeting.privacyMode)) {
    await prisma.notification.create({
      data: {
        organizationId: caller.organizationId,
        userId: caller.id,
        kind: "meeting",
        title: `Called ${person.name}`,
        body: `${person.name} joined “${meeting.title}” (demo call).`,
        href: `/meetings/${meetingId}`,
        read: false,
      },
    });
  }

  revalidateMeeting(meetingId);
  return { ok: true as const, name: person.name };
}

export async function pinLiveStatement(input: {
  meetingId: string
  speakerUserId: string
  position: string
  highlight: string
  stance: Stance
}) {
  if (!STANCES.includes(input.stance)) throw new Error("Invalid stance");
  const meeting = await prisma.meeting.findUnique({ where: { id: input.meetingId } });
  const speaker = await prisma.user.findUnique({ where: { id: input.speakerUserId } });
  if (!meeting || !speaker) throw new Error("Not found");

  const outcomes = parseJson<{ positions?: MeetingPositions }>(meeting.outcomesJson, {});
  const positions: MeetingPositions = outcomes.positions ?? {
    topic: meeting.purpose ?? meeting.title,
    alignmentLabel: "Live statements",
    highlights: [],
    generatedAt: new Date().toISOString(),
    mode: "demo",
  };

  const next = {
    id: `hl_live_${speaker.id}_${Date.now()}`,
    speaker: speaker.name,
    stance: input.stance,
    position: input.position.trim(),
    highlight: input.highlight.trim(),
    topic: positions.topic,
    atLabel: new Date().toLocaleTimeString([], { minute: "2-digit", second: "2-digit" }),
  };

  // Replace prior highlight for same speaker so the board stays clear
  positions.highlights = [
    ...positions.highlights.filter((h) => h.speaker !== speaker.name),
    next,
  ];
  positions.alignmentLabel = "Updated from live statements";
  positions.generatedAt = new Date().toISOString();

  await prisma.meeting.update({
    where: { id: input.meetingId },
    data: {
      outcomesJson: JSON.stringify({ ...outcomes, positions }),
      status: meeting.status === "scheduled" || meeting.status === "proposed" ? "in_progress" : meeting.status,
    },
  });

  // Ensure speaker is in-call
  const part = await prisma.meetingParticipant.findFirst({
    where: { meetingId: input.meetingId, userId: speaker.id },
  });
  if (part) {
    await prisma.meetingParticipant.update({
      where: { id: part.id },
      data: { response: "in_call" },
    });
  }

  revalidateMeeting(input.meetingId);
  return { ok: true as const };
}

export async function endLiveMeeting(meetingId: string) {
  const { markMeetingComplete } = await import("@/lib/actions/meetings");
  await prisma.meetingParticipant.updateMany({
    where: { meetingId, response: { in: ["in_call", "ringing"] } },
    data: { response: "accepted" },
  });
  const result = await markMeetingComplete(meetingId);
  revalidateMeeting(meetingId);
  return result;
}
