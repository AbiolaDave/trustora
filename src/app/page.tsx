import Link from "next/link";
import { connectDb } from "../lib/db";
import { getSettings } from "../lib/settings";
import { getCategories, getLaunchLocations, pretty } from "../server/queries";
import { Review } from "../models/misc";
import { ArtisanProfile } from "../models/artisan-profile";
import { Flash } from "../components/ui";
import { first } from "../lib/validation";

export const dynamic = "force-dynamic";

const FAQ = [
  ["How do I know an artisan is real?", "Artisans can upload an ID and a selfie. Our team checks them, and only then does the \"ID verified\" badge appear. Until then the profile says \"Not yet verified\"."],
  ["Do I pay before the job?", "You pay securely online after the artisan accepts, to confirm your slot. We record the payment, and if the artisan cancels or doesn't show up you can report it and get a refund."],
  ["What if the artisan doesn't show up?", "Report it from your booking page. We review both sides, and if the artisan is at fault you are refunded."],
  ["Is the price final?", "Fixed-price services are exactly what you see. \"Starting from\" services are confirmed by the artisan before you pay. For \"Request a quote\" services you approve the quote first. You never pay a surprise charge."],
  ["Which areas do you cover?", "We're launching in a few areas first and adding more as we grow. The area picker only shows places where artisans are available."],
] as const;

export default async function Home({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  await connectDb();
  const [cats, locs, settings, reviews] = await Promise.all([
    getCategories(), getLaunchLocations(), getSettings(),
    Review.find({ hidden: false, rating: { $gte: 4 }, comment: { $exists: true, $ne: "" } }).sort({ createdAt: -1 }).limit(3).lean(),
  ]);
  const artisanNames = new Map((await ArtisanProfile.find({ _id: { $in: reviews.map((r) => r.artisan) } }).select("displayName").lean()).map((a) => [String(a._id), a.displayName]));
  const cities = [...new Set(locs.map((l) => pretty(l.city)))];
  return (
    <main>
      <section className="adire text-white">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:py-20">
          <Flash ok={first(sp.ok)} error={first(sp.error)} />
          <h1 className="max-w-3xl text-4xl font-extrabold sm:text-6xl">Skilled hands, booked in minutes.</h1>
          <p className="mt-4 max-w-xl text-lg text-ink-100">Find plumbers, electricians, cleaners and AC technicians {cities.length ? `in ${cities.join(", ")}` : "near you"}. See the price first, pay securely, and know who is coming.</p>
          <form action="/services" className="mt-8 grid max-w-3xl gap-3 rounded-xl bg-white p-3 text-ink-900 sm:grid-cols-[1fr_auto_auto]" role="search">
            <div><label htmlFor="q" className="sr-only">What do you need done?</label><input id="q" name="q" className="input" placeholder="What do you need? e.g. fix a leaking tap" /></div>
            <div><label htmlFor="area" className="sr-only">Area</label>
              <select id="area" name="area" className="input" defaultValue="">
                <option value="">All areas</option>
                {[...new Set(locs.map((l) => l.city))].map((c) => <optgroup key={c} label={pretty(c)}><option value={`${locs.find((l) => l.city === c)!.state}/${c}`}>Anywhere in {pretty(c)}</option>{locs.filter((l) => l.city === c).map((l) => <option key={l.slug} value={l.slug}>{l.name}</option>)}</optgroup>)}
              </select></div>
            <button className="btn btn-accent">Search</button>
          </form>
          <p className="mt-3 text-sm text-ink-200">No account needed to browse.</p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-12">
        <h2 className="text-2xl font-bold sm:text-3xl">Popular services</h2>
        {cats.length ? (
          <ul className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {cats.map((c) => <li key={String(c._id)}><Link href={`/services?category=${c.slug}`} className="block rounded-lg border border-ink-100 bg-white px-4 py-4 font-semibold hover:border-ink-500">{c.name}</Link></li>)}
          </ul>
        ) : <p className="mt-4 rounded-lg border border-dashed border-ink-200 bg-white p-6 text-ink-500">Categories will show here once they are added in the admin dashboard (or run <code>npm run seed</code> for demo data).</p>}
      </section>

      <section className="bg-ink-50 py-12">
        <div className="mx-auto max-w-6xl px-4">
          <h2 className="text-2xl font-bold sm:text-3xl">How booking works</h2>
          <ol className="mt-6 grid gap-5 sm:grid-cols-3">
            {[["Choose a service", "Search by service and area. Compare prices, ratings and verification."], ["Pick a time and pay", "Choose a slot. When the artisan accepts, pay securely online to confirm."], ["Confirm when it's done", "The artisan arrives. You confirm the job, then leave a review."]].map(([t, d], i) => (
              <li key={t} className="panel"><span className="font-display text-3xl font-extrabold text-ink-500">{i + 1}</span><h3 className="mt-1 text-lg font-bold">{t}</h3><p className="mt-1 text-ink-500">{d}</p></li>
            ))}
          </ol>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-12">
        <div className="grid gap-8 md:grid-cols-2">
          <div>
            <h2 className="text-2xl font-bold sm:text-3xl">Why book through Trustora</h2>
            <ul className="mt-4 space-y-3 text-ink-700">
              <li><strong>ID checked, then badged.</strong> The badge only appears after our team approves an artisan's documents.</li>
              <li><strong>Prices in plain sight.</strong> Service charge, travel and booking fee are listed separately before you pay.</li>
              <li><strong>Records stay in one place.</strong> Bookings, payments and messages are saved, which makes disputes fair to both sides.</li>
              <li><strong>Reviews you can trust.</strong> Only customers with a completed booking can review, once per job.</li>
            </ul>
          </div>
          <div className="rounded-xl bg-ink-700 p-6 text-white">
            <h2 className="text-2xl font-bold">Are you an artisan?</h2>
            <p className="mt-2 text-ink-100">Get steady bookings from customers who have already agreed the price. Set your own prices, hours and areas.</p>
            <Link href="/register?role=artisan" className="btn btn-accent mt-5">Create your artisan profile</Link>
          </div>
        </div>
      </section>

      {reviews.length > 0 && (
        <section className="mx-auto max-w-6xl px-4 pb-12">
          <h2 className="text-2xl font-bold sm:text-3xl">Recent reviews</h2>
          <div className="mt-5 grid gap-4 md:grid-cols-3">
            {reviews.map((r) => <blockquote key={String(r._id)} className="panel"><p className="font-semibold text-sun-700">{"★".repeat(r.rating)}</p><p className="mt-2">{r.comment}</p><footer className="mt-2 text-sm text-ink-500">About {artisanNames.get(String(r.artisan)) ?? "an artisan"}</footer></blockquote>)}
          </div>
        </section>
      )}

      <section className="mx-auto max-w-3xl px-4 pb-4">
        <h2 className="text-2xl font-bold sm:text-3xl">Common questions</h2>
        <div className="mt-4 divide-y divide-ink-100 rounded-xl border border-ink-100 bg-white">
          {FAQ.map(([q, a]) => <details key={q} className="group p-4"><summary className="cursor-pointer font-semibold">{q}</summary><p className="mt-2 text-ink-500">{a}</p></details>)}
        </div>
        <p className="mt-4 text-sm text-ink-500">Launching in: {settings.launchCities.map((c) => pretty(c)).join(", ")}. More areas soon.</p>
      </section>
    </main>
  );
}
