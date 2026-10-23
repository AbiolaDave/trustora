import Link from "next/link";
import { notFound } from "next/navigation";
import { connectDb } from "../../../lib/db";
import { ArtisanProfile } from "../../../models/artisan-profile";
import { Service } from "../../../models/service";
import { Review } from "../../../models/misc";
import { User } from "../../../models/user";
import { Rating, VerifiedBadge, Money, EmptyState, dateOnly } from "../../../components/ui";

export const dynamic = "force-dynamic";

export default async function ArtisanPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  await connectDb();
  const a = await ArtisanProfile.findOne({ slug }).lean();
  if (!a) notFound();
  const owner = await User.findById(a.user).select("status").lean();
  if (owner?.status !== "active") notFound();
  const [services, reviews] = await Promise.all([
    Service.find({ artisan: a._id, active: true }).sort({ createdAt: -1 }).lean(),
    Review.find({ artisan: a._id, hidden: false }).sort({ createdAt: -1 }).limit(10).lean(),
  ]);
  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="text-3xl font-bold">{a.displayName}</h1>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <VerifiedBadge status={a.verificationStatus} /><Rating avg={a.ratingAvg ?? 0} count={a.ratingCount ?? 0} />
        {a.completedJobs ? <span className="text-sm text-ink-500">{a.completedJobs} jobs completed</span> : null}
        {a.yearsExperience ? <span className="text-sm text-ink-500">{a.yearsExperience} years' experience</span> : null}
      </div>
      {a.bio && <p className="prose-page mt-5 whitespace-pre-line">{a.bio}</p>}
      {a.skills?.length ? <ul className="mt-4 flex flex-wrap gap-2">{a.skills.map((s) => <li key={s} className="rounded-full bg-ink-100 px-3 py-1 text-sm font-semibold text-ink-700">{s}</li>)}</ul> : null}
      {a.serviceAreas?.length ? <p className="mt-4 text-sm text-ink-500">Serves: {a.serviceAreas.map((s) => s.split("/").pop()!.replace(/-/g, " ")).join(", ")}</p> : null}
      {a.portfolio?.length ? <section className="mt-8"><h2 className="text-xl font-bold">Past work</h2><ul className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">{a.portfolio.map((p, i) => <li key={i}>{/* eslint-disable-next-line @next/next/no-img-element */}<img src={p.url ?? ""} alt={p.caption ?? "Completed work"} loading="lazy" className="aspect-square w-full rounded-lg object-cover" /></li>)}</ul></section> : null}

      <h2 className="mt-10 text-xl font-bold">Services</h2>
      {services.length === 0 ? <div className="mt-3"><EmptyState title="No services listed" body="This artisan hasn't published a service yet." /></div> : (
        <ul className="mt-3 grid gap-3 sm:grid-cols-2">{services.map((s) => (
          <li key={String(s._id)} className="panel"><Link href={`/services/${s._id}`} className="font-bold hover:underline">{s.title}</Link><p className="mt-1 text-ink-500">{s.pricingModel === "quote" ? "Request a quote" : <>{s.pricingModel === "starting_from" ? "from " : ""}<Money kobo={s.priceKobo} /></>}</p></li>
        ))}</ul>
      )}

      <h2 className="mt-10 text-xl font-bold">Reviews</h2>
      {reviews.length === 0 ? <p className="mt-2 text-ink-500">No reviews yet. Reviews appear here after customers complete a booking.</p> : (
        <ul className="mt-3 space-y-3">{reviews.map((r) => <li key={String(r._id)} className="panel"><p className="font-semibold text-sun-700">{"★".repeat(r.rating)}<span className="ml-2 text-sm font-normal text-ink-500">{dateOnly(r.createdAt)}</span></p>{r.comment && <p className="mt-1">{r.comment}</p>}</li>)}</ul>
      )}
    </main>
  );
}
