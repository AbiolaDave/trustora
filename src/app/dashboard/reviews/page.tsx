import Link from "next/link";
import type { Metadata } from "next";
import { connectDb } from "../../../lib/db";
import { requireUser } from "../../../lib/auth/server";
import { Review } from "../../../models/misc";
import { Booking } from "../../../models/booking";
import { EmptyState, PageHeader, dateOnly } from "../../../components/ui";

export const metadata: Metadata = { title: "Your reviews" };
export const dynamic = "force-dynamic";

export default async function Reviews() {
  const user = await requireUser(["customer"]); await connectDb();
  const [mine, toReview] = await Promise.all([
    Review.find({ customer: user._id }).sort({ createdAt: -1 }).lean(),
    Booking.find({ customer: user._id, status: "completed" }).sort({ completedAt: -1 }).limit(50).lean(),
  ]);
  const reviewed = new Set(mine.map((r) => String(r.booking)));
  const pending = toReview.filter((b) => !reviewed.has(String(b._id)));
  return (<><PageHeader title="Reviews" />
    {pending.length > 0 && <><h2 className="mb-2 text-xl font-bold">Waiting for your review</h2><ul className="mb-8 space-y-2">{pending.map((b) => <li key={String(b._id)} className="panel flex items-center justify-between gap-2"><span className="font-semibold">{b.serviceTitle}</span><Link className="btn btn-primary btn-sm" href={`/dashboard/bookings/${b._id}`}>Leave a review</Link></li>)}</ul></>}
    <h2 className="mb-2 text-xl font-bold">Reviews you've written</h2>
    {mine.length === 0 ? <EmptyState title="No reviews yet" body="After a job is completed you can rate your artisan here." /> : <ul className="space-y-2">{mine.map((r) => <li key={String(r._id)} className="panel"><p className="font-semibold text-sun-700">{"★".repeat(r.rating)} <span className="text-sm font-normal text-ink-500">{dateOnly(r.createdAt)}</span></p>{r.comment && <p>{r.comment}</p>}</li>)}</ul>}</>);
}
