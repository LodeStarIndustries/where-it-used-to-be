"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/places", label: "Places" },
  { href: "/admin/puzzles", label: "Puzzles" },
  { href: "/admin/submissions", label: "Submissions" },
  { href: "/admin/import", label: "Import & export" },
];

export function AdminNav() {
  const path = usePathname();
  return (
    <nav aria-label="Admin">
      <ul className="flex flex-wrap gap-1">
        {links.map((l) => {
          const current = l.href === "/admin" ? path === "/admin" : path.startsWith(l.href);
          return (
            <li key={l.href}>
              <Link
                href={l.href}
                aria-current={current ? "page" : undefined}
                className={`inline-flex h-9 items-center rounded-button px-3 text-[14px] font-semibold ${
                  current ? "bg-ink text-white" : "text-ink hover:bg-background"
                }`}
              >
                {l.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
