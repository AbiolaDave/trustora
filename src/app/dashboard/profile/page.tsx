import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/server";
import { addAddressAction, removeAddressAction, saveCustomerProfileAction } from "@/server/actions/customer";
import { Field, Flash, PageHeader } from "@/components/ui";
import { first } from "@/lib/validation";

export const metadata: Metadata = { title: "Your profile" };
export const dynamic = "force-dynamic";

export default async function Profile({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams; const user = await requireUser(["customer"]);
  return (<><Flash ok={first(sp.ok)} error={first(sp.error)} /><PageHeader title="Profile" />
    <div className="grid gap-6 md:grid-cols-2">
      <form action={saveCustomerProfileAction} className="panel space-y-4"><h2 className="text-lg font-bold">Your details</h2>
        <Field label="Full name" name="name" defaultValue={user.name} required /><Field label="Phone" name="phone" type="tel" defaultValue={user.phone ?? ""} required />
        <div><p className="label">Email</p><p>{user.email} {user.emailVerifiedAt ? "(verified)" : "(not verified)"}</p></div><button className="btn btn-primary">Save</button></form>
      <div className="panel space-y-4"><h2 className="text-lg font-bold">Saved addresses</h2>
        {user.savedAddresses?.length ? <ul className="space-y-2">{user.savedAddresses.map((a) => <li key={String(a._id)} className="flex items-center justify-between gap-2 rounded-lg bg-ink-50 p-3 text-[15px]"><span><strong>{a.label}</strong><br />{a.line1}, {a.area}</span>
          <form action={removeAddressAction}><input type="hidden" name="addressId" value={String(a._id)} /><button className="btn btn-ghost btn-sm">Remove</button></form></li>)}</ul> : <p className="text-sm text-ink-500">No saved addresses. The first one is pre-filled when you book.</p>}
        <form action={addAddressAction} className="space-y-3 border-t border-ink-100 pt-4"><Field label="Label" name="label" placeholder="Home" /><Field label="Street address" name="line1" required /><Field label="Area" name="area" required /><button className="btn btn-ghost">Add address</button></form></div>
    </div></>);
}
