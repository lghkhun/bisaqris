import Link from "next/link";
import { loginAction } from "@/lib/actions";
import { getSession } from "@/lib/auth";
import { getAppName } from "@/lib/config";
import { redirect } from "next/navigation";

export default async function LoginPage({ searchParams }) {
  const session = await getSession();
  if (session?.userId) redirect("/dashboard");
  const appName = getAppName();

  const params = await searchParams;

  return (
    <main className="container">
      <div className="card stack" style={{ maxWidth: 480, margin: "0 auto" }}>
        <h1>Login</h1>
        <p className="muted">Sign in to your {appName} account.</p>
        <form action={loginAction} className="stack">
          <input name="email" type="email" placeholder="Email" required />
          <input name="password" type="password" placeholder="Password" required minLength={8} />
          <button type="submit">Login</button>
        </form>
        {params?.error ? <div className="alert">Login failed: {params.error}</div> : null}
        <p className="muted">
          Don&apos;t have an account? <Link href="/register">Register</Link>
        </p>
      </div>
    </main>
  );
}
