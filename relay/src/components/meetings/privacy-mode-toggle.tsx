"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Shield, ShieldOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { setMeetingPrivacyMode } from "@/lib/actions/meetings";
import { cn } from "@/lib/utils";

export function PrivacyModeToggle({
  meetingId,
  privacyMode,
}: {
  meetingId: string
  privacyMode: boolean
}) {
  const [pending, start] = useTransition();
  const router = useRouter();

  return (
    <div className="flex items-center gap-2">
      <Button
        type="button"
        size="sm"
        variant={privacyMode ? "success" : "secondary"}
        disabled={pending}
        aria-pressed={privacyMode}
        title={
          privacyMode
            ? "Privacy mode on — outcomes stay in this meeting"
            : "Turn on privacy mode so nothing is shared outside this meeting"
        }
        className={cn(
          privacyMode && "ring-1 ring-success/40",
          "min-w-[9.5rem] justify-start"
        )}
        onClick={() =>
          start(async () => {
            await setMeetingPrivacyMode(meetingId, !privacyMode);
            router.refresh();
          })
        }
      >
        {privacyMode ? (
          <Shield className="h-3.5 w-3.5" />
        ) : (
          <ShieldOff className="h-3.5 w-3.5" />
        )}
        {privacyMode ? "Privacy on" : "Privacy mode"}
      </Button>
      {privacyMode && (
        <span className="hidden text-[11px] text-success sm:inline">
          Nothing leaves this meeting
        </span>
      )}
    </div>
  );
}
