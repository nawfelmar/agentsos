"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { startDirectCall } from "@/lib/actions/direct-call";
import { armCallAudio, startRelayRing } from "@/lib/call-sounds";

/** 1:1 Call next to a person — only render when the current user is free. */
export function CallPersonButton({
  userId,
  name,
  size = "sm",
}: {
  userId: string
  name: string
  size?: "sm" | "icon"
}) {
  const [pending, start] = useTransition();
  const router = useRouter();

  return (
    <Button
      size={size}
      variant="primary"
      disabled={pending}
      title={`Start a direct call with ${name}`}
      onClick={() =>
        start(async () => {
          await armCallAudio();
          void startRelayRing();
          const res = await startDirectCall(userId);
          router.push(`/calls/${res.id}`);
          router.refresh();
        })
      }
    >
      <Phone className="h-3 w-3" />
      {size !== "icon" && (pending ? "Calling…" : "Call")}
    </Button>
  );
}
