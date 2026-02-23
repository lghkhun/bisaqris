import Link from "next/link";
import { registerAction } from "@/lib/actions";
import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function RegisterPage({ searchParams }) {
  const session = await getSession();
  if (session?.userId) redirect("/dashboard");

  const params = await searchParams;

  return (
    <main className="container">
      <div className="card stack" style={{ maxWidth: 480, margin: "0 auto" }}>
        <h1>Register</h1>
        <p className="muted">Create a new account to start building projects.</p>
        <form action={registerAction} className="stack">
          <input name="name" type="text" placeholder="Name" required minLength={2} />
          <input name="email" type="email" placeholder="Email" required />
          <input name="password" type="password" placeholder="Password" required minLength={8} />
          <button type="submit">Create account</button>
        </form>
        {params?.error ? <div className="alert">Registration failed: {params.error}</div> : null}
        <p className="muted">
          Already have an account? <Link href="/login">Login</Link>
        </p>
      </div>
    </main>
  );
}
