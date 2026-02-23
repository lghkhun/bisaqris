import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth";

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

export function isAdminEmail(email) {
  const current = normalizeEmail(email);
  if (!current) return false;
  const list = String(process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((item) => normalizeEmail(item))
    .filter(Boolean);
  return list.includes(current);
}

export async function requireAdminSession() {
  const session = await requireSession();
  if (!isAdminEmail(session?.email)) {
    redirect("/dashboard");
  }
  return session;
}

