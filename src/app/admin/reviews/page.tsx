import type { Metadata } from "next";
import { connectDb } from "@/lib/db";
import { Review } from "@/models/misc";
import { ArtisanProfile } from "@/models/artisan-profile";
import { moderateReviewAction } from "@/server/actions/admin";
import { EmptyState, Flash, PageHeader, dateOnly } from "@/components/ui";
import { first } from "@/lib/validation";

export const metadata: Metadata = { title: "Review moderation" };
export const dynamic = "force-dynamic";

export default async function AdminReviews({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams; await connectDb();
  const reviews = await Review.find({ $or: [{ "reports.0": { $exists: true } }, { hidden: true }] }).sort({ createdAt: -1 }).limit(100).lean();
  const names = new Map((await ArtisanProfile.find({ _id: { $in: reviews.map((r) => r.artisan) } }).select("displayName").lean()).map((a) => [String(a._id), a.displayName]));
  return (<><Flash ok={first(sp.ok)} error={first(sp.error)} /><PageHeader title="Review moderation" intro="Reported and hidden reviews. Hide only reviews that are abusive, fake or off-topic, not just negative ones." />
    {reviews.length === 0 ? <EmptyState title="Nothing reported" body="Reviews that artisans report will appear here." /> : (
      <ul className="space-y-3">{reviews.map((r) => (
        <li key={String(r._id)} className="panel space-y-2"><p className="font-semibold">{names.get(String(r.artisan))} · <span className="text-sun-700">{"★".repeat(r.rating)}</span> <span className="text-sm font-normal text-ink-500">{dateOnly(r.createdAt)}{r.hidden ? " · hidden" : ""}</span></p>
          {r.comment && <p>{r.comment}</p>}<ul className="text-sm text-ink-500">{r.reports.map((x, i) => <li key={i}>Reported: {x.reason}</li>)}</ul>
          <form action={moderateReviewAction}><input type="hidden" name="reviewId" value={String(r._id)} /><input type="hidden" name="hide" value={r.hidden ? "0" : "1"} /><button className={`btn btn-sm ${r.hidden ? "btn-ghost" : "btn-danger"}`}>{r.hidden ? "Restore review" : "Hide review"}</button></form></li>))}</ul>)}</>);
}
