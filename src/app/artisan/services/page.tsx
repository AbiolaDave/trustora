import Link from "next/link";
import type { Metadata } from "next";
import { connectDb } from "@/lib/db";
import { requireArtisan } from "@/lib/auth/server";
import { Service } from "@/models/service";
import { getCategories } from "@/server/queries";
import { toggleServiceAction } from "@/server/actions/artisan";
import { ServiceForm } from "@/components/service-form";
import { EmptyState, Flash, Money, PageHeader } from "@/components/ui";
import { first } from "@/lib/validation";

export const metadata: Metadata = { title: "Your services" };
export const dynamic = "force-dynamic";

export default async function Services({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams; const { profile } = await requireArtisan(); await connectDb();
  const [services, cats] = await Promise.all([profile ? Service.find({ artisan: profile._id }).sort({ createdAt: -1 }).lean() : [], getCategories()]);
  return (<><Flash ok={first(sp.ok)} error={first(sp.error)} /><PageHeader title="Your services" intro="You set the prices. We never change them." />
    {services.length === 0 ? <EmptyState title="No services yet" body="Add what you offer, with a price or a quote option. Customers can only book listed services." /> : (
      <ul className="mb-8 space-y-3">{services.map((s) => (
        <li key={String(s._id)} className="panel flex flex-wrap items-center justify-between gap-3"><div><p className="font-display text-lg font-bold">{s.title} {!s.active && <span className="ml-2 rounded bg-ink-100 px-2 py-0.5 text-xs">Hidden</span>}</p>
          <p className="text-sm text-ink-500">{s.pricingModel === "quote" ? "Quote-based" : <>{s.pricingModel === "starting_from" ? "From " : ""}<Money kobo={s.priceKobo} /></>} · {s.durationMinutes} min</p></div>
          <div className="flex gap-2"><Link href={`/artisan/services/${s._id}`} className="btn btn-ghost btn-sm">Edit</Link>
            <form action={toggleServiceAction}><input type="hidden" name="serviceId" value={String(s._id)} /><button className="btn btn-ghost btn-sm">{s.active ? "Hide" : "Show"}</button></form></div></li>))}</ul>)}
    <h2 className="mb-3 text-xl font-bold">Add a service</h2>
    {cats.length === 0 ? <p className="rounded-lg bg-sun-100 p-3 text-sun-700">No categories exist yet. An admin must add categories first.</p> : <ServiceForm categories={cats} />}</>);
}
