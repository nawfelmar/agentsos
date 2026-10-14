import { DEMO } from "@/lib/demo";

export type ClarificationResult = {
  question: string
  rationale: string
  mode: "live" | "demo"
};

export type SummaryResult = {
  summary: string
  decisions: string[]
  openQuestions: string[]
  mode: "live" | "demo"
};

/** Provider-agnostic LLM boundary. Uses OpenAI when keyed; otherwise deterministic demo. */
export async function clarifyBlocker(input: {
  title: string
  description: string
  evidence: string[]
}): Promise<ClarificationResult> {
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
                "You help coordinate engineering work. Ask one precise clarification question. Respond as JSON: {question, rationale}",
            },
            {
              role: "user",
              content: JSON.stringify(input),
            },
          ],
          response_format: { type: "json_object" },
        }),
      });
      if (res.ok) {
        const data = await res.json();
        const parsed = JSON.parse(data.choices[0].message.content);
        return { question: parsed.question, rationale: parsed.rationale, mode: "live" };
      }
    } catch {
      // fall through to demo
    }
  }

  return {
    question:
      "Is the missing Platform Auth SDK still the only blocker for checkout integration tests, or has a temporary mock been approved for this sprint?",
    rationale:
      "Evidence shows the CI job fails on auth-sdk@2.4.0 and Maya flagged the dependency owner. Confirming whether a mock is acceptable determines whether we need a live sync or can proceed asynchronously.",
    mode: "demo",
  };
}

export async function summarizeConversation(messages: { author: string; body: string }[]): Promise<SummaryResult> {
  if (messages.length === 0) {
    return {
      summary: "No messages to summarize.",
      decisions: [],
      openQuestions: [],
      mode: "demo",
    };
  }

  const authors = Array.from(new Set(messages.map((m) => m.author)));
  const preview = messages
    .slice(0, 3)
    .map((m) => `${m.author}: ${m.body.slice(0, 80)}`)
    .join(" · ");

  return {
    summary: `Summary of ${messages.length} selected message${messages.length === 1 ? "" : "s"} (${authors.slice(0, 4).join(", ")}${authors.length > 4 ? "…" : ""}). Themes: ${preview}${messages.length > 3 ? "…" : ""}`,
    decisions: ["Coordinate next steps with dependency owner before expanding scope."],
    openQuestions: ["What is the earliest feasible unblock window?"],
    mode: "demo",
  };
}
