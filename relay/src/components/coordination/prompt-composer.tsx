"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { BookmarkPlus, Play, Sparkles, Trash2, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ACTION_META,
  COORDINATION_ACTION_KINDS,
  PROMPT_EXAMPLES,
  type CoordinationActionKind,
} from "@/lib/domain/coordination-actions";
import {
  deleteCoordinationPrompt,
  interpretCoordinationPrompt,
  runCoordinationPrompt,
  saveCoordinationPrompt,
} from "@/lib/actions/prompts";
import { confirmPromptProposedAction } from "@/lib/actions/prompts";

type SavedPrompt = {
  id: string
  title: string
  prompt: string
  actionKind: string | null
  runId: string | null
};

type Preview = {
  kind: CoordinationActionKind
  title: string
  description: string
  rationale: string
  confidence: number
  mode: "live" | "demo"
  requiresApproval: boolean
};

export function PromptComposer({
  runs,
  savedPrompts,
  defaultRunId,
}: {
  runs: { id: string; title: string; status: string }[]
  savedPrompts: SavedPrompt[]
  defaultRunId?: string
}) {
  const [prompt, setPrompt] = useState("");
  const [title, setTitle] = useState("");
  const [runId, setRunId] = useState(defaultRunId ?? runs[0]?.id ?? "");
  const [pinnedKind, setPinnedKind] = useState<string>("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [resultMsg, setResultMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  const activeRuns = useMemo(() => runs.filter((r) => r.status !== "cancelled"), [runs]);

  function applySaved(s: SavedPrompt) {
    setPrompt(s.prompt);
    setTitle(s.title);
    setPinnedKind(s.actionKind ?? "");
    if (s.runId) setRunId(s.runId);
    setPreview(null);
    setResultMsg(null);
  }

  return (
    <section className="space-y-4 rounded-relay border border-line bg-surface/80 p-4 animate-fade-up">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-semibold text-ink">
            <Wand2 className="h-4 w-4 text-accent" />
            Coordination prompt
          </h2>
          <p className="mt-1 text-xs text-muted">
            Describe any coordination action in natural language. Relay interprets it, shows a preview, then
            executes or queues it for confirmation.
          </p>
        </div>
        <Badge tone="accent">Any action</Badge>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {PROMPT_EXAMPLES.slice(0, 4).map((ex) => (
          <button
            key={ex}
            type="button"
            className="rounded-md border border-line bg-canvas px-2 py-1 text-[11px] text-muted hover:border-accent/40 hover:text-ink"
            onClick={() => {
              setPrompt(ex);
              setPreview(null);
              setResultMsg(null);
            }}
          >
            {ex}
          </button>
        ))}
      </div>

      <div className="grid gap-3 md:grid-cols-[1fr_200px]">
        <label className="block space-y-1 md:col-span-1">
          <span className="text-[11px] font-medium text-faint">Prompt</span>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={3}
            placeholder="e.g. Escalate this to Priya and draft a management update"
            className="w-full rounded-relay border border-line bg-canvas px-3 py-2 text-sm text-ink outline-none focus:border-accent/40"
          />
        </label>
        <div className="space-y-3">
          <label className="block space-y-1">
            <span className="text-[11px] font-medium text-faint">Target run</span>
            <select
              value={runId}
              onChange={(e) => setRunId(e.target.value)}
              className="w-full rounded-relay border border-line bg-canvas px-2 py-2 text-xs text-ink"
            >
              {activeRuns.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.title}
                </option>
              ))}
            </select>
          </label>
          <label className="block space-y-1">
            <span className="text-[11px] font-medium text-faint">Pin action (optional)</span>
            <select
              value={pinnedKind}
              onChange={(e) => setPinnedKind(e.target.value)}
              className="w-full rounded-relay border border-line bg-canvas px-2 py-2 text-xs text-ink"
            >
              <option value="">Interpret freely</option>
              {COORDINATION_ACTION_KINDS.map((k) => (
                <option key={k} value={k}>
                  {ACTION_META[k].label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          variant="secondary"
          disabled={pending || !prompt.trim() || !runId}
          onClick={() =>
            start(async () => {
              const interpreted = await interpretCoordinationPrompt({
                prompt,
                runId,
                pinnedKind: pinnedKind || null,
              });
              setPreview({
                kind: interpreted.kind,
                title: interpreted.title,
                description: interpreted.description,
                rationale: interpreted.rationale,
                confidence: interpreted.confidence,
                mode: interpreted.mode,
                requiresApproval: ACTION_META[interpreted.kind].requiresApproval,
              });
              setResultMsg(null);
            })
          }
        >
          <Sparkles className="h-3.5 w-3.5" />
          Interpret
        </Button>
        <Button
          disabled={pending || !prompt.trim() || !runId}
          onClick={() =>
            start(async () => {
              const { interpreted, result } = await runCoordinationPrompt({
                prompt,
                runId,
                pinnedKind: pinnedKind || null,
                executeNow: false,
              });
              setPreview({
                kind: interpreted.kind,
                title: interpreted.title,
                description: interpreted.description,
                rationale: interpreted.rationale,
                confidence: interpreted.confidence,
                mode: interpreted.mode,
                requiresApproval: ACTION_META[interpreted.kind].requiresApproval,
              });
              setResultMsg(result.message);
              if (result.proposedActionId) {
                // keep pending for confirm
              } else if (result.href) {
                router.push(result.href);
              }
              router.refresh();
            })
          }
        >
          <Play className="h-3.5 w-3.5" />
          Run prompt
        </Button>
        <Button
          variant="ghost"
          disabled={pending || !prompt.trim() || !runId}
          onClick={() =>
            start(async () => {
              const { result } = await runCoordinationPrompt({
                prompt,
                runId,
                pinnedKind: pinnedKind || null,
                executeNow: true,
              });
              setResultMsg(result.message);
              router.push(result.href ?? `/coordination/${runId}`);
              router.refresh();
            })
          }
        >
          Execute now
        </Button>
      </div>

      {preview && (
        <div className="rounded-relay border border-accent/30 bg-accent-dim/40 p-3">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-medium text-ink">{preview.title}</p>
            <Badge tone="accent">{preview.kind}</Badge>
            <Badge tone="muted">{preview.mode}</Badge>
            <Badge tone={preview.confidence >= 0.8 ? "success" : "warn"}>
              {Math.round(preview.confidence * 100)}% confidence
            </Badge>
            {preview.requiresApproval && <Badge tone="warn">needs confirmation</Badge>}
          </div>
          <p className="mt-1.5 text-xs text-muted">{preview.description}</p>
          <p className="mt-1 text-[11px] text-faint">Why · {preview.rationale}</p>
        </div>
      )}

      {resultMsg && (
        <div className="rounded-relay border border-success/30 bg-success/10 px-3 py-2 text-xs text-success">
          {resultMsg}
        </div>
      )}

      <div className="border-t border-line pt-3">
        <div className="mb-2 flex flex-wrap items-end gap-2">
          <label className="min-w-[180px] flex-1 space-y-1">
            <span className="text-[11px] font-medium text-faint">Save as reusable prompt</span>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Short title"
              className="w-full rounded-relay border border-line bg-canvas px-2.5 py-1.5 text-xs text-ink outline-none focus:border-accent/40"
            />
          </label>
          <Button
            variant="secondary"
            size="sm"
            disabled={pending || !title.trim() || !prompt.trim()}
            onClick={() =>
              start(async () => {
                await saveCoordinationPrompt({
                  title,
                  prompt,
                  actionKind: pinnedKind || null,
                  runId: runId || null,
                });
                setTitle("");
                router.refresh();
              })
            }
          >
            <BookmarkPlus className="h-3.5 w-3.5" />
            Save prompt
          </Button>
        </div>

        {savedPrompts.length > 0 && (
          <ul className="space-y-1.5">
            {savedPrompts.map((s) => (
              <li
                key={s.id}
                className="flex items-start justify-between gap-2 rounded-relay border border-line bg-canvas/60 px-2.5 py-2"
              >
                <button type="button" className="min-w-0 text-left" onClick={() => applySaved(s)}>
                  <p className="text-xs font-medium text-ink">{s.title}</p>
                  <p className="truncate text-[11px] text-muted">{s.prompt}</p>
                  {s.actionKind && (
                    <Badge tone="muted" className="mt-1">
                      {s.actionKind}
                    </Badge>
                  )}
                </button>
                <div className="flex shrink-0 gap-1">
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={pending || !runId}
                    onClick={() =>
                      start(async () => {
                        applySaved(s);
                        const { result } = await runCoordinationPrompt({
                          prompt: s.prompt,
                          runId: s.runId || runId,
                          pinnedKind: s.actionKind,
                        });
                        setResultMsg(result.message);
                        if (result.proposedActionId) {
                          // optional auto-confirm path not taken — user can confirm below
                        }
                        router.refresh();
                      })
                    }
                  >
                    Run
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    disabled={pending}
                    aria-label="Delete saved prompt"
                    onClick={() =>
                      start(async () => {
                        await deleteCoordinationPrompt(s.id);
                        router.refresh();
                      })
                    }
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

export function ConfirmPendingPromptAction({
  proposedActionId,
  title,
}: {
  proposedActionId: string
  title: string
}) {
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <Button
      size="sm"
      disabled={pending}
      onClick={() =>
        start(async () => {
          await confirmPromptProposedAction(proposedActionId);
          router.refresh();
        })
      }
    >
      Confirm: {title}
    </Button>
  );
}
