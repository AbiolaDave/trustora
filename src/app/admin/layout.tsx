import { requireUser } from "@/lib/auth/server";
import { NavLink } from "@/components/nav-link";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireUser(["admin"]); // server-side role check; pages and every admin action check again
  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <nav aria-label="Admin" className="-mx-1 mb-6 flex gap-1 overflow-x-auto pb-1">
        <NavLink href="/admin" exact>Overview</NavLink><NavLink href="/admin/verification">Verification</NavLink><NavLink href="/admin/users">Users</NavLink><NavLink href="/admin/categories">Categories</NavLink>
        <NavLink href="/admin/bookings">Bookings</NavLink><NavLink href="/admin/disputes">Disputes</NavLink><NavLink href="/admin/payments">Payments</NavLink><NavLink href="/admin/reviews">Reviews</NavLink><NavLink href="/admin/settings">Settings</NavLink><NavLink href="/admin/audit">Audit log</NavLink>
      </nav>
      {children}
    </div>
  );
}
