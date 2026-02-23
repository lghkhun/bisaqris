"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { clearSession, requireSession, setSession } from "@/lib/auth";
import { requireAdminSession } from "@/lib/admin-auth";
import { getProjectBalanceSummary, isWithdrawalModelReady } from "@/lib/balance";
import { generateRawApiKey, getApiKeyPrefix, hashApiKey } from "@/lib/api-key";
import { getPlatformConfig, isPlatformConfigReady } from "@/lib/platform-config";
import { prisma } from "@/lib/prisma";
import { syncTransactionWithGateway } from "@/lib/transaction-sync";

const registerSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

const projectSchema = z.object({
  name: z.string().min(2),
  appSlug: z
    .string()
    .min(3)
    .regex(/^[a-z0-9-]+$/)
    .optional()
    .or(z.literal("")),
  webhookUrl: z.string().url(),
  logoUrl: z.string().url().optional().or(z.literal("")),
  payoutBankName: z.string().max(100).optional().or(z.literal("")),
  payoutAccountName: z.string().max(100).optional().or(z.literal("")),
  payoutAccountNumber: z.string().max(50).optional().or(z.literal("")),
});

const withdrawSchema = z.object({
  amount: z.coerce.number().int().positive(),
});

const adminWithdrawalStatusSchema = z.object({
  withdrawalId: z.string().min(1),
  status: z.enum(["pending", "processing", "completed", "rejected"]),
});

const adminFeeSchema = z.object({
  platformFee: z.coerce.number().int().min(0),
});

function parseFormData(formData) {
  return Object.fromEntries(formData.entries());
}

function toBaseSlug(value) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

async function generateUniqueSlug(base) {
  const seed = base || `project-${Math.random().toString(36).slice(2, 8)}`;
  let slug = seed;
  let counter = 1;

  // Keep checking until slug is unique.
  // This is simple and safe for MVP.
  while (true) {
    const found = await prisma.project.findUnique({
      where: { appSlug: slug },
      select: { id: true },
    });
    if (!found) return slug;
    counter += 1;
    slug = `${seed}-${counter}`;
  }
}

export async function registerAction(formData) {
  const parsed = registerSchema.safeParse(parseFormData(formData));
  if (!parsed.success) {
    redirect("/register?error=invalid_input");
  }

  const exists = await prisma.user.findUnique({
    where: { email: parsed.data.email.toLowerCase() },
    select: { id: true },
  });
  if (exists) redirect("/register?error=email_exists");

  const passwordHash = await bcrypt.hash(parsed.data.password, 10);
  const user = await prisma.user.create({
    data: {
      name: parsed.data.name,
      email: parsed.data.email.toLowerCase(),
      passwordHash,
    },
    select: { id: true, email: true },
  });

  await setSession(user);
  redirect("/dashboard");
}

export async function loginAction(formData) {
  const parsed = loginSchema.safeParse(parseFormData(formData));
  if (!parsed.success) redirect("/login?error=invalid_input");

  const user = await prisma.user.findUnique({
    where: { email: parsed.data.email.toLowerCase() },
    select: { id: true, email: true, passwordHash: true },
  });
  if (!user) redirect("/login?error=invalid_credentials");

  const ok = await bcrypt.compare(parsed.data.password, user.passwordHash);
  if (!ok) redirect("/login?error=invalid_credentials");

  await setSession(user);
  redirect("/dashboard");
}

export async function logoutAction() {
  await clearSession();
  redirect("/login");
}

export async function createProjectAction(formData) {
  const session = await requireSession();
  const parsed = projectSchema.safeParse(parseFormData(formData));
  if (!parsed.success) redirect("/dashboard/projects?error=invalid_input");
  const redirectTo = String(formData.get("redirectTo") || "/dashboard/settings");

  const providedSlug = parsed.data.appSlug || "";
  const finalSlug = providedSlug
    ? await generateUniqueSlug(toBaseSlug(providedSlug))
    : await generateUniqueSlug(toBaseSlug(parsed.data.name));

  const rawKey = generateRawApiKey();
  const keyHash = hashApiKey(rawKey);
  const keyPrefix = getApiKeyPrefix(rawKey);

  const project = await prisma.project.create({
    data: {
      userId: session.userId,
      name: parsed.data.name,
      appSlug: finalSlug,
      webhookUrl: parsed.data.webhookUrl,
      logoUrl: parsed.data.logoUrl || null,
      payoutBankName: parsed.data.payoutBankName || null,
      payoutAccountName: parsed.data.payoutAccountName || null,
      payoutAccountNumber: parsed.data.payoutAccountNumber || null,
      apiKeys: {
        create: {
          keyHash,
          keyPrefix,
        },
      },
    },
    select: { id: true },
  });

  revalidatePath("/dashboard/projects");
  revalidatePath("/dashboard/settings");
  redirect(`${redirectTo}?newKey=${encodeURIComponent(rawKey)}`);
}

