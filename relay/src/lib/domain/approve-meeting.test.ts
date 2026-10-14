import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import { execSync } from "node:child_process";
import path from "node:path";
import { executeApproveProposedMeeting } from "./approve-meeting";

const prisma = new PrismaClient();
const cwd = path.join(process.cwd());

describe("approve proposed meeting workflow", () => {
  before(() => {
    execSync("npx tsx prisma/seed.ts", { cwd, stdio: "inherit" });
  });

  after(async () => {
    execSync("npx tsx prisma/seed.ts", { cwd, stdio: "inherit" });
    await prisma.$disconnect();
  });

  it("seeds a pending meeting proposal for the auth blocker", async () => {
    const action = await prisma.proposedAction.findUnique({
      where: { id: "action_approve_meeting" },
    });
    assert.ok(action);
    assert.equal(action!.status, "pending");
    assert.equal(action!.kind, "schedule_meeting");
  });

  it("schedules the meeting and writes decision, action item, and stakeholder update", async () => {
    const result = await executeApproveProposedMeeting("action_approve_meeting");
    assert.equal(result.ok, true);
    assert.equal(result.meetingId, "meeting_proposed_auth");

    const meeting = await prisma.meeting.findUnique({ where: { id: "meeting_proposed_auth" } });
    assert.equal(meeting?.status, "scheduled");

    const action = await prisma.proposedAction.findUnique({
      where: { id: "action_approve_meeting" },
    });
    assert.equal(action?.status, "approved");

    const decisions = await prisma.decision.findMany({
      where: { meetingId: "meeting_proposed_auth" },
    });
    assert.ok(decisions.length >= 1);

    const items = await prisma.actionItem.findMany({
      where: { meetingId: "meeting_proposed_auth" },
    });
    assert.ok(items.length >= 1);

    const updates = await prisma.stakeholderUpdate.findMany({
      where: { runId: "run_auth_blocker", status: "sent" },
    });
    assert.ok(updates.length >= 1);

    const blocker = await prisma.blocker.findUnique({ where: { id: "blocker_auth_sdk" } });
    assert.equal(blocker?.status, "resolving");
  });
});
