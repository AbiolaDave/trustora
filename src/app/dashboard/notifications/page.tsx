import Link from "next/link";
import type { Metadata } from "next";
import { connectDb } from "@/lib/db";
import { requireUser } from "@/lib/auth/server";
import { Notification } from "@/models/misc";
import { markNotificationsReadAction } from "@/server/actions/customer";
import { EmptyState, Flash, PageHeader, dateTime } from "@/components/ui";
import { first } from "@/lib/validation";

export const metadata: Metadata = { title: "Notifications" };
export const dynamic = "force-dynamic";

export default async function Notifications({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams; const user = await requireUser(["customer"]); await connectDb();
  const items = await Notification.find({ user: user._id }).sort({ createdAt: -1 }).limit(50).lean();
  return (<><Flash ok={first(sp.ok)} error={first(sp.error)} />
    <PageHeader title="Notifications">{items.some((n) => !n.readAt) && <form action={markNotificationsReadAction}><button className="btn btn-ghost btn-sm">Mark all as read</button></form>}</PageHeader>
    {items.length === 0 ? <EmptyState title="No notifications yet" body="We'll tell you here when an artisan responds, a payment is confirmed, or a job is done." /> : (
      <ul className="space-y-2">{items.map((n) => <li key={String(n._id)} className={`panel ${n.readAt ? "" : "border-ink-500"}`}>
        <p className="font-semibold">{n.link ? <Link href={n.link} className="hover:underline">{n.title}</Link> : n.title}</p><p className="text-[15px] text-ink-500">{n.body}</p><p className="mt-1 text-xs text-ink-500">{dateTime(n.createdAt)}</p></li>)}</ul>)}</>);
}
