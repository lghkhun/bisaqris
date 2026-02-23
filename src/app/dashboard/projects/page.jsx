import Link from "next/link";
import { createProjectAction } from "@/lib/actions";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function ProjectsPage({ searchParams }) {
  const session = await requireSession();
  const params = await searchParams;

  const projects = await prisma.project.findMany({
    where: { userId: session.userId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      appSlug: true,
      webhookUrl: true,
      createdAt: true,
      _count: { select: { transactions: true } },
    },
  });

  return (
    <div className="stack">
      <h1>Projects</h1>

      {params?.error ? <div className="alert">Error: {params.error}</div> : null}
      {params?.success ? <div className="alert">Success: {params.success}</div> : null}

      <div className="card stack">
        <h3>Create New Project</h3>
        <p className="muted">
          You can create multiple projects under one account.
        </p>
        <form action={createProjectAction} className="stack">
          <input name="name" type="text" placeholder="Project name" required minLength={2} />
          <input name="webhookUrl" type="url" placeholder="https://example.com/webhook" required />
          <button type="submit">Create Project + API Key</button>
        </form>
      </div>

      <div className="card">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Slug</th>
              <th>Webhook</th>
              <th>Transactions</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {projects.map((project) => (
              <tr key={project.id}>
                <td>{project.name}</td>
                <td>{project.appSlug}</td>
                <td>{project.webhookUrl}</td>
                <td>{project._count.transactions}</td>
                <td>
                  <Link href={`/dashboard/projects/${project.id}`}>Manage</Link>
                </td>
              </tr>
            ))}
            {projects.length === 0 ? (
              <tr>
                <td colSpan={5} className="muted">
                  No projects yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
