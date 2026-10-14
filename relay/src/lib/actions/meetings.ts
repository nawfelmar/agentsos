"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";

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

export async function markMeetingComplete(meetingId: string, summary: string) {
  await prisma.meeting.update({
    where: { id: meetingId },
    data: {
      status: "completed",
      outcomesJson: JSON.stringify({ summary }),
    },
  });
  revalidatePath(`/meetings/${meetingId}`);
  revalidatePath("/meetings");
  revalidatePath("/memory");
  return { ok: true as const };
}
