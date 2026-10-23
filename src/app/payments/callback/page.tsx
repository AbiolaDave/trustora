import { redirect } from "next/navigation";
import { connectDb } from "@/lib/db";
import { requireUser } from "@/lib/auth/server";
import { getPaymentProvider } from "@/lib/payments/provider";
import { Payment } from "@/models/payment";
import { settleVerifiedCharge } from "@/server/booking/settle-payment";
import { Booking } from "@/models/booking";
import { ArtisanProfile } from "@/models/artisan-profile";
import { notify } from "@/lib/notify";
import { first } from "@/lib/validation";

export const dynamic = "force-dynamic";

/** Where the customer lands after paying. We do NOT trust the URL: we ask the provider directly. */
export default async function PaymentCallback({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requireUser(["customer"]);
  const sp = await searchParams;
  const reference = first(sp.reference) ?? first(sp.trxref) ?? "";
  await connectDb();
  const payment = await Payment.findOne({ reference, customer: user._id }); // can only verify your own payment
  if (!payment) redirect("/dashboard/bookings?error=Payment not found.");
  const charge = await getPaymentProvider().verify(reference).catch(() => null);
  if (!charge) redirect(`/dashboard/bookings/${payment.booking}?error=We couldn't confirm your payment yet. If you were charged, it will update shortly.`);
  const result = await settleVerifiedCharge(charge);
  if (result.outcome === "confirmed") {
    const b = await Booking.findById(payment.booking).select("artisan").lean();
    const a = b && (await ArtisanProfile.findById(b.artisan).select("user").lean());
    if (a) await notify(a.user, "Booking confirmed", "The customer has paid. The job is confirmed.", `/artisan/bookings/${payment.booking}`);
    redirect(`/dashboard/bookings/${payment.booking}?ok=Payment received. Your booking is confirmed.`);
  }
  if (result.outcome === "already_processed") redirect(`/dashboard/bookings/${payment.booking}?ok=Payment received.`);
  if (result.outcome === "paid_but_booking_unavailable") redirect(`/dashboard/bookings/${payment.booking}?error=Your payment arrived after the booking expired. It will be refunded.`);
  redirect(`/dashboard/bookings/${payment.booking}?error=Payment was not completed.`);
}
