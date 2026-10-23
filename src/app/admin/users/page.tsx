import type { Metadata } from "next";
import { connectDb } from "@/lib/db";
import { User } from "@/models/user";
import { ArtisanProfile } from "@/models/artisan-profile";
import { featureArtisanAction, setUserStatusAction } from "@/server/actions/admin";
import { Flash, PageHeader, VerifiedBadge, dateOnly } from "@/components/ui";
import { escapeRegex, first } from "@/lib/validation";

export const metadata: Metadata = { title: "Users" };
export const dynamic = "force-dynamic";

export default async function Users({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams; await connectDb();
  const q = (first(sp.q) ?? "").trim().slice(0, 60); const role = first(sp.role);
  const filter: Record<string, unknown> = {};
  if (q) filter.$or = [{ name: { $regex: escapeRegex(q), $options: "i" } }, { email: { $regex: escapeRegex(q), $options: "i" } }];
  if (role === "customer" || role === "artisan" || role === "admin") filter.role = role;
  const users = await User.find(filter).sort({ createdAt: -1 }).limit(100).lean();
  const profiles = new Map((await ArtisanProfile.find({ user: { $in: users.map((u) => u._id) } }).select("user verificationStatus featuredUntil").lean()).map((p) => [String(p.user), p]));
  return (<><Flash ok={first(sp.ok)} error={first(sp.error)} /><PageHeader title="Users" />
    <form className="mb-4 flex flex-wrap gap-2"><input name="q" defaultValue={q} className="input max-w-xs" placeholder="Search name or email" aria-label="Search" />
      <select name="role" defaultValue={role ?? ""} className="input max-w-[160px]" aria-label="Role"><option value="">All roles</option><option value="customer">Customers</option><option value="artisan">Artisans</option><option value="admin">Admins</option></select><button className="btn btn-ghost">Filter</button></form>
    <div className="table-wrap"><table><thead><tr><th>Name</th><th>Role</th><th>Joined</th><th>Status</th><th>Actions</th></tr></thead><tbody>
      {users.map((u) => { const p = profiles.get(String(u._id)); return (
        <tr key={String(u._id)}><td><strong>{u.name}</strong><br /><span className="text-xs text-ink-500">{u.email}</span></td><td className="capitalize">{u.role}{p && <><br /><VerifiedBadge status={p.verificationStatus} /></>}</td><td>{dateOnly(u.createdAt)}</td><td className="capitalize">{u.status}</td>
          <td><div className="flex flex-wrap gap-2">
            {u.role !== "admin" && <form action={setUserStatusAction}><input type="hidden" name="userId" value={String(u._id)} /><input type="hidden" name="status" value={u.status === "active" ? "suspended" : "active"} /><button className={`btn btn-sm ${u.status === "active" ? "btn-danger" : "btn-ghost"}`}>{u.status === "active" ? "Suspend" : "Reactivate"}</button></form>}
            {p && <form action={featureArtisanAction} className="flex gap-1"><input type="hidden" name="profileId" value={String(p._id)} /><label className="sr-only" htmlFor={`f${p._id}`}>Feature days</label><input id={`f${p._id}`} name="days" type="number" min={0} max={365} defaultValue={p.featuredUntil && p.featuredUntil > new Date() ? Math.ceil((p.featuredUntil.getTime() - Date.now()) / 86_400_000) : 0} className="input !min-h-[36px] w-20 !py-1" /><button className="btn btn-ghost btn-sm">Feature (days)</button></form>}
          </div></td></tr>); })}</tbody></table></div></>);
}
