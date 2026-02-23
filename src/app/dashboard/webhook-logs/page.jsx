import { cookies } from "next/headers";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function WebhookLogsPage() {
  const session = await requireSession();
  const cookieStore = await cookies();
  const selectedProjectId = cookieStore.get("active_project_id")?.value;
  const activeProject = selectedProjectId
    ? await prisma.project.findFirst({
        where: { id: selectedProjectId, userId: session.userId },
        select: { id: true, name: true },
      })
    : null;

  const logs = await prisma.webhookLog.findMany({
    where: {
      project: {
        userId: session.userId,
        ...(activeProject?.id ? { id: activeProject.id } : {}),
      },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: {
      transaction: {
        select: { id: true, externalId: true },
      },
      project: {
        select: { name: true },
      },
    },
  });

  return (
    <div className="stack">
      <h1>Webhook Logs</h1>
      <div className="card">
        <table>
          <thead>
            <tr>
              <th>Time</th>
              <th>Event</th>
              <th>Attempt</th>
              <th>Success</th>
              <th>Transaction</th>
              <th>Response</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log) => (
              <tr key={log.id}>
                <td>{log.createdAt.toISOString()}</td>
                <td>{log.eventType}</td>
                <td>{log.attemptNo}</td>
                <td>{log.isSuccess ? "Yes" : "No"}</td>
                <td>{log.transaction?.externalId || log.transactionId || "-"}</td>
                <td>{log.responseCode || "-"}</td>
              </tr>
            ))}
            {logs.length === 0 ? (
              <tr>
                <td colSpan={6} className="muted">
                  No webhook logs yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
