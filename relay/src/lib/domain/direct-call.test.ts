import { describe, it, after } from "node:test";
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

describe("direct 1:1 calls", () => {
  const created: string[] = [];

  after(async () => {
    if (created.length) {
      await prisma.directCall.deleteMany({ where: { id: { in: created } } });
    }
    await prisma.$disconnect();
  });

  it("stores a DirectCall between caller and callee", async () => {
    const me = await prisma.user.findFirst({ where: { isCurrentUser: true } });
    const other = await prisma.user.findFirst({
      where: { isCurrentUser: false },
    });
    assert.ok(me && other, "seeded users required — run npm run db:seed");

    const call = await prisma.directCall.create({
      data: {
        organizationId: me!.organizationId,
        callerId: me!.id,
        calleeId: other!.id,
        status: "active",
        answeredAt: new Date(),
      },
    });
    created.push(call.id);

    assert.equal(call.callerId, me!.id);
    assert.equal(call.calleeId, other!.id);
    assert.equal(call.status, "active");

    const open = await prisma.directCall.findFirst({
      where: {
        id: call.id,
        status: { in: ["ringing", "active"] },
        OR: [{ callerId: me!.id }, { calleeId: me!.id }],
      },
    });
    assert.ok(open);
  });
});
