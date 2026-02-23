import Link from "next/link";
import { requireAdminSession } from "@/lib/admin-auth";

export default async function AdminLayout({ children }) {
  await requireAdminSession();

  return (
    <div className="admin-layout">
      <aside className="admin-sidebar">
        <h2>Admin Panel</h2>
        <nav className="admin-nav">
          <Link href="/admin">Platform</Link>
          <Link href="/admin/fees">Fee Settings</Link>
          <Link href="/admin/users">Users</Link>
          <Link href="/admin/transactions">Transactions</Link>
          <Link href="/admin/withdrawals">Withdrawals</Link>
          <Link href="/dashboard">Back to Dashboard</Link>
        </nav>
      </aside>
      <main className="admin-main">{children}</main>
    </div>
  );
}
