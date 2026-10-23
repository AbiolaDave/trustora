import type { Metadata } from "next";
import Link from "next/link";
export const metadata: Metadata = { title: "How it works" };
export default function Page() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="text-3xl font-bold sm:text-4xl">How it works</h1>
      <div className="prose-page mt-4">
<h2>For customers</h2><ul><li>Search by service and area, then compare prices, ratings and verification status.</li><li>Pick a free time slot and describe the job. Add photos on your booking page.</li><li>The artisan accepts, or sends a quote if the job needs inspection. You approve any quote before paying.</li><li>Pay securely online to confirm your slot.</li><li>After the job, confirm it is complete and leave a review. If something went wrong, report it instead.</li></ul><h2>For artisans</h2><ul><li>Create a profile, add your services and prices, and set your working hours and areas.</li><li>Upload your ID for verification. The badge appears once our team approves it.</li><li>Accept or decline requests. Customers pay before the job, so you know it is real.</li><li>Earnings are recorded for every completed job. See <Link href="/pricing">Pricing and fees</Link>.</li></ul>
      </div>
    </main>
  );
}
