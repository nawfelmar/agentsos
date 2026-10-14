import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildDemoMeetingPositions } from "./meeting-positions";

describe("buildDemoMeetingPositions", () => {
  it("gives each speaker a plain-language position and stance", () => {
    const positions = buildDemoMeetingPositions({
      title: "Unblock auth-sdk",
      purpose: "Decide mock vs wait",
      participants: [
        { name: "Jordan Lee" },
        { name: "Maya Chen" },
        { name: "Nina Volkov" },
        { name: "Alex Rivera" },
      ],
      isAiProposed: true,
    });

    assert.ok(positions.highlights.length >= 3);
    for (const h of positions.highlights) {
      assert.ok(h.position.length > 8);
      assert.ok(h.highlight.length > 8);
      assert.ok(["for", "against", "conditional", "neutral", "questioning"].includes(h.stance));
    }
    assert.ok(positions.alignmentLabel.length > 5);
  });
});
