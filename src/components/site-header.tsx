import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/server";
import { logoutAction } from "@/server/actions/auth";
import { connectDb } from "@/lib/db";
import { Notification } from "@/models/misc";

export async function SiteHeader() {
  const user = await getCurrentUser();
  let unread = 0;
  if (user) { await connectDb(); unread = await Notification.countDocuments({ user: user._id, readAt: { $exists: false } }); }
  const home = user?.role === "admin" ? "/admin" : user?.role === "artisan" ? "/artisan" : "/dashboard";
  return (
    <header className="border-b border-ink-100 bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
        <Link href="/" className="flex items-center gap-2 font-display text-xl font-extrabold text-ink-700">
          <svg width="28" height="28" viewBox="0 0 512 512" aria-hidden="true"><rect width="512" height="512" rx="96" fill="#1E2A5E" /><circle cx="256" cy="256" r="120" fill="none" stroke="#E4E7F3" strokeWidth="22" /><circle cx="256" cy="256" r="46" fill="#E0A02B" /></svg>
          Trustora
        </Link>
        <nav aria-label="Main" className="hidden items-center gap-1 md:flex">
          <Link className="rounded-md px-3 py-2 text-sm font-semibold text-ink-700 hover:bg-ink-100" href="/services">Find a service</Link>
          <Link className="rounded-md px-3 py-2 text-sm font-semibold text-ink-700 hover:bg-ink-100" href="/how-it-works">How it works</Link>
          <Link className="rounded-md px-3 py-2 text-sm font-semibold text-ink-700 hover:bg-ink-100" href="/trust">Trust &amp; safety</Link>
          {!user && <Link className="rounded-md px-3 py-2 text-sm font-semibold text-ink-700 hover:bg-ink-100" href="/register?role=artisan">Join as an artisan</Link>}
        </nav>
        <div className="flex items-center gap-2">
          {user ? (
            <>
              <Link href={home} className="btn btn-ghost btn-sm">{user.name.split(" ")[0]}{unread > 0 && <span className="rounded-full bg-pepper-600 px-1.5 text-xs text-white" aria-label={`${unread} unread notifications`}>{unread}</span>}</Link>
              <form action={logoutAction}><button className="btn btn-ghost btn-sm">Log out</button></form>
            </>
          ) : (
            <>
              <Link href="/login" className="btn btn-ghost btn-sm">Log in</Link>
              <Link href="/register" className="btn btn-primary btn-sm">Sign up</Link>
            </>
          )}
        </div>
      </div>
      <nav aria-label="Main mobile" className="flex gap-1 overflow-x-auto border-t border-ink-100 px-3 py-1.5 md:hidden">
        <Link className="whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-semibold text-ink-700" href="/services">Find a service</Link>
        <Link className="whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-semibold text-ink-700" href="/how-it-works">How it works</Link>
        <Link className="whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-semibold text-ink-700" href="/trust">Trust &amp; safety</Link>
        {!user && <Link className="whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-semibold text-ink-700" href="/register?role=artisan">Join as an artisan</Link>}
      </nav>
    </header>
  );
}
