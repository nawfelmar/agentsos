import { z } from "zod";

/** Full catalog of coordination actions a prompt can target. */
export const COORDINATION_ACTION_KINDS = [
  "approve_pending",
  "reject_pending",
  "schedule_meeting",
  "send_update",
  "escalate",
  "reassign",
  "pause_run",
  "resume_run",
  "clarify",
  "async_question",
  "resolve_check",
  "mark_resolved",
] as const;

export type CoordinationActionKind = (typeof COORDINATION_ACTION_KINDS)[number];

export const ACTION_META: Record<
  CoordinationActionKind,
  { label: string; description: string; requiresApproval: boolean }
> = {
  approve_pending: {
    label: "Approve pending action",
    description: "Approve the run’s pending proposed action (e.g. meeting).",
    requiresApproval: false,
  },
  reject_pending: {
    label: "Reject pending action",
    description: "Reject the pending proposal and prefer async follow-up.",
    requiresApproval: false,
  },
  schedule_meeting: {
    label: "Propose / schedule meeting",
    description: "Create a short meeting proposal with agenda and participants.",
    requiresApproval: true,
  },
  send_update: {
    label: "Stakeholder update",
    description: "Draft or send an audience-specific status update.",
    requiresApproval: true,
  },
  escalate: {
    label: "Escalate",
    description: "Escalate the issue to an executive or designated recipient.",
    requiresApproval: true,
  },
  reassign: {
    label: "Reassign ownership",
    description: "Reassign the blocker / run owner.",
    requiresApproval: true,
  },
  pause_run: {
    label: "Pause automation",
    description: "Pause autonomous coordination for this run.",
    requiresApproval: false,
  },
  resume_run: {
    label: "Resume automation",
    description: "Resume a paused coordination run.",
    requiresApproval: false,
  },
  clarify: {
    label: "Ask clarification",
    description: "Generate and record an AI clarification question.",
    requiresApproval: false,
  },
  async_question: {
    label: "Async question",
    description: "Send a targeted async question instead of scheduling a meeting.",
    requiresApproval: false,
  },
  resolve_check: {
    label: "Resolution check",
    description: "Verify whether the blocker appears resolved from current evidence.",
    requiresApproval: false,
  },
  mark_resolved: {
    label: "Mark resolved",
    description: "Close the blocker and complete the coordination run.",
    requiresApproval: true,
  },
};

export const InterpretedActionSchema = z.object({
  kind: z.enum(COORDINATION_ACTION_KINDS),
  title: z.string().min(1),
  description: z.string().min(1),
  rationale: z.string(),
  payload: z.record(z.string(), z.any()).default({}),
  confidence: z.number().min(0).max(1).default(0.7),
});

export type InterpretedAction = z.infer<typeof InterpretedActionSchema>;

export const PROMPT_EXAMPLES = [
  "Approve the pending meeting for the auth-sdk blocker",
  "Escalate this to Priya and draft a management update",
  "Ask Jordan asynchronously whether a mock is acceptable for RC",
  "Pause automation on this run until OPS-1842 lands",
  "Propose a 25-minute sync with Maya, Nina, and Jordan",
  "Reassign the blocker to Chris Park",
  "Check whether the blocker is resolved",
  "Mark this blocker resolved and close the run",
];

