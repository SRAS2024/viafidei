import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth/admin";
import { UserAccountsClient } from "./UserAccountsClient";

export const metadata = { title: "User Accounts · Admin" };
export const dynamic = "force-dynamic";

export default async function AdminUsersPage() {
  const admin = await requireAdmin();
  if (!admin) redirect("/admin/login");

  return (
    <div>
      <header className="border-b border-ink/10 pb-6">
        <p className="vf-eyebrow">Via Fidei · Admin</p>
        <div className="vf-rule my-4" />
        <h1 className="font-display text-3xl">User Accounts</h1>
        <p className="mt-2 font-serif text-ink-soft">
          Registered Via Fidei members. Search, page, and review account details.
        </p>
      </header>
      <UserAccountsClient />
    </div>
  );
}
