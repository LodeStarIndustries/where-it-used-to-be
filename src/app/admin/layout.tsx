import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { requireAdminPage } from "@/lib/admin/guard";
import { AdminNav } from "@/components/admin/AdminNav";

export const metadata: Metadata = {
  title: "Admin · Where It Used To Be",
  robots: { index: false, follow: false },
};

/** Checks admin rights before drawing anything, so non-admins never see the admin chrome. */
async function AdminGate({ children }: { children: React.ReactNode }) {
  await requireAdminPage("/admin");
  return (
    <div className="min-h-dvh bg-background">
      <header className="border-b border-divider bg-surface">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
          <Link href="/admin" className="text-[16px] font-bold text-ink">
            WIUTB Admin
          </Link>
          <AdminNav />
          <Link href="/" className="ml-auto text-[14px] font-semibold text-secondary hover:text-ink">
            Back to the game
          </Link>
        </div>
      </header>
      <div className="mx-auto max-w-6xl px-4 py-6">{children}</div>
    </div>
  );
}

export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return (
    <Suspense fallback={<p className="label-caps p-6 text-secondary">Loading…</p>}>
      <AdminGate>{children}</AdminGate>
    </Suspense>
  );
}
