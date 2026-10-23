import { requireUser } from "@/lib/auth/server";
import { NavLink } from "@/components/nav-link";
import { resendVerificationAction } from "@/server/actions/auth";

export default async function CustomerLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser(["customer"]);
  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <nav aria-label="Dashboard" className="-mx-1 mb-6 flex gap-1 overflow-x-auto pb-1">
        <NavLink href="/dashboard" exact>Overview</NavLink><NavLink href="/dashboard/bookings">Bookings</NavLink><NavLink href="/dashboard/saved">Saved</NavLink>
        <NavLink href="/dashboard/payments">Payments</NavLink><NavLink href="/dashboard/reviews">Reviews</NavLink><NavLink href="/dashboard/notifications">Notifications</NavLink><NavLink href="/dashboard/profile">Profile</NavLink>
      </nav>
      {!user.emailVerifiedAt && (
        <form action={resendVerificationAction} className="mb-5 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-sun-500/50 bg-sun-100 px-4 py-3 text-[15px] text-sun-700">
          <span>Verify your email to book services. Check your inbox for the link.</span><button className="btn btn-ghost btn-sm">Resend email</button>
        </form>
      )}
      {children}
    </div>
  );
}
