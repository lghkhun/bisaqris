import { prisma } from "@/lib/prisma";

const DAY_MS = 24 * 60 * 60 * 1000;

export function isWithdrawalModelReady() {
  return Boolean(prisma?.withdrawal && typeof prisma.withdrawal.findMany === "function");
}

export async function getProjectBalanceSummary(projectId) {
  const paidTransactions = await prisma.transaction.findMany({
    where: { projectId, status: "paid" },
    select: { totalPayment: true, amount: true, fee: true, paidAt: true, createdAt: true },
  });

  const withdrawRequests = isWithdrawalModelReady()
    ? await prisma.withdrawal.findMany({
        where: { projectId, status: { in: ["pending", "processing", "completed"] } },
        select: { amountGross: true },
      })
    : [];

  const cutoff = new Date(Date.now() - DAY_MS);
  let totalBalance = 0;
  let eligibleBalance = 0;
  for (const tx of paidTransactions) {
    const gross = tx.totalPayment ?? tx.amount ?? 0;
    const net = Math.max(0, gross - (tx.fee || 0));
    totalBalance += net;
    if ((tx.paidAt || tx.createdAt) <= cutoff) {
      eligibleBalance += net;
    }
  }

  const reserved = withdrawRequests.reduce((acc, item) => acc + (item.amountGross || 0), 0);
  const withdrawableBalance = Math.max(0, eligibleBalance - reserved);

  return {
    totalBalance,
    withdrawableBalance,
  };
}
