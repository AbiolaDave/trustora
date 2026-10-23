import type { Metadata } from "next";
import Link from "next/link";
export const metadata: Metadata = { title: "Pricing and fees" };
export default function Page() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="text-3xl font-bold sm:text-4xl">Pricing and fees</h1>
      <div className="prose-page mt-4">
<h2>What you see is what you pay</h2><p>Every price is split into the artisan's service charge, any travel charge, and any booking fee, and the total is shown before you pay.</p><h2>Three ways services are priced</h2><ul><li><strong>Fixed price:</strong> the price is known before you book.</li><li><strong>Starting from:</strong> the artisan confirms the final price before you pay.</li><li><strong>Request a quote:</strong> the artisan quotes after reading your description. You pay only if you approve.</li></ul><h2>Platform fees</h2><p>Fees are set by the platform and always shown in the price breakdown. Right now there is no commission and no customer booking fee. If this changes, it will be shown clearly at checkout and in this page.</p>
      </div>
    </main>
  );
}
