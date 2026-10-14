import { z } from "zod";

export const STANCES = ["for", "against", "conditional", "neutral", "questioning"] as const;
export type Stance = (typeof STANCES)[number];

export const StatementHighlightSchema = z.object({
  id: z.string(),
  speaker: z.string(),
  /** Plain-language position a non-attendee can understand */
  position: z.string(),
  /** Short memorable quote / paraphrase from the meeting */
  highlight: z.string(),
  stance: z.enum(STANCES),
  topic: z.string(),
  atLabel: z.string().optional(),
});

export type StatementHighlight = z.infer<typeof StatementHighlightSchema>;

export const MeetingPositionsSchema = z.object({
  topic: z.string(),
  alignmentLabel: z.string(),
  highlights: z.array(StatementHighlightSchema),
  generatedAt: z.string(),
  mode: z.enum(["demo", "live"]).default("demo"),
});

export type MeetingPositions = z.infer<typeof MeetingPositionsSchema>;

export const STANCE_LABEL: Record<Stance, string> = {
  for: "In favor",
  against: "Opposed",
  conditional: "Conditional",
  neutral: "Neutral",
  questioning: "Needs clarity",
};

type Participant = { name: string; title?: string; color?: string };

/** Demo highlights that make each person's position obvious at a glance. */
export function buildDemoMeetingPositions(input: {
  title: string
  purpose: string | null
  participants: Participant[]
  isAiProposed: boolean
}): MeetingPositions {
  const topic =
    input.purpose?.slice(0, 120) ||
    (input.isAiProposed
      ? "Whether to wait on auth-sdk@2.4.0 or approve a scoped mock for Thursday RC"
      : input.title);

  const byFirst = (name: string) =>
    input.participants.find((p) => p.name.toLowerCase().includes(name.toLowerCase()));

  const cast: {
    match: string
    stance: Stance
    position: string
    highlight: string
    atLabel: string
  }[] = input.isAiProposed
    ? [
        {
          match: "Jordan",
          stance: "against",
          position: "Against shipping RC without the real SDK — integration tests stay blocked.",
          highlight: "Without auth-sdk@2.4.0 we can’t exercise the session handoff path. A mock isn’t good enough for RC.",
          atLabel: "04:12",
        },
        {
          match: "Maya",
          stance: "conditional",
          position: "Can commit to tomorrow AM publish if HSM rotate clears — not promising earlier.",
          highlight: "2.4.0 is code-complete. If OPS-1842 lands tonight, artifact should be in the registry by tomorrow morning.",
          atLabel: "07:40",
        },
        {
          match: "Nina",
          stance: "questioning",
          position: "Needs a hard go/no-go criterion before Thursday cut — won’t accept fuzzy ETAs.",
          highlight: "I need a binary call: publish by 10:00 AM or we slip RC. Product can’t sit in limbo.",
          atLabel: "11:05",
        },
        {
          match: "Alex",
          stance: "for",
          position: "Supports keeping the short sync + written stakeholder update rather than expanding the meeting.",
          highlight: "Let’s keep this to the dependency owners and send Sam a written update — no need to pull product into another sync.",
          atLabel: "12:20",
        },
        {
          match: "Sam",
          stance: "conditional",
          position: "OK delaying RC only if engineering names a new date today.",
          highlight: "I can accept a slip, but not an open-ended one. Give me a dated alternative by EOD.",
          atLabel: "13:02",
        },
      ]
    : input.participants.slice(0, 4).map((p, i) => ({
        match: p.name.split(" ")[0] ?? p.name,
        stance: (["for", "conditional", "questioning", "neutral"] as Stance[])[i % 4],
        position: `Stated a clear view on “${topic.slice(0, 60)}”.`,
        highlight: `${p.name} aligned on the meeting purpose and called out next ownership.`,
        atLabel: `0${i + 3}:1${i}`,
      }));

  const highlights: StatementHighlight[] = [];
  for (const row of cast) {
    const person = byFirst(row.match) ?? input.participants.find((p) => p.name.includes(row.match));
    if (!person && input.isAiProposed) {
      // Still show known cast even if not on invite list
      highlights.push({
        id: `hl_${row.match.toLowerCase()}`,
        speaker: row.match === "Jordan" ? "Jordan Lee" : row.match === "Maya" ? "Maya Chen" : row.match === "Nina" ? "Nina Volkov" : row.match === "Alex" ? "Alex Rivera" : "Sam Okonkwo",
        position: row.position,
        highlight: row.highlight,
        stance: row.stance,
        topic,
        atLabel: row.atLabel,
      });
      continue;
    }
    if (!person) continue;
    highlights.push({
      id: `hl_${person.name.replace(/\s+/g, "_").toLowerCase()}`,
      speaker: person.name,
      position: row.position,
      highlight: row.highlight,
      stance: row.stance,
      topic,
      atLabel: row.atLabel,
    });
  }

  // Deduplicate speakers
  const seen = new Set<string>();
  const unique = highlights.filter((h) => {
    if (seen.has(h.speaker)) return false;
    seen.add(h.speaker);
    return true;
  });

  const forCount = unique.filter((h) => h.stance === "for").length;
  const againstCount = unique.filter((h) => h.stance === "against").length;
  const conditionalCount = unique.filter((h) => h.stance === "conditional").length;
  const questioningCount = unique.filter((h) => h.stance === "questioning").length;

  let alignmentLabel = "Positions captured — no full consensus yet";
  if (againstCount === 0 && questioningCount === 0 && conditionalCount === 0 && forCount > 0) {
    alignmentLabel = "Aligned — participants broadly in favor";
  } else if (againstCount > 0 && forCount > 0) {
    alignmentLabel = "Split — clear disagreement; decision needs an owner";
  } else if (conditionalCount > 0 || questioningCount > 0) {
    alignmentLabel = "Mostly conditional — agreement depends on a named condition";
  }

  return {
    topic,
    alignmentLabel,
    highlights: unique,
    generatedAt: new Date().toISOString(),
    mode: "demo",
  };
}

export function stanceTone(stance: Stance): "success" | "danger" | "warn" | "muted" | "accent" {
  if (stance === "for") return "success";
  if (stance === "against") return "danger";
  if (stance === "conditional") return "warn";
  if (stance === "questioning") return "accent";
  return "muted";
}