export async function updateProjectAction(formData) {
  const session = await requireSession();
  const projectId = String(formData.get("projectId") || "");
  const parsed = projectSchema.safeParse(parseFormData(formData));
  if (!parsed.success) redirect(`/dashboard/settings?error=invalid_input`);

  const owned = await prisma.project.findFirst({
    where: { id: projectId, userId: session.userId },
    select: { id: true },
  });
  if (!owned) redirect("/dashboard/settings?error=not_found");

  const desiredSlugRaw = parsed.data.appSlug || parsed.data.name;
  const desiredSlug = toBaseSlug(desiredSlugRaw);
  if (!desiredSlug) redirect("/dashboard/settings?error=invalid_slug");

  const taken = await prisma.project.findFirst({
    where: {
      appSlug: desiredSlug,
      NOT: { id: projectId },
    },
    select: { id: true },
  });
  if (taken) redirect("/dashboard/settings?error=slug_taken");

  await prisma.project.update({
    where: { id: projectId },
    data: {
      name: parsed.data.name,
      appSlug: desiredSlug,
      webhookUrl: parsed.data.webhookUrl,
      logoUrl: parsed.data.logoUrl || null,
      payoutBankName: parsed.data.payoutBankName || null,
      payoutAccountName: parsed.data.payoutAccountName || null,
      payoutAccountNumber: parsed.data.payoutAccountNumber || null,
    },
  });

  revalidatePath("/dashboard/settings");
  revalidatePath(`/dashboard/projects/${projectId}`);
  redirect("/dashboard/settings?success=updated");
}

export async function regenerateApiKeyAction(formData) {
  const session = await requireSession();
  const projectId = String(formData.get("projectId") || "");
  const redirectTo = String(formData.get("redirectTo") || "/dashboard/settings");

  const owned = await prisma.project.findFirst({
    where: { id: projectId, userId: session.userId },
    select: { id: true },
  });
  if (!owned) redirect("/dashboard/settings?error=not_found");

  const rawKey = generateRawApiKey();
  const keyHash = hashApiKey(rawKey);
  const keyPrefix = getApiKeyPrefix(rawKey);

  await prisma.$transaction([
    prisma.apiKey.updateMany({
      where: { projectId, revokedAt: null },
      data: { revokedAt: new Date() },
    }),
    prisma.apiKey.create({
      data: {
        projectId,
        keyHash,
        keyPrefix,
      },
    }),
  ]);

  revalidatePath("/dashboard/settings");
  revalidatePath(`/dashboard/projects/${projectId}`);
  redirect(`${redirectTo}?newKey=${encodeURIComponent(rawKey)}`);
}

export async function deleteProjectAction(formData) {
  const session = await requireSession();
  const projectId = String(formData.get("projectId") || "");

  const owned = await prisma.project.findFirst({
    where: { id: projectId, userId: session.userId },
    select: { id: true },
  });
  if (!owned) redirect("/dashboard/projects?error=not_found");

  const cookieStore = await cookies();
  if (cookieStore.get("active_project_id")?.value === projectId) {
    cookieStore.delete("active_project_id");
  }

  await prisma.project.delete({ where: { id: projectId } });
  revalidatePath("/dashboard/projects");
  redirect("/dashboard/projects?success=deleted");
}

export async function switchActiveProjectAction(formData) {
  const session = await requireSession();
  const projectId = String(formData.get("projectId") || "");
  const redirectTo = String(formData.get("redirectTo") || "/dashboard");

  if (!projectId) {
    const cookieStore = await cookies();
    cookieStore.delete("active_project_id");
    redirect(redirectTo);
  }

  const project = await prisma.project.findFirst({
    where: { id: projectId, userId: session.userId },
    select: { id: true },
  });
  if (!project) redirect("/dashboard/projects?error=not_found");

  const cookieStore = await cookies();
  cookieStore.set("active_project_id", projectId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });

  redirect(redirectTo);
}

