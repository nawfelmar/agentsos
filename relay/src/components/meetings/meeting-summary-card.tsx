"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, CircleHelp, ClipboardList, AlertTriangle, FileText, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { generateMeetingSummary, markMeetingComplete } from "@/lib/actions/meetings";
import type { MeetingSummary } from "@/lib/domain/meeting-summary";

export function MeetingSummaryCard({
  meetingId,
  status,
  summary,
}: {
  meetingId: string
  status: string
  summary: MeetingSummary | null
}) {
  const [pending, start] = useTransition();
  const router = useRouter();

  return (
    <section className="rounded-relay border border-line bg-surface/70 p-4 animate-fade-up">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-accent" />
          <h2 className="text-sm font-semibold text-ink">Meeting summary</h2>
          {summary && <Badge tone="accent">{summary.mode}</Badge>}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="secondary"
            disabled={pending}
            onClick={() =>
              start(async () => {
                await generateMeetingSummary(meetingId);
                router.refresh();
              })
            }
          >
            <Sparkles className="h-3.5 w-3.5" />
            {summary ? "Regenerate" : "Generate summary"}
          </Button>
          {status !== "completed" && status !== "cancelled" && (
            <Button
              size="sm"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  await markMeetingComplete(meetingId);
                  router.refresh();
                })
              }
            >
              Complete + summarize
            </Button>
          )}
        </div>
      </div>

      {!summary ? (
        <p className="text-xs text-muted">
          One click builds a clear summary: TL;DR, decisions, owners, open questions, and audience notes —
          written for skimming, not a transcript dump.
        </p>
      ) : (
        <div className="space-y-4">
          <div className="rounded-relay border border-accent/25 bg-accent-dim/30 px-3 py-2.5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-accent">TL;DR</p>
            <p className="mt-1 text-sm leading-relaxed text-ink">{summary.tldr}</p>
          </div>

          <SummaryBlock
            icon={<CheckCircle2 className="h-3.5 w-3.5 text-success" />}
            title="Decisions"
          >
            <ul className="space-y-1.5">
              {summary.decisions.map((d, i) => (
                <li key={i} className="flex gap-2 text-xs">
                  <Badge tone={d.status === "confirmed" ? "success" : "warn"}>{d.status}</Badge>
                  <span className="text-ink">{d.text}</span>
                </li>
              ))}
            </ul>
          </SummaryBlock>

          <SummaryBlock
            icon={<ClipboardList className="h-3.5 w-3.5 text-accent" />}
            title="Action items"
          >
            <ul className="space-y-2">
              {summary.actionItems.map((a, i) => (
                <li key={i} className="text-xs">
                  <p className="text-ink">{a.text}</p>
                  <p className="mt-0.5 text-faint">
                    {a.owner}
                    {a.due ? ` · due ${a.due}` : ""}
                  </p>
                </li>
              ))}
            </ul>
          </SummaryBlock>

          <div className="grid gap-3 sm:grid-cols-2">
            <SummaryBlock
              icon={<CircleHelp className="h-3.5 w-3.5 text-warn" />}
              title="Open questions"
            >
              <ul className="list-disc space-y-1 pl-4 text-xs text-muted">
                {summary.openQuestions.map((q, i) => (
                  <li key={i}>{q}</li>
                ))}
              </ul>
            </SummaryBlock>
            <SummaryBlock
              icon={<AlertTriangle className="h-3.5 w-3.5 text-danger" />}
              title="Risks"
            >
              <ul className="list-disc space-y-1 pl-4 text-xs text-muted">
                {summary.risks.map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
            </SummaryBlock>
          </div>

          <SummaryBlock title="Audience notes">
            <div className="space-y-2">
              {(
                [
                  ["Engineering", summary.audienceNotes.engineering],
                  ["Product", summary.audienceNotes.product],
                  ["Management", summary.audienceNotes.management],
                ] as const
              ).map(([label, body]) => (
                <div key={label} className="rounded-md border border-line bg-canvas/50 px-2.5 py-2">
                  <p className="text-[11px] font-semibold text-faint">{label}</p>
                  <p className="mt-0.5 text-xs text-muted">{body}</p>
                </div>
              ))}
            </div>
          </SummaryBlock>
        </div>
      )}
    </section>
  );
}

function SummaryBlock({
  title,
  icon,
  children,
}: {
  title: string
  icon?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-center gap-1.5">
        {icon}
        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-faint">{title}</p>
      </div>
      {children}
    </div>
  );
}
