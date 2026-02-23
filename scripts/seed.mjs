import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function hashApiKey(key) {
  return crypto.createHash("sha256").update(key).digest("hex");
}

function getApiKeyPrefix(key) {
  return key.slice(0, 15);
}

async function main() {
  const email = process.env.SEED_EMAIL || "owner@paymvp.com";
  const name = process.env.SEED_NAME || "Pay MVP Owner";
  const password = process.env.SEED_PASSWORD || "password123";
  const projectName = process.env.SEED_PROJECT_NAME || "Pay MVP Project";
  const projectSlug = process.env.SEED_PROJECT_SLUG || "paymvp-default";
  const webhookUrl = process.env.SEED_WEBHOOK_URL || "http://127.0.0.1:4020/webhook";
  const apiKeyRaw = process.env.SEED_API_KEY || "bq_live_seed_paymvp_local";

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.upsert({
    where: { email },
    update: { name, passwordHash },
    create: { name, email, passwordHash },
  });

  const project = await prisma.project.upsert({
    where: { appSlug: projectSlug },
    update: {
      userId: user.id,
      name: projectName,
      webhookUrl,
      isActive: true,
    },
    create: {
      userId: user.id,
      name: projectName,
      webhookUrl,
      appSlug: projectSlug,
      isActive: true,
    },
  });

  const keyHash = hashApiKey(apiKeyRaw);
  const existing = await prisma.apiKey.findFirst({
    where: { keyHash, projectId: project.id, revokedAt: null },
    select: { id: true },
  });

  if (!existing) {
    await prisma.apiKey.updateMany({
      where: { projectId: project.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    await prisma.apiKey.create({
      data: {
        projectId: project.id,
        keyHash,
        keyPrefix: getApiKeyPrefix(apiKeyRaw),
      },
    });
  }

  console.log("Seed completed.");
  console.log(
    JSON.stringify(
      {
        user: { email, password },
        project: { id: project.id, name: project.name, appSlug: project.appSlug, webhookUrl },
        api_key: apiKeyRaw,
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
