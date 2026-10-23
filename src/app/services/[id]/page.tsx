import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { connectDb } from "../../../lib/db";
import { getCurrentUser } from "../../../lib/auth/server";
import { getSettings } from "../../../lib/settings";
import { Service } from "../../../models/service";
import { ServiceCategory } from "../../../models/service";
import { ArtisanProfile } from "../../../models/artisan-profile";
import { SlotReservation } from "../../../models/booking";
import { User } from "../../../models/user";
import { bucketsFor, localParts, openSlots } from "../../../domain/availability";
import { computeBreakdown } from "../../../domain/pricing";
import { objectId, first } from "../../../lib/validation";
import { toWindows } from "../../../server/booking/windows";
import { createBookingAction } from "../../../server/actions/booking";
import { toggleSavedArtisanAction } from "../../../server/actions/customer";
import { Flash, Field, TextArea, PriceBreakdown, Rating, VerifiedBadge, Money } from "../../../components/ui";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Service details" };

export default async function ServicePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { id } = await params; const sp = await searchParams;
  if (!objectId.safeParse(id).success) notFound();
  await connectDb();
  const service = await Service.findById(id).lean();
  if (!service || !service.active) notFound();
  const [artisan, category, settings, user] = await Promise.all([ArtisanProfile.findById(service.artisan).lean(), ServiceCategory.findById(service.category).lean(), getSettings(), getCurrentUser()]);
  if (!artisan) notFound();
  const owner = await User.findById(artisan.user).select("status").lean();
  if (owner?.status !== "active") notFound();

  const tomorrow = localParts(new Date(Date.now() + 86_400_000)).ymd;
  const dateParam = first(sp.date);
  const ymd = dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam) ? dateParam : tomorrow;
  const today = localParts(new Date()).ymd, maxDate = localParts(new Date(Date.now() + 45 * 86_400_000)).ymd;
  const dayStart = Date.parse(`${ymd}T00:00:00Z`) - 3_600_000;
  const first_ = Math.floor(dayStart / 1_800_000), last = Math.floor((dayStart + 86_400_000) / 1_800_000);
  const now = new Date();
  const taken = await SlotReservation.find({ artisan: artisan._id, bucket: { $gte: first_, $lte: last }, $or: [{ holdExpiresAt: { $exists: false } }, { holdExpiresAt: { $gt: now } }] }).select("bucket").lean();
  const slots = ymd < today || ymd > maxDate || artisan.paused ? [] : openSlots({ ymd, durationMinutes: service.durationMinutes, windows: toWindows(artisan.workingWindows), blackoutDates: [...(artisan.blackoutDates ?? [])], takenBuckets: new Set(taken.map((t) => t.bucket)) });
  void bucketsFor;

  const breakdown = service.pricingModel !== "quote" && service.priceKobo ? computeBreakdown(service.priceKobo, service.travelKobo ?? 0, settings) : null;
  const saved = user?.role === "customer" && user.savedArtisans?.some((a) => String(a) === String(artisan._id));
  const backHere = `/services/${id}`;

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <Flash ok={first(sp.ok)} error={first(sp.error)} />
      <p className="text-sm text-ink-500"><Link href="/services" className="underline">All services</Link>{category && <> / {category.name}</>}</p>
      <div className="mt-3 grid gap-8 lg:grid-cols-[1fr_380px]">
        <div>
          <h1 className="text-3xl font-bold">{service.title}</h1>
          <div className="mt-3 flex flex-wrap items-center gap-3"><VerifiedBadge status={artisan.verificationStatus} /><Rating avg={artisan.ratingAvg ?? 0} count={artisan.ratingCount ?? 0} />{artisan.completedJobs ? <span className="text-sm text-ink-500">{artisan.completedJobs} jobs completed</span> : null}</div>
          {service.description && <p className="prose-page mt-5 whitespace-pre-line">{service.description}</p>}
          <dl className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3">
            <div className="panel"><dt className="text-sm text-ink-500">Pricing</dt><dd className="font-bold">{service.pricingModel === "fixed" ? "Fixed price" : service.pricingModel === "starting_from" ? "Starting price" : "Quote after you describe the job"}</dd></div>
            <div className="panel"><dt className="text-sm text-ink-500">Usual duration</dt><dd className="font-bold">{service.durationMinutes >= 60 ? `${Math.round(service.durationMinutes / 30) / 2} hours` : `${service.durationMinutes} minutes`}</dd></div>
            <div className="panel"><dt className="text-sm text-ink-500">Areas served</dt><dd className="font-bold">{artisan.serviceAreas?.length ? artisan.serviceAreas.map((a) => a.split("/").pop()!.replace(/-/g, " ")).join(", ") : "Not set yet"}</dd></div>
          </dl>
          <div className="panel mt-6">
            <p className="font-semibold">Offered by <Link className="underline" href={`/artisans/${artisan.slug}`}>{artisan.displayName}</Link></p>
            {artisan.bio && <p className="mt-1 line-clamp-3 text-ink-500">{artisan.bio}</p>}
            {user?.role === "customer" && (
              <form action={toggleSavedArtisanAction} className="mt-3"><input type="hidden" name="artisanId" value={String(artisan._id)} /><input type="hidden" name="back" value={backHere} /><button className="btn btn-ghost btn-sm">{saved ? "Remove from saved" : "Save this artisan"}</button></form>
            )}
          </div>
        </div>

        <aside className="panel h-fit lg:sticky lg:top-4">
          <p className="font-display text-2xl font-bold">{service.pricingModel === "quote" ? "Request a quote" : <>{service.pricingModel === "starting_from" && <span className="text-base font-normal text-ink-500">from </span>}<Money kobo={service.priceKobo} /></>}</p>
          {breakdown && <div className="mt-3"><PriceBreakdown p={breakdown} /><p className="hint">{service.pricingModel === "starting_from" ? "The artisan confirms the final price before you pay." : "This is what you pay. No hidden extras."}</p></div>}
          {service.pricingModel === "quote" && <p className="hint">Describe the job. The artisan sends a price, and you pay only if you approve it.</p>}

          {!user ? (
            <div className="mt-5"><Link className="btn btn-primary w-full" href={`/login?next=${encodeURIComponent(backHere)}`}>Log in to book</Link><p className="hint text-center">New here? <Link className="underline" href="/register">Create a free account</Link></p></div>
          ) : user.role !== "customer" ? (
            <p className="mt-5 rounded-lg bg-ink-50 p-3 text-sm text-ink-500">You're signed in as {user.role === "artisan" ? "an artisan" : "an admin"}. Use a customer account to book.</p>
          ) : (
            <>
              <form method="get" className="mt-5 flex items-end gap-2">
                <div className="flex-1"><label htmlFor="date" className="label">Date</label><input id="date" type="date" name="date" min={today} max={maxDate} defaultValue={ymd} className="input" /></div>
                <button className="btn btn-ghost">Check</button>
              </form>
              <form action={createBookingAction} className="mt-4 space-y-4">
                <input type="hidden" name="serviceId" value={id} />
                <fieldset>
                  <legend className="label">Pick a start time</legend>
                  {slots.length === 0 ? <p className="rounded-lg bg-ink-50 p-3 text-sm text-ink-500">No free times on this date. Try another day.</p> : (
                    <div className="grid grid-cols-3 gap-2">
                      {slots.map((s) => (
                        <label key={s.toISOString()} className="cursor-pointer">
                          <input type="radio" name="startsAt" value={s.toISOString()} required className="peer sr-only" />
                          <span className="block rounded-md border border-ink-200 py-2 text-center text-sm font-semibold peer-checked:border-ink-700 peer-checked:bg-ink-700 peer-checked:text-white peer-focus-visible:outline peer-focus-visible:outline-2">{s.toLocaleTimeString("en-NG", { timeZone: "Africa/Lagos", hour: "numeric", minute: "2-digit" })}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </fieldset>
                <Field label="Street address" name="line1" required defaultValue={user.savedAddresses?.[0]?.line1 ?? ""} autoComplete="street-address" />
                <Field label="Area / neighbourhood" name="area" required defaultValue={user.savedAddresses?.[0]?.area ?? ""} />
                <Field label="Nearest landmark (optional)" name="landmark" />
                <TextArea label="Describe the job" name="notes" hint={service.pricingModel === "quote" ? "The more detail you give, the more accurate the quote." : "Anything the artisan should know before arriving."} />
                <button className="btn btn-primary w-full" disabled={slots.length === 0}>{service.pricingModel === "quote" ? "Request a quote" : "Send booking request"}</button>
                <p className="hint">You don't pay yet. Payment opens after the artisan accepts.</p>
              </form>
            </>
          )}
        </aside>
      </div>
    </main>
  );
}
