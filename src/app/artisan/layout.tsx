import Link from "next/link";
import { requireArtisan } from "@/lib/auth/server";
import { NavLink } from "@/components/nav-link";
import { resendVerificationAction } from "@/server/actions/auth";
import { connectDb } from "@/lib/db";
import { Service } from "@/models/service";

export default async function ArtisanLayout({ children }: { children: React.ReactNode }) {
  const { user, profile } = await requireArtisan();
  await connectDb();
  const hasService = profile ? !!(await Service.exists({ artisan: profile._id, active: true })) : false;
  const steps = [
    { done: !!(profile?.bio && profile.serviceAreas?.length), label: "Complete your profile", href: "/artisan/profile" },
    { done: hasService, label: "Add a service", href: "/artisan/services" },
    { done: !!profile?.workingWindows?.length, label: "Set your working hours", href: "/artisan/availability" },
    { done: profile?.verificationStatus === "verified", label: profile?.verificationStatus === "pending_review" ? "Verification under review" : "Get verified", href: "/artisan/verification" },
  ];
  const incomplete = steps.filter((s) => !s.done);
  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <nav aria-label="Artisan dashboard" className="-mx-1 mb-6 flex gap-1 overflow-x-auto pb-1">
        <NavLink href="/artisan" exact>Overview</NavLink><NavLink href="/artisan/bookings">Bookings</NavLink><NavLink href="/artisan/services">Services</NavLink><NavLink href="/artisan/availability">Availability</NavLink>
        <NavLink href="/artisan/earnings">Earnings</NavLink><NavLink href="/artisan/reviews">Reviews</NavLink><NavLink href="/artisan/verification">Verification</NavLink><NavLink href="/artisan/profile">Profile</NavLink><NavLink href="/artisan/notifications">Alerts</NavLink>
      </nav>
      {!user.emailVerifiedAt && (
        <form action={resendVerificationAction} className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-sun-500/50 bg-sun-100 px-4 py-3 text-[15px] text-sun-700">
          <span>Verify your email first. We sent you a link.</span><button className="btn btn-ghost btn-sm">Resend email</button></form>
      )}
      {incomplete.length > 0 && (
        <div className="mb-6 rounded-xl border border-ink-200 bg-ink-50 p-4"><p className="font-semibold">Get ready for bookings</p>
          <ul className="mt-2 flex flex-wrap gap-2">{steps.map((s) => <li key={s.label}><Link href={s.href} className={`inline-block rounded-full px-3 py-1 text-sm font-semibold ${s.done ? "bg-leaf-50 text-leaf-700" : "bg-white text-ink-700 ring-1 ring-ink-200"}`}>{s.done ? "✓ " : ""}{s.label}</Link></li>)}</ul></div>
      )}
      {children}
    </div>
  );
}
