import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";

export function hashPayload(payload) {
  return crypto.createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

export async function initIdempotency({ projectId, key, requestHash }) {
  try {
    const created = await prisma.idempotencyKey.create({
      data: {
        projectId,
        key,
        requestHash,
      },
      select: { id: true, requestHash: true, responseStatus: true, responseBody: true },
    });
    return { kind: "new", record: created };
  } catch (error) {
    if (error?.code !== "P2002") throw error;
  }

  const existing = await prisma.idempotencyKey.findUnique({
    where: {
      projectId_key: {
        projectId,
        key,
      },
    },
    select: { id: true, requestHash: true, responseStatus: true, responseBody: true },
  });
  if (!existing) return { kind: "retry_unknown" };
  if (existing.requestHash !== requestHash) return { kind: "conflict" };
  if (existing.responseStatus && existing.responseBody) return { kind: "replay", record: existing };
  return { kind: "in_progress" };
}

export async function storeIdempotencyResponse({ recordId, status, body }) {
  await prisma.idempotencyKey.update({
    where: { id: recordId },
    data: {
      responseStatus: status,
      responseBody: body,
    },
    select: { id: true },
  });
}
