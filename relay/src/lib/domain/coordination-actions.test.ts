import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { interpretPromptDemo } from "./coordination-actions";

describe("interpretPromptDemo", () => {
  it("maps approve meeting prompts", () => {
    const a = interpretPromptDemo("Approve the pending meeting for the auth-sdk blocker");
    assert.equal(a.kind, "approve_pending");
    assert.ok(a.confidence >= 0.8);
  });

  it("maps escalate prompts", () => {
    const a = interpretPromptDemo("Escalate this to Priya and draft a management update");
    assert.equal(a.kind, "escalate");
    assert.equal(a.payload.recipient, "Priya Nair");
  });

  it("maps pause prompts", () => {
    const a = interpretPromptDemo("Pause automation on this run until OPS-1842 lands");
    assert.equal(a.kind, "pause_run");
  });

  it("maps schedule meeting prompts", () => {
    const a = interpretPromptDemo("Propose a 25-minute sync with Maya, Nina, and Jordan");
    assert.equal(a.kind, "schedule_meeting");
  });

  it("always returns an executable kind for freeform text", () => {
    const a = interpretPromptDemo("Figure out what to do about the registry");
    assert.ok(a.kind);
    assert.ok(a.title);
  });
});
