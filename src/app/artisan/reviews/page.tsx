import type { Metadata } from "next";
import { connectDb } from "../../../lib/db";
import { requireArtisan } from "../../../lib/auth/server";
import { Review } from "../../../models/misc";
import { reportReviewAction } from "../../../server/actions/booking";
import { EmptyState, Flash, PageHeader, Rating, dateOnly } from "../../../components/ui";
import { first } from "../../../lib/validation";

export const metadata: Metadata = { title: "Reviews" };
export const dynamic = "force-dynamic";

export default async function ArtisanReviews({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams; const { profile } = await requireArtisan(); await connectDb();
  const reviews = profile ? await Review.find({ artisan: profile._id }).sort({ createdAt: -1 }).limit(100).lean() : [];
  return (<><Flash ok={first(sp.ok)} error={first(sp.error)} /><PageHeader title="Reviews"><Rating avg={profile?.ratingAvg ?? 0} count={profile?.ratingCount ?? 0} /></PageHeader>
    {reviews.length === 0 ? <EmptyState title="No reviews yet" body="Customers can review after a completed job. Reviews can't be requested or edited by you." /> : (
      <ul className="space-y-3">{reviews.map((r) => <li key={String(r._id)} className="panel"><p className="font-semibold text-sun-700">{"★".repeat(r.rating)} <span className="text-sm font-normal text-ink-500">{dateOnly(r.createdAt)}{r.hidden ? " · hidden by moderators" : ""}</span></p>{r.comment && <p className="mt-1">{r.comment}</p>}
        <details className="mt-2"><summary className="cursor-pointer text-sm text-ink-500">Think this review is unfair or fake?</summary>
          <form action={reportReviewAction} className="mt-2 flex gap-2"><input type="hidden" name="reviewId" value={String(r._id)} /><label className="sr-only" htmlFor={`r${r._id}`}>Reason</label><input id={`r${r._id}`} name="reason" className="input" placeholder="Why should we check it?" required /><button className="btn btn-ghost">Report</button></form></details></li>)}</ul>)}</>);
}
