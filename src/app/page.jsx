import Link from "next/link";
import { getSession } from "@/lib/auth";
import { getAppName } from "@/lib/config";

export default async function HomePage() {
  const session = await getSession();
  const appName = getAppName();

  return (
    <main className="container">
      <div className="card stack">
        <h1>{appName}</h1>
        <p className="muted">
          A simple payment aggregator for fast onboarding, multi-project setup, and API integration.
        </p>
        {session ? (
          <div className="grid grid-2">
            <Link href="/dashboard">Go to dashboard</Link>
            <Link href="/docs">API Docs</Link>
          </div>
        ) : (
          <div className="grid grid-2">
            <Link href="/login">Login</Link>
            <Link href="/register">Register</Link>
          </div>
        )}
      </div>
    </main>
  );
}
