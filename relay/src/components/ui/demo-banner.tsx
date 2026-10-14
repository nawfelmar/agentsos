import { integrationLabel } from "@/lib/demo";
import { Badge } from "./badge";

export function DemoBanner({ kinds = ["av", "calendar", "llm"] as const }: { kinds?: readonly ("av" | "calendar" | "llm")[] }) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-relay border border-line bg-surface-2/80 px-3 py-2 text-xs text-muted">
      <Badge tone="accent">Demo integrations</Badge>
      <span>External systems use honest adapters when credentials are missing:</span>
      {kinds.map((k) => (
        <Badge key={k} tone="muted">
          {integrationLabel(k)}
        </Badge>
      ))}
    </div>
  );
}
