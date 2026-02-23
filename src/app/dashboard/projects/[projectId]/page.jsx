import { deleteProjectAction, regenerateApiKeyAction, updateProjectAction } from "@/lib/actions";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";

export default async function ProjectDetailPage({ params, searchParams }) {
  const session = await requireSession();
  const { projectId } = await params;
  const query = await searchParams;

  const project = await prisma.project.findFirst({
    where: { id: projectId, userId: session.userId },
    include: {
      apiKeys: {
        where: { revokedAt: null },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });

  if (!project) notFound();

  return (
    <div className="stack">
      <h1>Project Settings</h1>
      <p className="muted">Manage webhook URL, app slug, and rotate API key.</p>

      {query?.success ? <div className="alert">Success: {query.success}</div> : null}
      {query?.error ? <div className="alert">Error: {query.error}</div> : null}
      {query?.newKey ? (
        <div className="alert">
          New API key (copy now): <code>{query.newKey}</code>
        </div>
      ) : null}

      <div className="card stack">
        <h3>General</h3>
        <form action={updateProjectAction} className="stack">
          <input type="hidden" name="projectId" value={project.id} />
          <input name="name" defaultValue={project.name} required minLength={2} />
          <input
            name="appSlug"
            defaultValue={project.appSlug}
            required
            minLength={3}
            pattern="[a-z0-9-]+"
          />
          <input name="webhookUrl" type="url" defaultValue={project.webhookUrl} required />
          <button type="submit">Save Settings</button>
        </form>
      </div>

      <div className="card stack">
        <h3>API Key</h3>
        <p className="muted">
          Active key prefix: <code>{project.apiKeys[0]?.keyPrefix || "none"}</code>
        </p>
        <form action={regenerateApiKeyAction}>
          <input type="hidden" name="projectId" value={project.id} />
          <button type="submit">Regenerate API Key</button>
        </form>
      </div>

      <div className="card stack">
        <h3>Danger Zone</h3>
        <form action={deleteProjectAction}>
          <input type="hidden" name="projectId" value={project.id} />
          <button type="submit">Delete Project</button>
        </form>
      </div>
    </div>
  );
}
