import type { Metadata } from "next";
import { connectDb } from "@/lib/db";
import { Payment } from "@/models/payment";
import { Payout } from "@/models/misc";
import { ArtisanProfile } from "@/models/artisan-profile";
import { markPayoutPaidAction } from "@/server/actions/admin";
import { EmptyState, Flash, Money, PageHeader, dateOnly, dateTime } from "@/components/ui";
import { first } from "@/lib/validation";

export const metadata: Metadata = { title: "Payments and payouts" };
export const dynamic = "force-dynamic";

export default async function AdminPayments({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams; await connectDb();
  const [payouts, payments] = await Promise.all([
    Payout.find({ status: { $in: ["due", "withheld"] } }).sort({ payableAfter: 1 }).limit(100).lean(),
    Payment.find({ $or: [{ status: "success" }, { status: "failed" }] }).sort({ updatedAt: -1 }).limit(50).lean(),
  ]);
  const profiles = await ArtisanProfile.find({ _id: { $in: payouts.map((p) => p.artisan) } }).select("displayName payoutBankName payoutAccountName payoutAccountNumber").lean();
  const byId = new Map(profiles.map((p) => [String(p._id), p]));
  // payoutAccountNumber is select:false, so fetch explicitly for admins only
  const withAcct = new Map((await ArtisanProfile.find({ _id: { $in: payouts.map((p) => p.artisan) } }).select("+payoutAccountNumber").lean()).map((p) => [String(p._id), p.payoutAccountNumber]));
  const failedRefunds = payments.flatMap((p) => p.refunds.filter((r) => r.status === "failed").map((r) => ({ p, r })));
  return (<><Flash ok={first(sp.ok)} error={first(sp.error)} /><PageHeader title="Payments and payouts" intro="Artisan payouts are sent manually from your bank, then recorded here. Nothing is marked paid until you enter the transfer reference." />
    <h2 className="mb-3 text-xl font-bold">Payouts owed to artisans</h2>
    {payouts.length === 0 ? <EmptyState title="No payouts owed" body="Payouts appear here when jobs are completed." /> : (
      <div className="table-wrap"><table><thead><tr><th>Artisan and bank</th><th>Amount</th><th>Status</th><th>Mark as paid</th></tr></thead><tbody>
        {payouts.map((p) => { const a = byId.get(String(p.artisan)); const ready = p.status === "due" && (!p.payableAfter || p.payableAfter <= new Date()); return (
          <tr key={String(p._id)}><td><strong>{a?.displayName}</strong><br /><span className="text-xs text-ink-500">{a?.payoutBankName ? `${a.payoutBankName} · ${withAcct.get(String(p.artisan)) ?? ""} · ${a.payoutAccountName}` : "No bank details yet"}</span></td><td><Money kobo={p.amountKobo} /></td>
            <td className="capitalize">{p.status}{p.payableAfter && p.payableAfter > new Date() ? <><br /><span className="text-xs text-ink-500">payable {dateOnly(p.payableAfter)}</span></> : null}</td>
            <td>{ready ? <form action={markPayoutPaidAction} className="flex gap-1"><input type="hidden" name="payoutId" value={String(p._id)} /><label className="sr-only" htmlFor={`t${p._id}`}>Transfer reference</label><input id={`t${p._id}`} name="transferReference" required className="input !min-h-[36px] !py-1" placeholder="Bank transfer ref" /><button className="btn btn-primary btn-sm">Paid</button></form> : <span className="text-xs text-ink-500">{p.status === "withheld" ? "On hold: dispute" : "Not payable yet"}</span>}</td></tr>); })}</tbody></table></div>)}
    {failedRefunds.length > 0 && <><h2 className="mb-3 mt-8 text-xl font-bold text-pepper-700">Refunds that need attention</h2><ul className="space-y-2">{failedRefunds.map(({ p, r }, i) => <li key={i} className="panel border-pepper-600/30"><Money kobo={r.amountKobo} /> for payment {p.reference}: {r.reason}. Refund it from the Paystack dashboard, then keep a note in the audit trail.</li>)}</ul></>}
    <h2 className="mb-3 mt-8 text-xl font-bold">Recent customer payments</h2>
    <div className="table-wrap"><table><thead><tr><th>Reference</th><th>Amount</th><th>Provider</th><th>Status</th><th>When</th><th>Refunds</th></tr></thead><tbody>
      {payments.map((p) => <tr key={String(p._id)}><td className="text-xs">{p.reference}</td><td><Money kobo={p.amountKobo} /></td><td>{p.provider}</td><td className="capitalize">{p.status}</td><td>{p.paidAt ? dateTime(p.paidAt) : "-"}</td><td>{p.refunds.length ? p.refunds.map((r) => `${r.status}`).join(", ") : "-"}</td></tr>)}</tbody></table></div></>);
}
