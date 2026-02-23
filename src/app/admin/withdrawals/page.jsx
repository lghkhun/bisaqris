import { adminUpdateWithdrawalStatusAction } from "@/lib/actions";
import { isWithdrawalModelReady } from "@/lib/balance";
import { prisma } from "@/lib/prisma";

function formatMoney(value) {
  return `Rp ${new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value || 0)}`;
}

export default async function AdminWithdrawalsPage({ searchParams }) {
  const query = (await searchParams) || {};
  const modelReady = isWithdrawalModelReady();
  const withdrawals = modelReady
    ? await prisma.withdrawal.findMany({
        orderBy: { createdAt: "desc" },
        take: 200,
        include: {
          project: {
            select: {
              name: true,
              user: { select: { email: true } },
            },
          },
        },
      })
    : [];

  return (
    <div className="stack">
      <h1>Withdrawals</h1>
      {query?.success ? <div className="alert">Success: {query.success}</div> : null}
      {query?.error ? <div className="alert">Error: {query.error}</div> : null}
      {!modelReady ? (
        <div className="alert">
          Withdrawal model is not ready in this runtime. Run migration and regenerate Prisma client.
        </div>
      ) : null}
      <div className="card">
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Date</th>
              <th>Project</th>
              <th>User</th>
              <th>Gross</th>
              <th>Fee</th>
              <th>Net</th>
              <th>Status</th>
              <th>Payout Account</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {withdrawals.map((item) => (
              <tr key={item.id}>
                <td>{item.id}</td>
                <td>{item.createdAt.toLocaleString("en-GB")}</td>
                <td>{item.project?.name || "-"}</td>
                <td>{item.project?.user?.email || "-"}</td>
                <td>{formatMoney(item.amountGross)}</td>
                <td>{formatMoney(item.amountFee)}</td>
                <td>{formatMoney(item.amountNet)}</td>
                <td>{item.status}</td>
                <td>
                  {[item.payoutBankName, item.payoutAccountName, item.payoutAccountNumber]
                    .filter(Boolean)
                    .join(" / ") || "-"}
                </td>
                <td>
                  <form action={adminUpdateWithdrawalStatusAction} className="admin-inline-form">
                    <input type="hidden" name="withdrawalId" value={item.id} />
                    <select name="status" defaultValue={item.status}>
                      <option value="pending">pending</option>
                      <option value="processing">processing</option>
                      <option value="completed">completed</option>
                      <option value="rejected">rejected</option>
                    </select>
                    <button type="submit">Update</button>
                  </form>
                </td>
              </tr>
            ))}
            {withdrawals.length === 0 ? (
              <tr>
                <td colSpan={10} className="muted">
                  No withdrawal requests.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}

