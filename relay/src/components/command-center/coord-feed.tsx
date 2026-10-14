import { formatRelative } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

export function CoordFeed({
  events,
}: {
  events: {
    id: string
    kind: string
    title: string
    detail: string | null
    outcome: string | null
    actor: string
    createdAt: Date
    runTitle: string
  }[]
}) {
  return (
    <section className="space-y-3 animate-fade-up" style={{ animationDelay: "60ms" }}>
      <div className="flex items-baseline justify-between">
        <h2 className="text-sm font-semibold text-ink">AI coordination feed</h2>
        <Badge tone="accent">Live audit</Badge>
      </div>
      <ol className="space-y-0">
        {events.map((e, i) => (
          <li key={e.id} className="relative flex gap-3 pb-4 pl-2">
            {i < events.length - 1 && (
              <span className="absolute left-[15px] top-6 bottom-0 w-px bg-line" />
            )}
            <span className="relative z-10 mt-1.5 h-2 w-2 shrink-0 rounded-full bg-accent shadow-[0_0_0_3px] shadow-accent/15" />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm text-ink">{e.title}</p>
                <Badge tone="muted">{e.actor}</Badge>
              </div>
              {e.detail && <p className="mt-1 text-xs text-muted">{e.detail}</p>}
              {e.outcome && (
                <p className="mt-1 text-[11px] text-success">Outcome · {e.outcome}</p>
              )}
              <p className="mt-1.5 text-[11px] text-faint">
                {e.runTitle} · {formatRelative(e.createdAt)}
              </p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
