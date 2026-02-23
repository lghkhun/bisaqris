import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getProjectBalanceSummary, isWithdrawalModelReady } from "@/lib/balance";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import WithdrawModal from "./WithdrawModal";

function formatMoney(value) {
  return `Rp ${new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value || 0)}`;
}

export default async function WithdrawPage({ searchParams }) {
  const session = await requireSession();
  const query = (await searchParams) || {};
  const cookieStore = await cookies();
  const selectedProjectId = cookieStore.get("active_project_id")?.value;

  const projects = await prisma.project.findMany({
    where: { userId: session.userId },
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true },
  });
  const activeProject = projects.find((project) => project.id === selectedProjectId) || projects[0] || null;

  if (!activeProject) {
    return (
      <div className="stack">
        <h1>Withdraw</h1>
        <div className="card muted">No project found. Create your first project first.</div>
      </div>
    );
  }

  if (!selectedProjectId || selectedProjectId !== activeProject.id) {
    cookieStore.set("active_project_id", activeProject.id, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });
    redirect("/dashboard/withdraw");
  }

  const [withdrawals, balance] = await Promise.all([
    isWithdrawalModelReady()
      ? prisma.withdrawal.findMany({
          where: { projectId: activeProject.id },
          orderBy: { createdAt: "desc" },
          take: 50,
        })
      : Promise.resolve([]),
    getProjectBalanceSummary(activeProject.id),
  ]);

  return (
    <div className="stack">
      <div className="page-head">
        <h1>Withdraw</h1>
        <WithdrawModal projectId={activeProject.id} withdrawableBalance={balance.withdrawableBalance} />
      </div>

      {query?.success ? <div className="alert">Success: {query.success}</div> : null}
      {query?.error ? <div className="alert">Error: {query.error}</div> : null}
      {!isWithdrawalModelReady() ? (
        <div className="alert">
          Withdrawal storage is not ready in this runtime. Run Prisma migration and regenerate client,
          then restart the server.
        </div>
      ) : null}

      <div className="card">
        <table>
          <thead>
            <tr>
              <th>Withdrawal ID</th>
              <th>Date</th>
              <th>Gross</th>
              <th>Fee</th>
              <th>Net</th>
              <th>Status</th>
              <th>Payout Account</th>
            </tr>
          </thead>
          <tbody>
            {withdrawals.map((item) => (
              <tr key={item.id}>
                <td>{item.id}</td>
                <td>{item.createdAt.toLocaleString("en-GB")}</td>
                <td>{formatMoney(item.amountGross)}</td>
                <td>{formatMoney(item.amountFee)}</td>
                <td>{formatMoney(item.amountNet)}</td>
                <td>{item.status}</td>
                <td>
                  {[item.payoutBankName, item.payoutAccountName, item.payoutAccountNumber]
                    .filter(Boolean)
                    .join(" / ") || "-"}
                </td>
              </tr>
            ))}
            {withdrawals.length === 0 ? (
              <tr>
                <td colSpan={7} className="muted">
                  No withdrawal transactions yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
