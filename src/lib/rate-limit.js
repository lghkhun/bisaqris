import { prisma } from "@/lib/prisma";

function floorWindow(date, seconds) {
  const ms = seconds * 1000;
  const floored = Math.floor(date.getTime() / ms) * ms;
  return new Date(floored);
}

export async function enforceRateLimit({ projectId, routeKey, limit, windowSeconds = 60 }) {
  const now = new Date();
  const windowStart = floorWindow(now, windowSeconds);

  const row = await prisma.rateLimitWindow.upsert({
    where: {
      projectId_routeKey_windowStart: {
        projectId,
        routeKey,
        windowStart,
      },
    },
    create: {
      projectId,
      routeKey,
      windowStart,
      count: 1,
    },
    update: {
      count: { increment: 1 },
    },
    select: { count: true },
  });

  const allowed = row.count <= limit;
  const remaining = Math.max(limit - row.count, 0);
  const resetAt = Math.floor(windowStart.getTime() / 1000) + windowSeconds;

  return {
    allowed,
    headers: {
      "x-ratelimit-limit": String(limit),
      "x-ratelimit-remaining": String(remaining),
      "x-ratelimit-reset": String(resetAt),
    },
  };
}
