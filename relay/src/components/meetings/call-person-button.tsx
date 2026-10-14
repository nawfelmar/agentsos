"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { callPersonIntoMeeting } from "@/lib/actions/live-meeting";

/** Call control shown next to a person — only render while a meeting is live. */
export function CallPersonButton({
  meetingId,
  userId,
  name,
  alreadyInCall = false,
  size = "sm",
}: {
  meetingId: string
  userId: string
  name: string
  alreadyInCall?: boolean
  size?: "sm" | "icon"
}) {
  const [pending, start] = useTransition();
  const [label, setLabel] = useState<"Call" | "Ringing…" | "In call">(
    alreadyInCall ? "In call" : "Call"
  );
  const router = useRouter();

  if (alreadyInCall || label === "In call") {
    return (
      <Button size={size} variant="secondary" disabled title={`${name} is already in the call`}>
        <Phone className="h-3 w-3" />
        {size !== "icon" && "In call"}
      </Button>
    );
  }

  return (
    <Button
      size={size}
      variant="primary"
      disabled={pending}
      title={`Call ${name} into the live meeting`}
      onClick={() =>
        start(async () => {
          setLabel("Ringing…");
          await callPersonIntoMeeting(meetingId, userId);
          setLabel("In call");
          router.refresh();
        })
      }
    >
      <Phone className="h-3 w-3" />
      {size !== "icon" && label}
    </Button>
  );
}
