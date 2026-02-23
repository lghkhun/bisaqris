import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { regenerateApiKeyAction, updateProjectAction } from "@/lib/actions";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import ApiKeyField from "./ApiKeyField";

export default async function SettingsPage({ searchParams }) {
  const session = await requireSession();
  const query = await searchParams;
  const cookieStore = await cookies();
  const selectedProjectId = cookieStore.get("active_project_id")?.value;

  const projects = await prisma.project.findMany({
    where: { userId: session.userId },
    orderBy: { createdAt: "asc" },
    include: {
      apiKeys: {
        where: { revokedAt: null },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });

  const activeProject =
    projects.find((project) => project.id === selectedProjectId) || projects[0] || null;

  if (!activeProject) {
    return (
      <div className="stack">
        <h1>Settings</h1>
        <div className="card muted">
          No project found. Create your first project from the onboarding modal.
        </div>
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
    redirect("/dashboard/settings");
  }

  return (
    <div className="stack">
      <h1>Project Settings</h1>
      {query?.newKey ? <div className="alert">New API key generated. Copy and store it now.</div> : null}
      {query?.success ? <div className="alert">Success: {query.success}</div> : null}
      {query?.error ? <div className="alert">Error: {query.error}</div> : null}

      <div className="card stack">
        <h3>Project Profile</h3>
        <form action={updateProjectAction} className="stack">
          <input type="hidden" name="projectId" value={activeProject.id} />
          <div className="grid grid-2">
            <input name="name" defaultValue={activeProject.name} required minLength={2} placeholder="Project name" />
            <input
              name="appSlug"
              defaultValue={activeProject.appSlug}
              required
              minLength={3}
              pattern="[a-z0-9-]+"
              placeholder="project-slug"
            />
          </div>
          <input name="webhookUrl" type="url" defaultValue={activeProject.webhookUrl} required placeholder="Webhook URL" />
          <input
            name="logoUrl"
            type="url"
            defaultValue={activeProject.logoUrl || ""}
            placeholder="Logo URL (https://...)"
          />
          {activeProject.logoUrl ? (
            <div className="settings-logo-preview">
              <img src={activeProject.logoUrl} alt="Project logo" />
            </div>
          ) : null}
          <h4 style={{ margin: 0 }}>Payout Account</h4>
          <div className="grid grid-2">
            <input
              name="payoutBankName"
              defaultValue={activeProject.payoutBankName || ""}
              placeholder="Bank name"
            />
            <input
              name="payoutAccountName"
              defaultValue={activeProject.payoutAccountName || ""}
              placeholder="Account holder name"
            />
          </div>
          <input
            name="payoutAccountNumber"
            defaultValue={activeProject.payoutAccountNumber || ""}
            placeholder="Account number"
          />
          <button type="submit">Save Settings</button>
        </form>
      </div>

      <div className="card stack">
        <h3>API Key Security</h3>
        <p className="muted">
          One active API key per project. It is masked by default. Use Copy after generating or rotating.
        </p>
        <ApiKeyField rawKey={query?.newKey || ""} prefix={activeProject.apiKeys[0]?.keyPrefix || "bq_live_"} />
        {!query?.newKey ? (
          <p className="muted">For security, full key value is shown only once after key generation.</p>
        ) : null}
        <form action={regenerateApiKeyAction}>
          <input type="hidden" name="projectId" value={activeProject.id} />
          <input type="hidden" name="redirectTo" value="/dashboard/settings" />
          <button type="submit">Regenerate API Key</button>
        </form>
      </div>
    </div>
  );
}
