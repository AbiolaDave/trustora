import type { Metadata } from "next";
import Link from "next/link";
export const metadata: Metadata = { title: "Trust and verification" };
export default function Page() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="text-3xl font-bold sm:text-4xl">Trust and verification</h1>
      <div className="prose-page mt-4">
<h2>What "ID verified" means</h2><p>An artisan uploads a government-issued ID and a selfie. Our team reviews them. Only after approval does the badge appear. Until then the profile says "Not yet verified".</p><p>Verification confirms identity. It is not a guarantee of workmanship, which is why we also show real reviews from completed jobs.</p><h2>Reviews</h2><p>Only the customer of a completed booking can review it, once. Suspicious reviews can be reported and are checked by our team. We never write or edit reviews.</p><h2>Your payments and data</h2><p>Card details are handled by our payment provider and never touch our servers. ID documents are stored privately and visible only to the artisan and our verification team.</p><h2>If something goes wrong</h2><p>You can report a problem from your booking page. Both sides add their account, and our team decides fairly. Read the <Link href="/legal/disputes">dispute policy</Link>.</p>
      </div>
    </main>
  );
}
