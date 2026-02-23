"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { logoutAction } from "@/lib/actions";

export default function DocsSidebar({ appName, sections, account }) {
  const [query, setQuery] = useState("");
  const displayName = account?.name || "Account";
  const displayEmail = account?.email || "";
  const initial = (displayName || displayEmail || "U").slice(0, 1).toUpperCase();

  const filteredSections = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return sections;
    return sections.filter((item) => item.label.toLowerCase().includes(q));
  }, [sections, query]);

  return (
    <aside className="docs-side">
      <h2>{appName} API</h2>
      <input
        type="text"
        className="docs-search"
        placeholder="Search endpoint..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <nav className="docs-nav">
        {filteredSections.map((item) => (
          <a key={item.id} href={`#${item.id}`}>
            {item.label}
          </a>
        ))}
      </nav>

      <div className="docs-side-footer">
        {account ? (
          <details className="account-switcher docs-account-switcher">
            <summary>
              <span className="account-avatar">{initial}</span>
              <span>
                <strong>{displayName}</strong>
                <small>{displayEmail || "-"}</small>
              </span>
            </summary>
            <div className="account-menu">
              <Link href="/dashboard">Dashboard</Link>
              <Link href="/dashboard/account-settings">Account Settings</Link>
              <form action={logoutAction}>
                <button type="submit" className="account-logout">
                  Logout
                </button>
              </form>
            </div>
          </details>
        ) : (
          <Link href="/login" className="docs-login-btn">
            Login
          </Link>
        )}
      </div>
    </aside>
  );
}
