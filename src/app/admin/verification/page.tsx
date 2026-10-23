import type { Metadata } from "next";
import { connectDb } from "../../../lib/db";
import { ArtisanProfile } from "../../../models/artisan-profile";
import { User } from "../../../models/user";
import { verifyArtisanAction } from "../../../server/actions/admin";
import { EmptyState, Flash, PageHeader, dateOnly } from "../../../components/ui";
import { first } from "../../../lib/validation";

export const metadata: Metadata = { title: "Verification queue" };
export const dynamic = "force-dynamic";

export default async function Queue({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams; await connectDb();
  const pending = await ArtisanProfile.find({ verificationStatus: "pending_review" }).sort({ updatedAt: 1 }).lean();
  const users = new Map((await User.find({ _id: { $in: pending.map((p) => p.user) } }).select("name email phone").lean()).map((u) => [String(u._id), u]));
  return (<><Flash ok={first(sp.ok)} error={first(sp.error)} /><PageHeader title="Verification queue" intro="Check that the selfie matches the ID photo, the ID is valid, and the name matches the profile." />
    {pending.length === 0 ? <EmptyState title="Queue is empty" body="New applications appear here when artisans submit their documents." /> : (
      <ul className="space-y-4">{pending.map((p) => { const u = users.get(String(p.user)); return (
        <li key={String(p._id)} className="panel space-y-3"><div><p className="font-display text-lg font-bold">{p.displayName}</p><p className="text-sm text-ink-500">{u?.name} · {u?.email} · {u?.phone} · submitted {dateOnly(p.updatedAt)}</p></div>
          <ul className="flex flex-wrap gap-2">{p.verificationDocs?.map((d) => <li key={d.storageKey}><a className="btn btn-ghost btn-sm" target="_blank" rel="noopener" href={`/api/files/${d.storageKey}`}>{(d.kind ?? "").replace("_", " ")}</a></li>)}</ul>
          <div className="flex flex-wrap items-end gap-3">
            <form action={verifyArtisanAction}><input type="hidden" name="profileId" value={String(p._id)} /><input type="hidden" name="decision" value="approve" /><button className="btn btn-primary">Approve and verify</button></form>
            <form action={verifyArtisanAction} className="flex flex-1 flex-wrap items-end gap-2"><input type="hidden" name="profileId" value={String(p._id)} /><input type="hidden" name="decision" value="reject" />
              <div className="min-w-[200px] flex-1"><label className="label" htmlFor={`rr${p._id}`}>Reason if rejecting</label><input id={`rr${p._id}`} name="reason" className="input" placeholder="e.g. Selfie is blurry" /></div><button className="btn btn-danger">Reject</button></form></div></li>); })}</ul>)}</>);
}
