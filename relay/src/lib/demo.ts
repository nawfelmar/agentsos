export const DEMO = {
  mode: process.env.NEXT_PUBLIC_DEMO_MODE !== "false",
  hasLlm: Boolean(process.env.OPENAI_API_KEY),
  hasAv: Boolean(process.env.LIVEKIT_API_KEY),
  hasCalendar: Boolean(process.env.GOOGLE_CALENDAR_CLIENT_ID),
} as const;

export function integrationLabel(kind: "llm" | "av" | "calendar") {
  if (kind === "llm") return DEMO.hasLlm ? "Live model" : "Demo AI";
  if (kind === "av")
    return DEMO.hasAv
      ? "Live A/V (LiveKit)"
      : "Local mic · stock peer A/V";
  return DEMO.hasCalendar ? "Live calendar" : "Demo calendar";
}
