import type { Metadata } from "next";
import { connectDb } from "../../../lib/db";
import { requireArtisan } from "../../../lib/auth/server";
import { Payout } from "../../../models/misc";
import { ArtisanProfile } from "../../../models/artisan-profile";
import { saveBankAction } from "../../../server/actions/artisan";
import { EmptyState, Field, Flash, Money, PageHeader, dateOnly } from "../../../components/ui";
import { first } from "../../../lib/validation";

export const metadata: Metadata = { title: "Earnings" };
export const dynamic = "force-dynamic";

export default async function Earnings({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams; const { profile } = await requireArtisan(); await connectDb();
  const payouts = profile ? await Payout.find({ artisan: profile._id }).sort({ createdAt: -1 }).limit(100).lean() : [];
  const sum = (st: string) => payouts.filter((p) => p.status === st).reduce((n, p) => n + p.amountKobo, 0);
  const bank = profile ? await ArtisanProfile.findById(profile._id).select("payoutBankName payoutBankLast4 payoutAccountName").lean() : null;
  return (<><Flash ok={first(sp.ok)} error={first(sp.error)} /><PageHeader title="Earnings" intro="Money for completed jobs. Payouts are sent to your bank by our team after a short protection window." />
    <div className="grid gap-3 sm:grid-cols-3">
      <div className="panel"><p className="text-sm text-ink-500">Due to you</p><p className="font-display text-2xl font-bold"><Money kobo={sum("due")} /></p></div>
      <div className="panel"><p className="text-sm text-ink-500">On hold (problem under review)</p><p className="font-display text-2xl font-bold"><Money kobo={sum("withheld")} /></p></div>
      <div className="panel"><p className="text-sm text-ink-500">Paid out</p><p className="font-display text-2xl font-bold"><Money kobo={sum("paid")} /></p></div></div>
    <h2 className="mb-3 mt-8 text-xl font-bold">Payout history</h2>
    {payouts.length === 0 ? <EmptyState title="No earnings yet" body="Completed jobs appear here with what you're owed." /> : (
      <div className="table-wrap"><table><thead><tr><th>Created</th><th>Amount</th><th>Commission taken</th><th>Status</th><th>Payable from</th></tr></thead><tbody>
        {payouts.map((p) => <tr key={String(p._id)}><td>{dateOnly(p.createdAt)}</td><td><Money kobo={p.amountKobo} /></td><td><Money kobo={p.commissionKobo} /></td><td className="capitalize">{p.status}{p.transferReference ? ` · ${p.transferReference}` : ""}</td><td>{p.payableAfter ? dateOnly(p.payableAfter) : "-"}</td></tr>)}</tbody></table></div>)}
    <h2 className="mb-3 mt-8 text-xl font-bold">Bank account for payouts</h2>
    <form action={saveBankAction} className="panel max-w-lg space-y-4">
      {bank?.payoutBankLast4 && <p className="text-[15px]">Saved: {bank.payoutBankName}, account ending {bank.payoutBankLast4} ({bank.payoutAccountName}).</p>}
      <Field label="Bank name" name="bankName" required defaultValue={bank?.payoutBankName ?? ""} /><Field label="Account name" name="accountName" required defaultValue={bank?.payoutAccountName ?? ""} />
      <Field label="Account number (10 digits)" name="accountNumber" required inputMode="numeric" maxLength={10} hint="Only you and platform admins can see this." /><button className="btn btn-primary">Save bank details</button></form></>);
}
