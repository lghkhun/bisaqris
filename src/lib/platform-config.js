import { prisma } from "@/lib/prisma";

const CONFIG_ID = 1;

export function isPlatformConfigReady() {
  return Boolean(prisma?.platformConfig && typeof prisma.platformConfig.upsert === "function");
}

export async function getPlatformConfig() {
  if (!isPlatformConfigReady()) {
    return { id: CONFIG_ID, platformFee: 0, pakasirFee: 0 };
  }

  return prisma.platformConfig.upsert({
    where: { id: CONFIG_ID },
    create: { id: CONFIG_ID, platformFee: 0, pakasirFee: 0 },
    update: {},
  });
}
