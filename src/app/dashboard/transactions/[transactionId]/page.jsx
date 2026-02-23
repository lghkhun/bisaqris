import { notFound } from "next/navigation";
import { syncTransactionStatusAction } from "@/lib/actions";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function TransactionDetailPage({ params, searchParams }) {
  const session = await requireSession();
  const { transactionId } = await params;
  const query = await searchParams;

  const transaction = await prisma.transaction.findFirst({
    where: {
      id: transactionId,
      project: { userId: session.userId },
    },
    include: { project: { select: { id: true, name: true } } },
  });
  if (!transaction) notFound();

  return (
    <div className="stack">
      <h1>Transaction Detail</h1>
      {query?.success ? <div className="alert">Success: {query.success}</div> : null}
      {query?.error ? <div className="alert">Error: {query.error}</div> : null}

      <div className="card stack">
        <div>
          <strong>ID</strong>
          <div className="muted">{transaction.id}</div>
        </div>
        <div>
          <strong>External ID</strong>
          <div className="muted">{transaction.externalId}</div>
        </div>
        <div>
          <strong>Gateway Order ID</strong>
          <div className="muted">{transaction.gatewayOrderId}</div>
        </div>
        <div>
          <strong>Project</strong>
          <div className="muted">{transaction.project.name}</div>
        </div>
        <div>
          <strong>Method / Status</strong>
          <div className="muted">
            {transaction.method} / {transaction.status}
          </div>
        </div>
        <div>
          <strong>Amount / Fee / Total</strong>
          <div className="muted">
            {transaction.amount} / {transaction.fee || 0} / {transaction.totalPayment || transaction.amount}
          </div>
        </div>
        <div>
          <strong>Payment Number</strong>
          <div className="muted">{transaction.paymentNumber || "-"}</div>
        </div>
        <div>
          <strong>Paid At</strong>
          <div className="muted">{transaction.paidAt?.toISOString() || "-"}</div>
        </div>
        <form action={syncTransactionStatusAction}>
          <input type="hidden" name="transactionId" value={transaction.id} />
          <button type="submit">Sync From Gateway</button>
        </form>
      </div>

      <div className="card stack">
        <strong>Gateway Raw</strong>
        <pre style={{ margin: 0, overflowX: "auto", fontSize: 12 }}>
          {JSON.stringify(transaction.gatewayRaw || {}, null, 2)}
        </pre>
      </div>
    </div>
  );
}
