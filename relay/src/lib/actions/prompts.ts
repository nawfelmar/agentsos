"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { DEMO } from "@/lib/demo";
import {
  ACTION_META,
  COORDINATION_ACTION_KINDS,
  interpretPromptDemo,
  type CoordinationActionKind,
  type InterpretedAction,
  InterpretedActionSchema,
} from "@/lib/domain/coordination-actions";
import {
  executeGenericProposedAction,
  executeInterpretedAction,
} from "@/lib/domain/execute-prompt-action";

function revalidateAll(runId?: string) {
  revalidatePath("/");
  revalidatePath("/coordination");
  if (runId) revalidatePath(`/coordination/${runId}`);
  revalidatePath("/meetings");
  revalidatePath("/memory");
  revalidatePath("/activity");
}

async function interpretWithOptionalLlm(
  prompt: string,
  context: { runTitle?: string; hasPendingAction?: boolean; pinnedKind?: string | null }
): Promise<InterpretedAction & { mode: "live" | "demo" }> {
  if (context.pinnedKind && COORDINATION_ACTION_KINDS.includes(context.pinnedKind as CoordinationActionKind)) {
    const kind = context.pinnedKind as CoordinationActionKind;
    const meta = ACTION_META[kind];
    return {
      kind,
      title: meta.label,
      description: `${meta.description} Prompt: ${prompt}`,
      rationale: "Pinned action kind on saved prompt.",
      payload: { prompt },
      confidence: 0.99,
      mode: "demo",
    };
  }

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
          temperature: 0.1,
          messages: [
            {
              role: "system",
              content: `Map a coordination prompt to exactly one action. Kinds: ${COORDINATION_ACTION_KINDS.join(", ")}. Return JSON: {kind,title,description,rationale,payload,confidence}`,
            },
            {
              role: "user",
              content: JSON.stringify({ prompt, context }),
            },
          ],
          response_format: { type: "json_object" },
        }),
      });
      if (res.ok) {
        const data = await res.json();
        const parsed = InterpretedActionSchema.parse({
          ...JSON.parse(data.choices[0].message.content),
          payload: {
            prompt,
            ...(JSON.parse(data.choices[0].message.content).payload ?? {}),
          },
        });
        return { ...parsed, mode: "live" };
      }
    } catch {
      // demo fallback
    }
  }

  return { ...interpretPromptDemo(prompt, context), mode: "demo" };
}

export async function interpretCoordinationPrompt(input: {
  prompt: string
  runId?: string
  pinnedKind?: string | null
}) {
  const prompt = input.prompt.trim();
  if (!prompt) throw new Error("Prompt is required");

  let runTitle: string | undefined;
  let hasPendingAction = false;
  if (input.runId) {
    const run = await prisma.coordinationRun.findUnique({
      where: { id: input.runId },
      include: { proposedActions: { where: { status: "pending" } } },
    });
    runTitle = run?.title;
    hasPendingAction = (run?.proposedActions.length ?? 0) > 0;
  }

  return interpretWithOptionalLlm(prompt, {
    runTitle,
    hasPendingAction,
    pinnedKind: input.pinnedKind,
  });
}

export async function runCoordinationPrompt(input: {
  prompt: string
  runId: string
  /** When true, execute immediately even if action normally needs approval */
  executeNow?: boolean
  pinnedKind?: string | null
}) {
  const interpreted = await interpretCoordinationPrompt(input);
  const result = await executeInterpretedAction(input.runId, interpreted, {
    forceExecute: Boolean(input.executeNow),
  });
  revalidateAll(input.runId);
  return { interpreted, result };
}

export async function confirmPromptProposedAction(proposedActionId: string) {
  const proposed = await prisma.proposedAction.findUnique({ where: { id: proposedActionId } });
  if (!proposed) throw new Error("Not found");

  if (proposed.kind === "schedule_meeting") {
    const { executeApproveProposedMeeting } = await import("@/lib/domain/approve-meeting");
    const { parseJson } = await import("@/lib/utils");
    const payload = parseJson<{ meetingId?: string }>(proposed.payloadJson, {});
    if (payload.meetingId) {
      const result = await executeApproveProposedMeeting(proposedActionId);
      revalidateAll(result.runId);
      return result;
    }
  }

  const result = await executeGenericProposedAction(proposedActionId);
  revalidateAll(proposed.runId);
  return result;
}

export async function saveCoordinationPrompt(input: {
  title: string
  prompt: string
  actionKind?: string | null
  runId?: string | null
}) {
  const user = await prisma.user.findFirst({ where: { isCurrentUser: true } });
  if (!user) throw new Error("No user");
  if (!input.title.trim() || !input.prompt.trim()) throw new Error("Title and prompt required");

  const kind = input.actionKind?.trim() || null;
  if (kind && !COORDINATION_ACTION_KINDS.includes(kind as CoordinationActionKind)) {
    throw new Error("Invalid action kind");
  }

  const saved = await prisma.coordinationPrompt.create({
    data: {
      organizationId: user.organizationId,
      title: input.title.trim(),
      prompt: input.prompt.trim(),
      actionKind: kind,
      runId: input.runId || null,
      createdById: user.id,
    },
  });
  revalidatePath("/coordination");
  return saved;
}

export async function deleteCoordinationPrompt(id: string) {
  await prisma.coordinationPrompt.delete({ where: { id } });
  revalidatePath("/coordination");
  return { ok: true as const };
}

export async function listCoordinationPrompts() {
  const org = await prisma.organization.findFirst();
  if (!org) return [];
  return prisma.coordinationPrompt.findMany({
    where: { organizationId: org.id },
    orderBy: { updatedAt: "desc" },
  });
}
