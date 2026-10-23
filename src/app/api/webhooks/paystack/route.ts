import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { connectDb } from "@/lib/db";
import { isValidPaystackSignature } from "@/domain/webhook";
import { settleVerifiedCharge } from "@/server/booking/settle-payment";
import { Booking } from "@/models/booking";
import { Payment } from "@/models/payment";
import { ArtisanProfile } from "@/models/artisan-profile";
import { notify } from "@/lib/notify";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const raw = await req.text(); // signature is over the RAW body
  if (!isValidPaystackSignature(raw, req.headers.get("x-paystack-signature"), env.PAYSTACK_SECRET_KEY ?? "")) {
    return new NextResponse("invalid signature", { status: 401 });
  }
  let event: { event?: string; data?: { id?: number; status: string; reference: string; amount: number; currency: string } };
  try { event = JSON.parse(raw); } catch { return new NextResponse("bad json", { status: 400 }); }
  if (event.event === "charge.success" && event.data) {
    await connectDb();
    const result = await settleVerifiedCharge(event.data, event.data.id ? `paystack:${event.data.id}` : undefined);
    if (result.outcome === "confirmed") {
      const pay = await Payment.findOne({ reference: event.data.reference }).select("booking").lean();
      const b = pay && (await Booking.findById(pay.booking).select("customer artisan").lean());
      if (b) {
        const a = await ArtisanProfile.findById(b.artisan).select("user").lean();
        await notify(b.customer, "Payment received", "Your booking is confirmed.", `/dashboard/bookings/${pay!.booking}`);
        if (a) await notify(a.user, "Booking confirmed", "The customer has paid. The job is confirmed.", `/artisan/bookings/${pay!.booking}`);
      }
    }
    if (result.outcome === "rejected") console.warn("[webhook] rejected charge", event.data.reference, result.reason);
  }
  return NextResponse.json({ received: true }); // always 200 for valid signatures so Paystack stops retrying
}
