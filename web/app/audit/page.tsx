"use client";

import { Suspense } from "react";
import AuditClient from "./AuditClient";

export default function AuditPage() {
  return (
    <Suspense fallback={<p className="lede">Loading audit…</p>}>
      <AuditClient />
    </Suspense>
  );
}
