import { hashApiKey } from "@/lib/api-key";
import { prisma } from "@/lib/prisma";

function readBearerToken(request) {
  const auth = request.headers.get("authorization") || "";
  const [type, token] = auth.split(" ");
  if (type?.toLowerCase() !== "bearer" || !token) return null;
  return token.trim();
}

export async function authenticateMerchantRequest(request) {
  const rawKey = readBearerToken(request);
  if (!rawKey) return null;

  const keyHash = hashApiKey(rawKey);
  const apiKey = await prisma.apiKey.findFirst({
    where: {
      keyHash,
      revokedAt: null,
      project: { isActive: true },
    },
    include: {
      project: {
        select: { id: true, userId: true, name: true, webhookUrl: true, appSlug: true },
      },
    },
  });
  if (!apiKey) return null;

  await prisma.apiKey.update({
    where: { id: apiKey.id },
    data: { lastUsedAt: new Date() },
    select: { id: true },
  });

  return {
    project: apiKey.project,
  };
}
