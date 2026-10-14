import { describe, it, before, after, mock } from "node:test";
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import { execSync } from "node:child_process";
import path from "node:path";

const prisma = new PrismaClient();
const cwd = path.join(process.cwd());

describe("direct 1:1 calls", () => {
  before(() => {
    // Avoid next/cache in server actions during node:test
    try {
      mock.module("next/cache", {
        namedExports: { revalidatePath: () => undefined },
      });
    } catch {
      // Node without experimental mock.module — seed only; action tests skipped below
    }
    execSync("npx tsx prisma/seed.ts", { cwd, stdio: "inherit" });
  });

  after(async () => {
    try {
      mock.restoreAll();
    } catch {
      /* noop */
    }
    execSync("npx tsx prisma/seed.ts", { cwd, stdio: "inherit" });
    await prisma.$disconnect();
  });

  it("creates a DirectCall between caller and callee", async () => {
    const me = await prisma.user.findFirst({ where: { isCurrentUser: true } });
    const other = await prisma.user.findFirst({
      where: { isCurrentUser: false },
    });
    assert.ok(me && other);

    const call = await prisma.directCall.create({
      data: {
        organizationId: me!.organizationId,
        callerId: me!.id,
        calleeId: other!.id,
        status: "active",
        answeredAt: new Date(),
      },
    });
    assert.equal(call.callerId, me!.id);
    assert.equal(call.calleeId, other!.id);
    assert.equal(call.status, "active");

    const open = await prisma.directCall.findFirst({
      where: {
        status: { in: ["ringing", "active"] },
        OR: [{ callerId: me!.id }, { calleeId: me!.id }],
      },
    });
    assert.ok(open);
  });
});
