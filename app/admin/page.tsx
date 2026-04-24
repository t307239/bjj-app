/**
 * /admin — Internal admin panel (owner-only)
 * Protected by ADMIN_EMAIL env var check. Server-rendered guard.
 */

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AdminPanel from "./AdminPanel";

// layout.tsx の template "%s | BJJ App" が自動付与するので suffix 重複回避
export const metadata = { title: "Admin", robots: "noindex,nofollow" };
export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Not logged in → redirect
  if (!user?.email) redirect("/login");

  // Email check — must match ADMIN_EMAIL env var
  const adminEmail = process.env.ADMIN_EMAIL ?? "";
  if (!adminEmail || user.email.toLowerCase() !== adminEmail.toLowerCase()) {
    redirect("/dashboard");
  }

  return <AdminPanel adminEmail={user.email} />;
}
