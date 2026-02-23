import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function AccountSettingsPage() {
  const session = await requireSession();
  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { name: true, email: true, createdAt: true },
  });

  return (
    <div className="stack">
      <h1>Account Settings</h1>
      <div className="card stack">
        <div>
          <strong>Name</strong>
          <div className="muted">{user?.name || "-"}</div>
        </div>
        <div>
          <strong>Email</strong>
          <div className="muted">{user?.email || "-"}</div>
        </div>
        <div>
          <strong>Joined</strong>
          <div className="muted">{user?.createdAt?.toISOString() || "-"}</div>
        </div>
      </div>
    </div>
  );
}
