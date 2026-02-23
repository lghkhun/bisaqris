import { prisma } from "@/lib/prisma";

function formatMoney(value) {
  return `Rp ${new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value || 0)}`;
}

export default async function AdminTransactionsPage() {
  const transactions = await prisma.transaction.findMany({
    orderBy: { createdAt: "desc" },
    take: 300,
    include: {
      project: {
        select: {
          name: true,
          user: { select: { email: true } },
        },
      },
    },
  });

  return (
    <div className="stack">
      <h1>Transactions</h1>
      <div className="card">
        <table>
          <thead>
            <tr>
              <th>Transaction ID</th>
              <th>Date</th>
              <th>Project</th>
              <th>User</th>
              <th>Method</th>
              <th>Status</th>
              <th>Amount</th>
              <th>Fee</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            {transactions.map((item) => (
              <tr key={item.id}>
                <td>{item.id}</td>
                <td>{item.createdAt.toLocaleString("en-GB")}</td>
                <td>{item.project?.name || "-"}</td>
                <td>{item.project?.user?.email || "-"}</td>
                <td>{item.method}</td>
                <td>{item.status}</td>
                <td>{formatMoney(item.amount)}</td>
                <td>{formatMoney(item.fee || 0)}</td>
                <td>{formatMoney(item.totalPayment || item.amount)}</td>
              </tr>
            ))}
            {transactions.length === 0 ? (
              <tr>
                <td colSpan={9} className="muted">
                  No transactions found.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}

