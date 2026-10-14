import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import { execSync } from "node:child_process";
import path from "node:path";
import { shouldSyncMeetingOutside } from "./meeting-privacy";

const prisma = new PrismaClient();
const cwd = path.join(process.cwd());

describe("meeting privacy mode", () => {
  before(() => {
    execSync("npx tsx prisma/seed.ts", { cwd, stdio: "inherit" });
  });

  after(async () => {
    execSync("npx tsx prisma/seed.ts", { cwd, stdio: "inherit" });
    await prisma.$disconnect();
  });

  it("blocks outside sync when privacy mode is on", () => {
    assert.equal(shouldSyncMeetingOutside(true), false);
    assert.equal(shouldSyncMeetingOutside(false), true);
  });

  it("persists privacyMode on meetings", async () => {
    const meeting = await prisma.meeting.findFirst({ where: { isAiProposed: true } });
    assert.ok(meeting);
    assert.equal(meeting!.privacyMode, false);

    await prisma.meeting.update({
      where: { id: meeting!.id },
      data: { privacyMode: true },
    });

    const updated = await prisma.meeting.findUnique({ where: { id: meeting!.id } });
    assert.equal(updated?.privacyMode, true);
    assert.equal(shouldSyncMeetingOutside(updated!.privacyMode), false);
  });
});
