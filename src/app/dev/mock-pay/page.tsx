import { notFound, redirect } from "next/navigation";
import { env } from "@/lib/env";
import { mockMarkPaid } from "@/lib/payments/provider";
import { first } from "@/lib/validation";

export const dynamic = "force-dynamic";

async function simulate(form: FormData) {
  "use server";
  if (env.NODE_ENV === "production" || env.PAYSTACK_SECRET_KEY) return;
  const reference = String(form.get("reference") ?? "");
  mockMarkPaid(reference);
  redirect(`/payments/callback?reference=${encodeURIComponent(reference)}`);
}

export default async function MockPay({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  if (env.NODE_ENV === "production" || env.PAYSTACK_SECRET_KEY) notFound();
  const reference = first((await searchParams).reference) ?? "";
  return (
    <main className="mx-auto max-w-md px-4 py-16">
      <div className="rounded-xl border-2 border-dashed border-sun-500 bg-sun-100 p-6">
        <h1 className="font-display text-2xl font-bold text-sun-700">Sandbox payment (development only)</h1>
        <p className="mt-2 text-sm text-sun-700">No Paystack key is set, so no real payment happens. This page stands in for Paystack so you can test the booking flow. It disappears in production or once PAYSTACK_SECRET_KEY is set.</p>
        <p className="mt-3 break-all text-xs text-sun-700">Reference: {reference}</p>
        <form action={simulate} className="mt-5">
          <input type="hidden" name="reference" value={reference} />
          <button className="btn btn-primary w-full">Simulate successful payment</button>
        </form>
      </div>
    </main>
  );
}
