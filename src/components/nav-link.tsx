"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
export function NavLink({ href, children, exact }: { href: string; children: React.ReactNode; exact?: boolean }) {
  const path = usePathname();
  const active = exact ? path === href : path === href || path.startsWith(href + "/");
  return <Link href={href} aria-current={active ? "page" : undefined} className={`whitespace-nowrap rounded-md px-3 py-2 text-sm font-semibold ${active ? "bg-ink-700 text-white" : "text-ink-700 hover:bg-ink-100"}`}>{children}</Link>;
}