/** Deterministic demo interpreter — keyword/intent matching over freeform prompts. */
export function interpretPromptDemo(
  prompt: string,
  context?: { runTitle?: string; hasPendingAction?: boolean }
): InterpretedAction {
  const p = prompt.trim().toLowerCase();
  const runHint = context?.runTitle ? ` for “${context.runTitle}”` : "";

  if (/\b(approve|confirm)\b/.test(p) && /\b(meeting|proposal|pending|action)\b/.test(p)) {
    return {
      kind: "approve_pending",
      title: "Approve pending coordination action",
      description: `Execute approval from prompt${runHint}.`,
      rationale: "Prompt requests approval of the pending proposed action.",
      payload: { prompt },
      confidence: 0.92,
    };
  }

  if (/\b(reject|decline|cancel)\b/.test(p) && /\b(meeting|proposal|pending)\b/.test(p)) {
    return {
      kind: "reject_pending",
      title: "Reject pending coordination action",
      description: `Reject pending proposal from prompt${runHint}.`,
      rationale: "Prompt prefers rejecting the pending action.",
      payload: { prompt, note: prompt },
      confidence: 0.9,
    };
  }

  if (/\bpause\b/.test(p)) {
    return {
      kind: "pause_run",
      title: "Pause automation",
      description: `Pause autonomous coordination${runHint}.`,
      rationale: "Prompt explicitly requests pausing automation.",
      payload: { prompt },
      confidence: 0.95,
    };
  }

  if (/\bresume\b/.test(p)) {
    return {
      kind: "resume_run",
      title: "Resume automation",
      description: `Resume coordination${runHint}.`,
      rationale: "Prompt requests resuming the run.",
      payload: { prompt },
      confidence: 0.95,
    };
  }

  if (/\bescalat/.test(p)) {
    const to =
      /\bpriya\b/.test(p) ? "Priya Nair" : /\bvp\b|\bexec/.test(p) ? "Priya Nair" : "Priya Nair";
    return {
      kind: "escalate",
      title: `Escalate to ${to}`,
      description: `Escalate issue${runHint} with evidence-linked summary.`,
      rationale: "Prompt requests escalation to leadership.",
      payload: { prompt, recipient: to, audience: "management" },
      confidence: 0.88,
    };
  }

  if (/\breassign\b|\bhand off\b|\bowner\b/.test(p) && /\b(to|chris|maya|jordan|nina)\b/.test(p)) {
    let owner = "Chris Park";
    if (/\bmaya\b/.test(p)) owner = "Maya Chen";
    if (/\bjordan\b/.test(p)) owner = "Jordan Lee";
    if (/\bnina\b/.test(p)) owner = "Nina Volkov";
    if (/\bchris\b/.test(p)) owner = "Chris Park";
    return {
      kind: "reassign",
      title: `Reassign ownership to ${owner}`,
      description: `Change blocker/run owner to ${owner}${runHint}.`,
      rationale: "Prompt names a new owner.",
      payload: { prompt, ownerName: owner },
      confidence: 0.86,
    };
  }

  if (/\b(schedule|propose|book|set up)\b/.test(p) && /\b(meeting|sync|call)\b/.test(p)) {
    return {
      kind: "schedule_meeting",
      title: "Propose dependency-resolution meeting",
      description: `Create a meeting proposal from prompt${runHint}.`,
      rationale: "Prompt asks to schedule or propose a meeting.",
      payload: {
        prompt,
        durationMinutes: /\b15\b/.test(p) ? 15 : 25,
        participants: ["Maya Chen", "Nina Volkov", "Jordan Lee"],
      },
      confidence: 0.9,
    };
  }

  if (/\b(update|status|stakeholder|notify|inform)\b/.test(p)) {
    const audience = /\bmanagement\b|\bexec|\bpriya\b/.test(p)
      ? "management"
      : /\bproduct\b|\bsam\b/.test(p)
        ? "product"
        : "engineering";
    return {
      kind: "send_update",
      title: `Draft ${audience} stakeholder update`,
      description: `Prepare an evidence-linked update for ${audience}${runHint}.`,
      rationale: "Prompt requests stakeholder communication.",
      payload: { prompt, audience },
      confidence: 0.87,
    };
  }

  if (/\basync\b|\bDM\b|\bdirect message\b|\bask .+ instead\b/i.test(prompt) || /\bquestion\b/.test(p)) {
    if (/\bclarif/.test(p) || /\bre-?run\b/.test(p)) {
      return {
        kind: "clarify",
        title: "Generate clarification question",
        description: `Ask a precise clarification${runHint}.`,
        rationale: "Prompt requests clarification.",
        payload: { prompt },
        confidence: 0.84,
      };
    }
    return {
      kind: "async_question",
      title: "Send asynchronous question",
      description: `Prefer async resolution${runHint} instead of a meeting.`,
      rationale: "Prompt prefers an async question path.",
      payload: {
        prompt,
        question:
          "Is a temporary auth mock acceptable for Thursday RC, or must we wait for auth-sdk@2.4.0 publish?",
        to: "Jordan Lee",
      },
      confidence: 0.85,
    };
  }

  if (/\bclarif/.test(p)) {
    return {
      kind: "clarify",
      title: "Generate clarification question",
      description: `Ask a precise clarification${runHint}.`,
      rationale: "Prompt requests clarification.",
      payload: { prompt },
      confidence: 0.9,
    };
  }

  if (/\b(check|verify|resolution check)\b/.test(p) && /\bresolv/.test(p)) {
    return {
      kind: "resolve_check",
      title: "Run resolution check",
      description: `Inspect whether the blocker still holds${runHint}.`,
      rationale: "Prompt asks to verify resolution status.",
      payload: { prompt },
      confidence: 0.88,
    };
  }

  if (/\b(mark|close).*\bresolv|\bresolved\b/.test(p) || /\bclose the run\b/.test(p)) {
    return {
      kind: "mark_resolved",
      title: "Mark blocker resolved",
      description: `Close blocker and complete the run${runHint}.`,
      rationale: "Prompt requests marking the issue resolved.",
      payload: { prompt },
      confidence: 0.9,
    };
  }

  // Default: treat as async question so every prompt maps to an executable action
  return {
    kind: "async_question",
    title: "Interpret prompt as async coordination ask",
    description: `No stronger intent matched — draft an async question from: “${prompt.slice(0, 120)}”`,
    rationale:
      "Fallback mapping keeps the prompt executable. Refine wording or pin an action kind for higher confidence.",
    payload: { prompt, question: prompt, to: "Jordan Lee" },
    confidence: 0.45,
  };
}
