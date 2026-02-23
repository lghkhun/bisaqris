import Link from "next/link";
import { cookies } from "next/headers";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function TransactionsPage() {
  const session = await requireSession();
  const cookieStore = await cookies();
  const selectedProjectId = cookieStore.get("active_project_id")?.value;
  const activeProject = selectedProjectId
    ? await prisma.project.findFirst({
        where: { id: selectedProjectId, userId: session.userId },
        select: { id: true, name: true },
      })
    : null;

  const transactions = await prisma.transaction.findMany({
    where: {
      project: {
        userId: session.userId,
        ...(activeProject?.id ? { id: activeProject.id } : {}),
      },
    },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: {
      id: true,
      method: true,
      status: true,
      amount: true,
      fee: true,
      createdAt: true,
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
              <th>Method</th>
              <th>Amount</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {transactions.map((item) => (
              <tr key={item.id}>
                <td>
                  <Link href={`/dashboard/transactions/${item.id}`}>{item.id}</Link>
                </td>
                <td>{item.createdAt.toLocaleString("en-GB")}</td>
                <td>{item.method}</td>
                <td>
                  {item.amount}{" "}
                  <span className="fee-cut">(-{item.fee || 0})</span>
                </td>
                <td>{item.status}</td>
              </tr>
            ))}
            {transactions.length === 0 ? (
              <tr>
                <td colSpan={5} className="muted">
                  No transactions yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
