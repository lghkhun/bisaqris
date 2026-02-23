import Link from "next/link";
import { cookies } from "next/headers";
import { unstable_noStore as noStore } from "next/cache";
import { createProjectAction, logoutAction, switchActiveProjectAction } from "@/lib/actions";
import { isAdminEmail } from "@/lib/admin-auth";
import { requireSession } from "@/lib/auth";
import { getProjectBalanceSummary } from "@/lib/balance";
import { prisma } from "@/lib/prisma";

function formatMoney(value) {
  return `Rp ${new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value)}`;
}

export default async function DashboardLayout({ children }) {
  noStore();
  const session = await requireSession();
  const cookieStore = await cookies();
  const selectedProjectId = cookieStore.get("active_project_id")?.value;
  const account = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { name: true, email: true },
  });
  const isAdmin = isAdminEmail(account?.email || session?.email);

  let projects = [];
  try {
    projects = await prisma.project.findMany({
      where: { userId: session.userId },
      orderBy: { createdAt: "asc" },
      select: { id: true, name: true, appSlug: true, logoUrl: true },
    });
  } catch (error) {
    const msg = String(error?.message || error);
    if (!msg.includes("Unknown field `logoUrl`")) throw error;
    projects = await prisma.project.findMany({
      where: { userId: session.userId },
      orderBy: { createdAt: "asc" },
      select: { id: true, name: true, appSlug: true },
    });
  }

  const activeProject = projects.find((project) => project.id === selectedProjectId) || projects[0] || null;
  if (activeProject && activeProject.id !== selectedProjectId) {
    cookieStore.set("active_project_id", activeProject.id, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });
  }
  const needsProjectOnboarding = projects.length === 0;
  const { totalBalance, withdrawableBalance } = activeProject
    ? await getProjectBalanceSummary(activeProject.id)
    : { totalBalance: 0, withdrawableBalance: 0 };

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="sidebar-top">
          <details className="project-switcher">
            <summary>
              <span className="project-icon">
                {activeProject?.logoUrl ? (
                  <img src={activeProject.logoUrl} alt={`${activeProject.name} logo`} />
                ) : (
                  (activeProject?.name || "P").slice(0, 1).toUpperCase()
                )}
              </span>
              <span>
                <strong>{activeProject?.name || "No project"}</strong>
                <small>{activeProject?.appSlug || "Create your first project"}</small>
              </span>
            </summary>
            <div className="project-list">
              {projects.map((project) => (
                <form action={switchActiveProjectAction} key={project.id}>
                  <input type="hidden" name="projectId" value={project.id} />
                  <input type="hidden" name="redirectTo" value="/dashboard" />
                  <button
                    type="submit"
                    className={project.id === activeProject?.id ? "project-item active" : "project-item"}
                  >
                    <span className="project-item-head">
                      <span className="project-item-icon">
                        {project.logoUrl ? (
                          <img src={project.logoUrl} alt={`${project.name} logo`} />
                        ) : (
                          project.name.slice(0, 1).toUpperCase()
                        )}
                      </span>
                      <span>{project.name}</span>
                    </span>
                    <small>{project.appSlug}</small>
                  </button>
                </form>
              ))}
              <Link className="project-add" href="/dashboard/projects">
                + Add project
              </Link>
            </div>
          </details>

          <div className="sidebar-balance-row">
            <article className="card sidebar-balance-main">
              <div className="muted">Total Balance</div>
              <strong>{formatMoney(totalBalance)}</strong>
            </article>
            <article className="card sidebar-balance-sub">
              <div className="muted">Withdrawable</div>
              <strong>{formatMoney(withdrawableBalance)}</strong>
            </article>
          </div>

          <nav className="nav">
            <Link href="/dashboard">Dashboard</Link>
            <Link href="/dashboard/transactions">Transactions</Link>
            <Link href="/dashboard/withdraw">Withdraw</Link>
            <Link href="/dashboard/webhook-logs">Webhook Logs</Link>
            <Link href="/dashboard/settings">Settings</Link>
          </nav>
        </div>

        <details className="account-switcher">
          <summary>
            <span className="account-avatar">
              {(account?.name || account?.email || "U").slice(0, 1).toUpperCase()}
            </span>
            <span>
              <strong>{account?.name || "Account"}</strong>
              <small>{account?.email || "-"}</small>
            </span>
          </summary>
          <div className="account-menu">
            {isAdmin ? <Link href="/admin">Admin</Link> : null}
            <Link href="/docs">Docs API</Link>
            <Link href="/dashboard/account-settings">Account Settings</Link>
            <form action={logoutAction}>
              <button type="submit" className="account-logout">
                Logout
              </button>
            </form>
          </div>
        </details>
      </aside>
      <main className="main">
        {children}
        {needsProjectOnboarding ? (
          <div className="onboarding-overlay">
            <div className="onboarding-modal card stack">
              <h3>Setup Project</h3>
              <p className="muted">
                To start using the dashboard, complete your first project setup.
              </p>
              <form action={createProjectAction} className="stack">
                <input
                  name="name"
                  type="text"
                  placeholder="Project name"
                  required
                  minLength={2}
                />
                <input
                  name="webhookUrl"
                  type="url"
                  placeholder="https://your-domain.com/webhook"
                  required
                />
                <input type="hidden" name="redirectTo" value="/dashboard" />
                <button type="submit">Create Project</button>
              </form>
            </div>
          </div>
        ) : null}
      </main>
    </div>
  );
}
