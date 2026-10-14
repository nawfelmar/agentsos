"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  approveProposedMeeting,
  pauseCoordinationRun,
  rejectProposedMeeting,
  resumeCoordinationRun,
  runClarification,
} from "@/lib/actions/coordination";

export function RunActions({
  runId,
  status,
  proposedActionId,
  blockerId,
}: {
  runId: string
  status: string
  proposedActionId?: string
  blockerId?: string | null
}) {
  const [pending, start] = useTransition();
  const router = useRouter();

  return (
    <div className="flex flex-wrap gap-2">
      {proposedActionId && (
        <>
          <Button
            disabled={pending}
            onClick={() =>
              start(async () => {
                await approveProposedMeeting(proposedActionId);
                router.push(`/coordination/${runId}?approved=1`);
                router.refresh();
              })
            }
          >
            Approve meeting
          </Button>
          <Button
            variant="secondary"
            disabled={pending}
            onClick={() =>
              start(async () => {
                await rejectProposedMeeting(proposedActionId, "Prefer async");
                router.refresh();
              })
            }
          >
            Reject
          </Button>
        </>
      )}
      {status === "active" ? (
        <Button
          variant="ghost"
          disabled={pending}
          onClick={() =>
            start(async () => {
              await pauseCoordinationRun(runId);
              router.refresh();
            })
          }
        >
          Pause automation
        </Button>
      ) : (
        <Button
          variant="ghost"
          disabled={pending}
          onClick={() =>
            start(async () => {
              await resumeCoordinationRun(runId);
              router.refresh();
            })
          }
        >
          Resume
        </Button>
      )}
      {blockerId && (
        <Button
          variant="secondary"
          disabled={pending}
          onClick={() =>
            start(async () => {
              await runClarification(blockerId);
              router.refresh();
            })
          }
        >
          Re-run AI clarification
        </Button>
      )}
    </div>
  );
}
