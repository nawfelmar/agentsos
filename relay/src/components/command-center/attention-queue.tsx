"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { AlertTriangle, CalendarClock, CheckCircle2, Clock3, HelpCircle } from "lucide-react";
import { Badge, severityTone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { rejectProposedMeeting } from "@/lib/actions/coordination";
import { confirmPromptProposedAction } from "@/lib/actions/prompts";

const icons = {
  blocker: AlertTriangle,
  proposed_meeting: CalendarClock,
  overdue: Clock3,
  decision: HelpCircle,
  default: HelpCircle,
};

type AttentionItem = {
  id: string
  kind: string
  title: string
  explanation: string
  owner: string
  severity: string
  href: string
  meta?: string | null
  proposedActionId?: string
};

export function AttentionQueue({ items }: { items: AttentionItem[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();

  return (
    <section className="space-y-3 animate-fade-up">
      <div className="flex items-baseline justify-between">
        <h2 className="text-sm font-semibold text-ink">Attention queue</h2>
        <span className="text-[11px] text-faint">{items.length} items</span>
      </div>
      <div className="space-y-2">
        {items.map((item) => {
          const Icon = icons[item.kind as keyof typeof icons] ?? icons.default;
          return (
            <article
              key={item.id}
              className="group rounded-relay border border-line bg-surface/80 p-3 transition-colors hover:border-line-strong hover:bg-surface-2/60"
            >
              <div className="flex items-start gap-3">
                <div className="mt-0.5 rounded-md bg-surface-3 p-1.5 text-muted">
                  <Icon className="h-3.5 w-3.5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link href={item.href} className="text-sm font-medium text-ink hover:text-accent">
                      {item.title}
                    </Link>
                    <Badge tone={severityTone(item.severity)}>{item.severity}</Badge>
                    {item.meta && <Badge tone="muted">{item.meta}</Badge>}
                  </div>
                  <p className="mt-1 text-xs leading-relaxed text-muted">{item.explanation}</p>
                  <p className="mt-2 text-[11px] text-faint">Owner · {item.owner}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Link href={item.href}>
                      <Button variant="secondary" size="sm">
                        Inspect evidence
                      </Button>
                    </Link>
                    {item.proposedActionId && (
                      <>
                        <Button
                          size="sm"
                          disabled={pending}
                          onClick={() =>
                            start(async () => {
                              const res = await confirmPromptProposedAction(item.proposedActionId!);
                              const runId =
                                res && "runId" in res && typeof res.runId === "string"
                                  ? res.runId
                                  : "run_auth_blocker";
                              router.push(`/coordination/${runId}?approved=1`);
                              router.refresh();
                            })
                          }
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Approve meeting
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={pending}
                          onClick={() =>
                            start(async () => {
                              await rejectProposedMeeting(item.proposedActionId!);
                              router.refresh();
                            })
                          }
                        >
                          Reject
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
