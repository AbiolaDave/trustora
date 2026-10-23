import type { Metadata } from "next";
import { requireArtisan } from "@/lib/auth/server";
import { submitVerificationAction } from "@/server/actions/artisan";
import { Flash, PageHeader, VerifiedBadge } from "@/components/ui";
import { first } from "@/lib/validation";

export const metadata: Metadata = { title: "Verification" };
export const dynamic = "force-dynamic";

export default async function Verification({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams; const { profile } = await requireArtisan();
  const st = profile?.verificationStatus ?? "unverified";
  return (<><Flash ok={first(sp.ok)} error={first(sp.error)} /><PageHeader title="Verification" intro="Verified artisans get the ID verified badge and win more bookings." />
    <div className="panel mb-6"><p className="mb-2 text-sm text-ink-500">Current status</p><VerifiedBadge status={st} />
      <p className="mt-3 text-[15px]">{st === "pending_review" ? "Your documents are with our team. We usually reply within 2 working days." : st === "verified" ? "You're verified. The badge shows on your profile and search results." : st === "rejected" ? `Your application needs changes: ${profile?.rejectionReason ?? "see our message"}. Fix it and submit again.` : "Upload a clear photo of a valid ID and a selfie holding it."}</p></div>
    {(st === "unverified" || st === "rejected") && (
      <form action={submitVerificationAction} encType="multipart/form-data" className="panel max-w-lg space-y-4">
        <div><label htmlFor="idKind" className="label">Which ID?</label><select id="idKind" name="idKind" className="input" required defaultValue=""><option value="" disabled>Choose…</option><option value="national_id">National ID / NIN slip</option><option value="drivers_license">Driver's licence</option><option value="voters_card">Voter's card</option><option value="passport">International passport</option></select></div>
        <div><label htmlFor="idFile" className="label">Photo or scan of your ID</label><input id="idFile" name="idFile" type="file" accept="image/jpeg,image/png,image/webp,application/pdf" required className="input" /></div>
        <div><label htmlFor="selfie" className="label">Selfie holding your ID</label><input id="selfie" name="selfie" type="file" accept="image/jpeg,image/png,image/webp" required className="input" /></div>
        <p className="hint">Files are stored privately. Only you and our verification team can open them. Maximum 5 MB each.</p>
        <button className="btn btn-primary">Submit for review</button></form>)}</>);
}
