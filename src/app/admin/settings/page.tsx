import type { Metadata } from "next";
import { connectDb } from "../../../lib/db";
import { getSettings } from "../../../lib/settings";
import { Location } from "../../../models/misc";
import { koboToNaira } from "../../../lib/money";
import { saveLocationAction, saveSettingsAction } from "../../../server/actions/admin";
import { Field, Flash, PageHeader } from "../../../components/ui";
import { first } from "../../../lib/validation";

export const metadata: Metadata = { title: "Fees and settings" };
export const dynamic = "force-dynamic";

export default async function Settings({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams; await connectDb();
  const s = await getSettings();
  const locs = await Location.find().sort({ state: 1, city: 1, name: 1 }).lean();
  const tiers = [...s.cancelTiers].sort((a, b) => b.minHoursBeforeStart - a.minHoursBeforeStart);
  return (<><Flash ok={first(sp.ok)} error={first(sp.error)} /><PageHeader title="Fees and settings" intro="Changes apply to new bookings only. Every change is written to the audit log." />
    <form action={saveSettingsAction} className="panel max-w-2xl space-y-6">
      <fieldset className="space-y-3"><legend className="text-lg font-bold">Fees</legend>
        <div className="grid gap-4 sm:grid-cols-2"><Field label="Commission from artisans (%)" name="commission" type="number" step="0.01" min={0} max={100} defaultValue={s.commissionBps / 100} hint="Taken from the artisan's service charge on each completed job. 0 = no commission." /><Field label="Customer booking fee (%)" name="customerFee" type="number" step="0.01" min={0} max={100} defaultValue={s.customerFeeBps / 100} hint="Added to the customer's total. 0 = none." /></div>
        <div className="grid gap-4 sm:grid-cols-2"><Field label="Flat booking fee (₦)" name="customerFeeFlat" inputMode="decimal" defaultValue={koboToNaira(s.customerFeeFlatKobo)} /><Field label="Booking fee cap (₦, optional)" name="customerFeeCap" inputMode="decimal" defaultValue={s.customerFeeCapKobo ? koboToNaira(s.customerFeeCapKobo) : ""} /></div></fieldset>
      <fieldset className="space-y-3"><legend className="text-lg font-bold">Customer cancellation refunds</legend><p className="text-sm text-ink-500">Three tiers, longest notice first. Artisan and admin cancellations always refund in full.</p>
        {[0, 1, 2].map((i) => <div key={i} className="grid grid-cols-2 gap-3"><Field label={`Tier ${i + 1}: hours before start (at least)`} name={`tierHours${i}`} type="number" min={0} defaultValue={tiers[i]?.minHoursBeforeStart ?? 0} /><Field label="Refund (%)" name={`tierPct${i}`} type="number" min={0} max={100} step="1" defaultValue={(tiers[i]?.refundBps ?? 0) / 100} /></div>)}</fieldset>
      <Field label="Launch states or cities (comma separated)" name="launchCities" defaultValue={s.launchCities.join(", ")} hint="Only areas in these appear in search. Example: ogun, lagos" />
      <button className="btn btn-primary">Save settings</button></form>
    <h2 className="mb-3 mt-10 text-xl font-bold">Service areas</h2>
    <div className="table-wrap mb-4"><table><thead><tr><th>State</th><th>City</th><th>Area</th></tr></thead><tbody>{locs.map((l) => <tr key={l.slug}><td className="capitalize">{l.state}</td><td className="capitalize">{l.city.replace(/-/g, " ")}</td><td>{l.name}</td></tr>)}</tbody></table></div>
    <form action={saveLocationAction} className="panel grid max-w-2xl gap-3 sm:grid-cols-4"><Field label="State" name="state" required placeholder="Ogun" /><Field label="City" name="city" required placeholder="Abeokuta" /><Field label="Area" name="name" required placeholder="Kuto" /><div className="flex items-end"><button className="btn btn-primary w-full">Add area</button></div></form></>);
}