export async function syncTransactionStatusAction(formData) {
  const session = await requireSession();
  const transactionId = String(formData.get("transactionId") || "");
  if (!transactionId) redirect("/dashboard/transactions?error=missing_transaction");

  const own = await prisma.transaction.findFirst({
    where: { id: transactionId, project: { userId: session.userId } },
    select: { id: true },
  });
  if (!own) redirect("/dashboard/transactions?error=not_found");

  try {
    await syncTransactionWithGateway(transactionId);
  } catch {
    redirect(`/dashboard/transactions/${transactionId}?error=sync_failed`);
  }

  revalidatePath("/dashboard/transactions");
  revalidatePath(`/dashboard/transactions/${transactionId}`);
  redirect(`/dashboard/transactions/${transactionId}?success=synced`);
}

export async function createWithdrawalAction(formData) {
  if (!isWithdrawalModelReady()) {
    redirect("/dashboard/withdraw?error=withdrawal_model_not_ready");
  }

  const session = await requireSession();
  const projectId = String(formData.get("projectId") || "");
  const parsed = withdrawSchema.safeParse({ amount: formData.get("amount") });
  if (!parsed.success) redirect("/dashboard/withdraw?error=invalid_amount");

  const project = await prisma.project.findFirst({
    where: { id: projectId, userId: session.userId },
    select: {
      id: true,
      payoutBankName: true,
      payoutAccountName: true,
      payoutAccountNumber: true,
    },
  });
  if (!project) redirect("/dashboard/withdraw?error=project_not_found");
  if (!project.payoutBankName || !project.payoutAccountName || !project.payoutAccountNumber) {
    redirect("/dashboard/withdraw?error=payout_account_not_set");
  }

  const MIN_WITHDRAW = 100000;
  const FEE = 2500;
  const amountGross = parsed.data.amount;

  if (amountGross < MIN_WITHDRAW) redirect("/dashboard/withdraw?error=min_withdraw_100000");
  if (amountGross <= FEE) redirect("/dashboard/withdraw?error=amount_too_small");

  const { withdrawableBalance } = await getProjectBalanceSummary(project.id);
  if (amountGross > withdrawableBalance) {
    redirect("/dashboard/withdraw?error=insufficient_withdrawable_balance");
  }

  await prisma.withdrawal.create({
    data: {
      projectId: project.id,
      status: "pending",
      amountGross,
      amountFee: FEE,
      amountNet: amountGross - FEE,
      payoutBankName: project.payoutBankName,
      payoutAccountName: project.payoutAccountName,
      payoutAccountNumber: project.payoutAccountNumber,
      note: "Withdrawal request created from dashboard",
    },
    select: { id: true },
  });

  revalidatePath("/dashboard/withdraw");
  revalidatePath("/dashboard");
  redirect("/dashboard/withdraw?success=withdraw_requested");
}

export async function adminUpdateWithdrawalStatusAction(formData) {
  if (!isWithdrawalModelReady()) {
    redirect("/admin/withdrawals?error=withdrawal_model_not_ready");
  }
  await requireAdminSession();

  const parsed = adminWithdrawalStatusSchema.safeParse({
    withdrawalId: formData.get("withdrawalId"),
    status: formData.get("status"),
  });
  if (!parsed.success) redirect("/admin/withdrawals?error=invalid_input");

  await prisma.withdrawal.update({
    where: { id: parsed.data.withdrawalId },
    data: {
      status: parsed.data.status,
      processedAt:
        parsed.data.status === "completed" || parsed.data.status === "rejected"
          ? new Date()
          : null,
    },
    select: { id: true },
  });

  revalidatePath("/admin/withdrawals");
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/withdraw");
  redirect("/admin/withdrawals?success=status_updated");
}

export async function adminUpdatePlatformFeeAction(formData) {
  await requireAdminSession();
  if (!isPlatformConfigReady()) {
    redirect("/admin/fees?error=platform_config_model_not_ready");
  }
  const parsed = adminFeeSchema.safeParse({
    platformFee: formData.get("platformFee"),
  });
  if (!parsed.success) redirect("/admin/fees?error=invalid_fee_input");

  const current = await getPlatformConfig();
  await prisma.platformConfig.update({
    where: { id: current.id },
    data: {
      platformFee: parsed.data.platformFee,
    },
    select: { id: true },
  });

  revalidatePath("/admin/fees");
  revalidatePath("/admin");
  revalidatePath("/dashboard");
  redirect("/admin/fees?success=fees_updated");
}
