import { z } from "zod";

/** Structured meeting summary — scannable, not a wall of text. */
export const MeetingSummarySchema = z.object({
  headline: z.string(),
  tldr: z.string(),
  decisions: z.array(
    z.object({
      text: z.string(),
      status: z.enum(["confirmed", "proposed"]).default("confirmed"),
    })
  ),
  actionItems: z.array(
    z.object({
      text: z.string(),
      owner: z.string(),
      due: z.string().optional(),
    })
  ),
  openQuestions: z.array(z.string()),
  risks: z.array(z.string()),
  audienceNotes: z.object({
    engineering: z.string(),
    product: z.string(),
    management: z.string(),
  }),
  generatedAt: z.string(),
  mode: z.enum(["demo", "live"]).default("demo"),
});

export type MeetingSummary = z.infer<typeof MeetingSummarySchema>;

export type MeetingSummaryContext = {
  title: string
  purpose: string | null
  agenda: { item: string; owner: string }[]
  participants: string[]
  existingDecisions: { title: string; summary: string; status: string }[]
  existingActions: { title: string; owner?: string | null; status: string }[]
  relatedBlocker?: { title: string; status: string } | null
  isAiProposed: boolean
};

/** Deterministic, evidence-grounded demo summary for clear reading. */
export function buildDemoMeetingSummary(ctx: MeetingSummaryContext): MeetingSummary {
  const decisions =
    ctx.existingDecisions.length > 0
      ? ctx.existingDecisions.map((d) => ({
          text: d.title,
          status: (d.status === "confirmed" ? "confirmed" : "proposed") as "confirmed" | "proposed",
        }))
      : ctx.isAiProposed
        ? [
            {
              text: "Proceed with Platform + Checkout sync path; RC mock remains unapproved unless Maya confirms publish ETA tomorrow AM.",
              status: "confirmed" as const,
            },
          ]
        : [
            {
              text: `Aligned on purpose: ${ctx.purpose ?? ctx.title}`,
              status: "confirmed" as const,
            },
          ];

  const actionItems =
    ctx.existingActions.length > 0
      ? ctx.existingActions.map((a) => ({
          text: a.title,
          owner: a.owner ?? "Unassigned",
          due: undefined as string | undefined,
        }))
      : [
          {
            text: "Confirm HSM rotate / auth-sdk publish window",
            owner: ctx.participants.find((p) => p.includes("Maya")) ?? "Maya Chen",
            due: "Before RC cut",
          },
          {
            text: "Update Checkout RC checklist with go/no-go criteria",
            owner: ctx.participants.find((p) => p.includes("Nina")) ?? "Nina Volkov",
            due: "EOD",
          },
        ];

  const openQuestions = [
    "Is a scoped auth mock acceptable if publish slips past tomorrow AM?",
    "Who owns OPS-1842 escalation if HSM rotate stays blocked?",
  ];

  const risks = [
    ctx.relatedBlocker
      ? `Blocker still ${ctx.relatedBlocker.status}: ${ctx.relatedBlocker.title}`
      : "No linked blocker — watch for new dependency slips",
    "Thursday RC at risk if SDK artifact is not available by tomorrow AM",
  ];

  const owners = actionItems.map((a) => a.owner).join(", ");

  return {
    headline: ctx.title,
    tldr:
      decisions[0]?.text ??
      `Meeting covered ${ctx.agenda.length || 1} agenda items with ${ctx.participants.length} participants.`,
    decisions,
    actionItems,
    openQuestions,
    risks,
    audienceNotes: {
      engineering: `Next engineering work: ${actionItems.map((a) => a.text).join("; ")}. Owners: ${owners}.`,
      product: `RC decision still hinges on auth-sdk timing. Product should expect a go/no-go update after publish ETA is confirmed.`,
      management: `Delivery risk: Checkout RC may slip if Platform publish misses tomorrow AM. Escalation path is OPS-1842 / Platform lead.`,
    },
    generatedAt: new Date().toISOString(),
    mode: "demo",
  };
}
