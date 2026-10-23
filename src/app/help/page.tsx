import type { Metadata } from "next";
import Link from "next/link";
export const metadata: Metadata = { title: "Help and contact" };
export default function Page() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="text-3xl font-bold sm:text-4xl">Help and contact</h1>
      <div className="prose-page mt-4">
<h2>Common problems</h2><ul><li><strong>I did not get a verification email:</strong> check your spam folder, then use the resend button on your dashboard.</li><li><strong>The artisan has not replied:</strong> requests expire after 12 hours and your slot is released. Choose another artisan.</li><li><strong>I paid but my booking is not confirmed:</strong> refresh your booking page. If it still shows awaiting payment after a few minutes, contact support with your booking reference.</li><li><strong>The artisan did not show up:</strong> open the booking and use "Report a problem".</li></ul><h2>Contact us</h2><p>Message us on WhatsApp using the button in the footer when it is shown, or use the contact details published by the platform operator.</p>
      </div>
    </main>
  );
}
