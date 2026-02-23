import { isWithdrawalModelReady } from "@/lib/balance";
import { splitFeeRevenue } from "@/lib/fee";
import { getPlatformConfig } from "@/lib/platform-config";
import { prisma } from "@/lib/prisma";

function formatMoney(value) {
  return `Rp ${new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value || 0)}`;
}

export default async function AdminPage() {
  const [usersCount, projectsCount, transactionsCount, paidTransactions, feeConfig] = await Promise.all([
    prisma.user.count(),
    prisma.project.count(),
    prisma.transaction.count(),
    prisma.transaction.findMany({
      where: { status: "paid" },
      select: { totalPayment: true, amount: true, fee: true },
    }),
    getPlatformConfig(),
  ]);

  const grossVolume = paidTransactions.reduce((sum, tx) => sum + (tx.totalPayment ?? tx.amount ?? 0), 0);
  const pakasirProfit = paidTransactions.reduce((sum, tx) => {
    const split = splitFeeRevenue(tx.fee || 0, feeConfig.platformFee || 0);
    return sum + split.providerShare;
  }, 0);
  const platformProfit = paidTransactions.reduce((sum, tx) => {
    const split = splitFeeRevenue(tx.fee || 0, feeConfig.platformFee || 0);
    return sum + split.platformShare;
  }, 0);
  const pendingWithdrawals = isWithdrawalModelReady()
    ? await prisma.withdrawal.count({ where: { status: { in: ["pending", "processing"] } } })
    : 0;

  return (
    <div className="stack">
      <h1>Platform Overview</h1>
      <div className="grid grid-2">
        <div className="card">
          <strong>{usersCount}</strong>
          <div className="muted">Total Users</div>
        </div>
        <div className="card">
          <strong>{projectsCount}</strong>
          <div className="muted">Total Projects</div>
        </div>
        <div className="card">
          <strong>{transactionsCount}</strong>
          <div className="muted">Total Transactions</div>
        </div>
        <div className="card">
          <strong>{pendingWithdrawals}</strong>
          <div className="muted">Pending Withdrawals</div>
        </div>
      </div>
      <div className="grid grid-2">
        <div className="card">
          <strong>{formatMoney(grossVolume)}</strong>
          <div className="muted">Gross Paid Volume</div>
        </div>
        <div className="card">
          <strong>{formatMoney(pakasirProfit)}</strong>
          <div className="muted">Pakasir Revenue</div>
        </div>
      </div>
      <div className="grid grid-2">
        <div className="card">
          <strong>{formatMoney(platformProfit)}</strong>
          <div className="muted">Platform Revenue</div>
        </div>
        <div className="card">
          <strong>{formatMoney(pakasirProfit + platformProfit)}</strong>
          <div className="muted">Total Fee Collected</div>
        </div>
      </div>
    </div>
  );
}
