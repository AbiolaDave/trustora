import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { DEFAULT_CUSTOMER_CANCEL_TIERS, POLICY_DEFAULTS } from "../../../domain/policy";
import { getSettings } from "../../../lib/settings";

export const dynamic = "force-dynamic";
const TITLES: Record<string, string> = { terms: "Terms of service", privacy: "Privacy policy", cancellation: "Cancellation and refund policy", disputes: "Dispute policy" };

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  return { title: TITLES[(await params).slug] ?? "Policy" };
}

export default async function Legal({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const title = TITLES[slug];
  if (!title) notFound();
  const tiers = (await getSettings().catch(() => null))?.cancelTiers ?? DEFAULT_CUSTOMER_CANCEL_TIERS;
  const sorted = [...tiers].sort((a, b) => b.minHoursBeforeStart - a.minHoursBeforeStart);
  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="text-3xl font-bold sm:text-4xl">{title}</h1>
      <p className="mt-2 rounded-lg bg-sun-100 p-3 text-sm text-sun-700">Draft for launch. Have a Nigerian lawyer review this page and adapt it to your registered business before going live.</p>
      <div className="prose-page mt-4">
        {slug === "terms" && (<>
          <h2>About this platform</h2><p>We connect customers with independent artisans. Artisans are not our employees. Each booking is an agreement between the customer and the artisan.</p>
          <h2>Accounts</h2><p>You must give accurate information and keep your password private. We may suspend accounts that break these terms.</p>
          <h2>Bookings and payment</h2><p>Prices are set by artisans. Payment is made online through our payment provider to confirm a booking. Do not pay artisans outside the platform for bookings made here, because we can only help with disputes on payments we can see.</p>
          <h2>Conduct</h2><p>Be respectful, be on time, and do not use the platform for anything unlawful.</p>
        </>)}
        {slug === "privacy" && (<>
          <h2>What we collect</h2><p>Your name, email, phone number, addresses you provide for bookings, booking and payment records, and messages about bookings. Artisans also provide ID documents for verification.</p>
          <h2>How we use it</h2><p>To run bookings, take payments, prevent fraud and resolve disputes. We do not sell your data.</p>
          <h2>Who sees what</h2><p>Artisans see the address and notes for their own bookings. ID documents are visible only to the artisan and our verification team. Card details are handled by our payment provider and never stored by us.</p>
          <h2>Your choices</h2><p>You can ask us to correct or delete your data, subject to records we must keep for payments and disputes.</p>
        </>)}
        {slug === "cancellation" && (<>
          <h2>If you cancel (customers)</h2>
          <ul>{sorted.map((t) => <li key={t.minHoursBeforeStart}>{t.minHoursBeforeStart > 0 ? `${t.minHoursBeforeStart} hours or more before the start time` : "Less than that"}: {t.refundBps / 100}% refund</li>)}</ul>
          <p>If you cancel before paying, nothing is charged.</p>
          <h2>If the artisan cancels</h2><p>You are refunded in full.</p>
          <h2>If nobody responds</h2><p>Requests expire after {POLICY_DEFAULTS.artisanResponseHours} hours, quotes after {POLICY_DEFAULTS.quoteApprovalHours} hours, and unpaid accepted bookings after {POLICY_DEFAULTS.paymentHoldMinutes / 60} hours. The slot is released.</p>
          <h2>Refund timing</h2><p>Refunds are sent to your original payment method. Your bank may take several days to show them.</p>
        </>)}
        {slug === "disputes" && (<>
          <h2>When to report a problem</h2><p>No-show, incomplete work, unacceptable quality, a final price different from the agreed price, or a customer refusing to pay under the agreed terms.</p>
          <h2>How it works</h2><ul><li>Open the booking and choose "Report a problem". You can do this until {POLICY_DEFAULTS.disputeWindowHours} hours after a job is marked complete.</li><li>The artisan's payout is held while we review.</li><li>Both sides can add their account. Keep communication inside the booking so we can see it.</li><li>Our team decides to refund the customer or release the job to the artisan, and records the reason.</li></ul>
          <h2>Fairness</h2><p>Decisions are based on the booking record, messages and what each side tells us. Repeated no-shows or false reports can lead to account suspension.</p>
        </>)}
      </div>
    </main>
  );
}
