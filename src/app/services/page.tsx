import Link from "next/link";
import type { Metadata } from "next";
import { searchServices, type SearchParams } from "../../server/search";
import { getCategories, getLaunchLocations, pretty } from "../../server/queries";
import { EmptyState, Pager, Rating, VerifiedBadge, Money } from "../../components/ui";
import { first } from "../../lib/validation";

export const metadata: Metadata = { title: "Find a service" };
export const dynamic = "force-dynamic";

const TYPE_LABEL: Record<string, string> = { fixed: "Fixed price", starting_from: "Starting from", quote: "Request a quote" };

export default async function Services({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const raw = await searchParams;
  const p: SearchParams = Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, first(v)])) as SearchParams;
  const [{ items, total, page, pages }, cats, locs] = await Promise.all([searchServices(p), getCategories(), getLaunchLocations()]);
  const keep = { ...p, page: undefined } as Record<string, string | undefined>;
  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="text-3xl font-bold">Find a service</h1>
      <div className="mt-6 grid gap-6 lg:grid-cols-[260px_1fr]">
        <form className="panel h-fit space-y-4" aria-label="Filters">
          <div><label className="label" htmlFor="q">Search</label><input id="q" name="q" defaultValue={p.q} className="input" placeholder="e.g. socket repair" /></div>
          <div><label className="label" htmlFor="category">Category</label>
            <select id="category" name="category" className="input" defaultValue={p.category ?? ""}><option value="">All categories</option>{cats.map((c) => <option key={String(c._id)} value={c.slug}>{c.name}</option>)}</select></div>
          <div><label className="label" htmlFor="area">Area</label>
            <select id="area" name="area" className="input" defaultValue={p.area ?? ""}><option value="">All areas</option>{locs.map((l) => <option key={l.slug} value={l.slug}>{l.name}, {pretty(l.city)}</option>)}</select></div>
          <div><label className="label" htmlFor="date">Available on</label><input id="date" type="date" name="date" defaultValue={p.date} className="input" /></div>
          <div><label className="label" htmlFor="type">Pricing</label>
            <select id="type" name="type" className="input" defaultValue={p.type ?? ""}><option value="">Any</option>{Object.entries(TYPE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
          <div className="grid grid-cols-2 gap-2">
            <div><label className="label" htmlFor="min">Min ₦</label><input id="min" inputMode="numeric" name="min" defaultValue={p.min} className="input" /></div>
            <div><label className="label" htmlFor="max">Max ₦</label><input id="max" inputMode="numeric" name="max" defaultValue={p.max} className="input" /></div>
          </div>
          <div><label className="label" htmlFor="rating">Minimum rating</label>
            <select id="rating" name="rating" className="input" defaultValue={p.rating ?? ""}><option value="">Any</option><option value="4">4 stars and up</option><option value="3">3 stars and up</option></select>
            <p className="hint">Only artisans with real reviews match.</p></div>
          <label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" name="verified" value="1" defaultChecked={p.verified === "1"} className="h-5 w-5" /> ID verified only</label>
          <div><label className="label" htmlFor="sort">Sort by</label>
            <select id="sort" name="sort" className="input" defaultValue={p.sort ?? ""}><option value="">Recommended</option><option value="price_asc">Lowest price</option><option value="rating">Highest rated</option><option value="newest">Newest</option></select></div>
          <div className="flex gap-2"><button className="btn btn-primary flex-1">Apply</button><Link href="/services" className="btn btn-ghost">Clear</Link></div>
        </form>

        <section aria-live="polite">
          <p className="mb-3 text-sm text-ink-500">{total} {total === 1 ? "service" : "services"} found</p>
          {items.length === 0 ? (
            <EmptyState title="No services match yet" body="Try removing a filter or choosing a wider area. New artisans join every week." href="/services" cta="Clear filters" />
          ) : (
            <ul className="grid gap-4 sm:grid-cols-2">
              {items.map((s) => (
                <li key={String(s._id)} className="panel flex flex-col">
                  {s.featured ? <span className="mb-2 w-fit rounded bg-sun-100 px-2 py-0.5 text-xs font-semibold text-sun-700">Featured</span> : null}
                  <h2 className="text-lg font-bold"><Link href={`/services/${s._id}`} className="hover:underline">{s.title}</Link></h2>
                  <p className="mt-1 text-sm"><Link href={`/artisans/${s.a.slug}`} className="font-semibold text-ink-700 hover:underline">{s.a.displayName}</Link></p>
                  <div className="mt-2 flex flex-wrap items-center gap-2"><VerifiedBadge status={s.a.verificationStatus} /><Rating avg={s.a.ratingAvg ?? 0} count={s.a.ratingCount ?? 0} /></div>
                  <p className="mt-auto pt-4 font-display text-lg font-bold">
                    {s.pricingModel === "quote" ? <span className="text-ink-700">Request a quote</span> : <>{s.pricingModel === "starting_from" && <span className="text-sm font-normal text-ink-500">from </span>}<Money kobo={s.priceKobo} /></>}
                    <span className="ml-2 text-sm font-normal text-ink-500">about {Math.round(s.durationMinutes / 30) / 2} hr</span>
                  </p>
                </li>
              ))}
            </ul>
          )}
          <Pager page={page} pages={pages} params={keep} />
        </section>
      </div>
    </main>
  );
}
