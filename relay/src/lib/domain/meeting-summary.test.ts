import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildDemoMeetingSummary } from "./meeting-summary";

describe("buildDemoMeetingSummary", () => {
  it("returns a scannable structured summary with TL;DR and owners", () => {
    const summary = buildDemoMeetingSummary({
      title: "Unblock auth-sdk for Checkout RC",
      purpose: "Decide mock vs wait",
      agenda: [{ item: "ETA", owner: "Maya" }],
      participants: ["Maya Chen", "Nina Volkov", "Jordan Lee"],
      existingDecisions: [],
      existingActions: [],
      relatedBlocker: { title: "auth-sdk missing", status: "investigating" },
      isAiProposed: true,
    });

    assert.ok(summary.tldr.length > 10);
    assert.ok(summary.decisions.length >= 1);
    assert.ok(summary.actionItems.every((a) => a.owner));
    assert.ok(summary.audienceNotes.engineering);
    assert.ok(summary.audienceNotes.product);
    assert.ok(summary.audienceNotes.management);
  });
});
