import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/shell/app-shell";
import { Badge } from "@/components/ui/badge";
import { MemorySearch } from "@/components/memory/search";
import { formatRelative } from "@/lib/utils";
import { ensureSeeded } from "@/lib/ensure-seeded";
import { getCurrentUser, getMemory, getNotifications, searchMemory } from "@/lib/queries";

export default async function MemoryPage({
  searchParams,
}: {
  searchParams: { q?: string }
}) {
  if (!(await ensureSeeded())) redirect("/setup");
  const [user, memory, notifications, search] = await Promise.all([
    getCurrentUser(),
    getMemory(),
    getNotifications(),
    searchParams.q ? searchMemory(searchParams.q) : Promise.resolve(null),
  ]);
  if (!user || !memory) redirect("/setup");

  return (
    <AppShell
      user={user}
      unread={notifications.filter((n) => !n.read).length}
      header={
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.1em] text-faint">
            Decisions & Memory
          </p>
          <p className="text-sm font-medium text-ink">Organizational memory</p>
        </div>
      }
      contextTitle="Grounding"
      context={
        <p className="text-xs leading-relaxed text-muted">
          Answers cite stored evidence. If information is missing or contradictory, Relay says so rather than
          inventing certainty.
        </p>
      }
    >
      <div className="mx-auto max-w-5xl space-y-6 p-5 md:p-6">
        <MemorySearch initialQuery={searchParams.q ?? ""} />

        {search && (
          <section className="space-y-2 rounded-relay border border-accent/25 bg-accent-dim/40 p-4">
            <h2 className="text-sm font-semibold text-ink">Search results for “{searchParams.q}”</h2>
            {search.decisions.map((d) => (
              <p key={d.id} className="text-xs text-muted">
                Decision · {d.title}
              </p>
            ))}
            {search.commitments.map((c) => (
              <p key={c.id} className="text-xs text-muted">
                Commitment · {c.title}
              </p>
            ))}
            {search.messages.map((m) => (
              <p key={m.id} className="text-xs text-muted">
                #{m.channel.slug} · {m.author.name}: {m.body.slice(0, 100)}
              </p>
            ))}
            {search.decisions.length + search.commitments.length + search.messages.length === 0 && (
              <p className="text-xs text-muted">
                No grounded matches. Relay will not invent an answer from empty evidence.
              </p>
            )}
          </section>
        )}

        <MemorySection title="Decisions">
          {memory.decisions.map((d) => (
            <article key={d.id} className="rounded-relay border border-line bg-surface/70 p-3">
              <div className="flex flex-wrap gap-2">
                <p className="text-sm font-medium text-ink">{d.title}</p>
                <Badge tone={d.status === "confirmed" ? "success" : "warn"}>{d.status}</Badge>
              </div>
              <p className="mt-1 text-xs text-muted">{d.summary}</p>
              <p className="mt-2 text-[11px] text-faint">
                {d.owner?.name ?? "Unowned"} · {d.project?.key ?? "ORG"} · {formatRelative(d.createdAt)}
                {d.meetingId && (
                  <>
                    {" · "}
                    <Link href={`/meetings/${d.meetingId}`} className="text-accent hover:underline">
                      meeting
                    </Link>
                  </>
                )}
              </p>
            </article>
          ))}
        </MemorySection>

        <MemorySection title="Commitments">
          {memory.commitments.map((c) => (
            <article key={c.id} className="rounded-relay border border-line bg-surface/70 p-3">
              <div className="flex flex-wrap gap-2">
                <p className="text-sm font-medium text-ink">{c.title}</p>
                <Badge tone={c.status === "overdue" ? "danger" : "muted"}>{c.status}</Badge>
              </div>
              <p className="mt-1 text-xs text-muted">{c.description}</p>
              <p className="mt-2 text-[11px] text-faint">
                {c.ownerName} · {c.project?.key}
              </p>
            </article>
          ))}
        </MemorySection>

        <MemorySection title="Action items">
          {memory.actionItems.map((a) => (
            <article key={a.id} className="rounded-relay border border-line bg-surface/70 p-3">
              <div className="flex flex-wrap gap-2">
                <p className="text-sm font-medium text-ink">{a.title}</p>
                <Badge tone="accent">{a.status}</Badge>
              </div>
              <p className="mt-1 text-xs text-muted">{a.description}</p>
              <p className="mt-2 text-[11px] text-faint">{a.owner?.name ?? "Unassigned"}</p>
            </article>
          ))}
        </MemorySection>

        <MemorySection title="Blockers & open questions">
          {memory.blockers.map((b) => (
            <article key={b.id} className="rounded-relay border border-line bg-surface/70 p-3">
              <p className="text-sm font-medium text-ink">{b.title}</p>
              <p className="mt-1 text-xs text-muted">{b.description}</p>
              <Badge tone="warn" className="mt-2">
                {b.status}
              </Badge>
            </article>
          ))}
          {memory.questions.map((q) => (
            <article key={q.id} className="rounded-relay border border-line bg-surface/70 p-3">
              <Badge tone="muted">clarification</Badge>
              <p className="mt-1 text-xs text-ink">{q.detail}</p>
            </article>
          ))}
        </MemorySection>
      </div>
    </AppShell>
  );
}

function MemorySection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="text-sm font-semibold text-ink">{title}</h2>
      <div className="space-y-2">{children}</div>
    </section>
  );
}
