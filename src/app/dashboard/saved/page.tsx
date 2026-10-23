import Link from "next/link";
import type { Metadata } from "next";
import { connectDb } from "@/lib/db";
import { requireUser } from "@/lib/auth/server";
import { ArtisanProfile } from "@/models/artisan-profile";
import { toggleSavedArtisanAction } from "@/server/actions/customer";
import { EmptyState, Flash, PageHeader, Rating, VerifiedBadge } from "@/components/ui";
import { first } from "@/lib/validation";

export const metadata: Metadata = { title: "Saved artisans" };
export const dynamic = "force-dynamic";

export default async function Saved({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams; const user = await requireUser(["customer"]); await connectDb();
  const artisans = await ArtisanProfile.find({ _id: { $in: user.savedArtisans ?? [] } }).lean();
  return (<><Flash ok={first(sp.ok)} error={first(sp.error)} /><PageHeader title="Saved artisans" intro="Artisans you want to book again." />
    {artisans.length === 0 ? <EmptyState title="Nothing saved yet" body="Tap “Save this artisan” on a service page to keep them here for quick rebooking." href="/services" cta="Find a service" /> : (
      <ul className="grid gap-3 sm:grid-cols-2">{artisans.map((a) => (
        <li key={String(a._id)} className="panel"><Link href={`/artisans/${a.slug}`} className="font-display text-lg font-bold hover:underline">{a.displayName}</Link>
          <div className="mt-2 flex flex-wrap items-center gap-2"><VerifiedBadge status={a.verificationStatus} /><Rating avg={a.ratingAvg ?? 0} count={a.ratingCount ?? 0} /></div>
          <div className="mt-3 flex gap-2"><Link href={`/artisans/${a.slug}`} className="btn btn-primary btn-sm">Book again</Link>
            <form action={toggleSavedArtisanAction}><input type="hidden" name="artisanId" value={String(a._id)} /><input type="hidden" name="back" value="/dashboard/saved" /><button className="btn btn-ghost btn-sm">Remove</button></form></div></li>))}</ul>)}</>);
}
