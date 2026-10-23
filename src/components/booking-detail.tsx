import { connectDb } from "@/lib/db";
import { env } from "@/lib/env";
import { POLICY_DEFAULTS } from "@/domain/policy";
import { User } from "@/models/user";
import { ArtisanProfile } from "@/models/artisan-profile";
import { Dispute, Message, Review } from "@/models/misc";
import { Payment } from "@/models/payment";
import type { BookingDoc } from "@/models/booking";
import { artisanJobAction, artisanRespondAction, customerBookingAction, openDisputeAction, addStatementAction, payBookingAction, reviewAction, sendMessageAction, attachPhotoAction } from "@/server/actions/booking";
import { Money, PriceBreakdown, StatusPill, TextArea, dateTime } from "@/components/ui";
import type { Types } from "mongoose";

type B = BookingDoc & { _id: Types.ObjectId };
const REASONS: [string, string][] = [["no_show", "Artisan didn't show up"], ["incomplete_work", "Work was incomplete"], ["poor_quality", "Quality was unacceptable"], ["price_mismatch", "Final price differed from the agreed price"], ["customer_refused_to_pay", "Customer refused to pay"], ["other", "Something else"]];

function Hidden({ id, op }: { id: Types.ObjectId; op?: string }) {
  return <><input type="hidden" name="bookingId" value={String(id)} />{op && <input type="hidden" name="op" value={op} />}</>;
}

export async function BookingDetail({ b, side }: { b: B; side: "customer" | "artisan" }) {
  await connectDb();
  const [customer, artisan, messages, dispute, review, payment] = await Promise.all([
    User.findById(b.customer).select("name").lean(), ArtisanProfile.findById(b.artisan).select("displayName slug").lean(),
    Message.find({ booking: b._id }).sort({ createdAt: 1 }).lean(), Dispute.findOne({ booking: b._id }).sort({ createdAt: -1 }).lean(),
    Review.findOne({ booking: b._id }).lean(), Payment.findOne({ booking: b._id, status: "success" }).lean(),
  ]);
  const s = b.status;
  const closed = s === "cancelled" || s === "expired";
  const addressVisible = side === "customer" || ["confirmed", "in_progress", "completed", "disputed"].includes(s);
  const inWindow = s === "completed" && b.completedAt && Date.now() - b.completedAt.getTime() < POLICY_DEFAULTS.disputeWindowHours * 3_600_000;
  const canReport = !dispute?.status || dispute.status !== "open" ? (side === "customer" ? ["confirmed", "in_progress"].includes(s) || inWindow : ["confirmed", "in_progress"].includes(s)) : false;
  const path = side === "customer" ? "/dashboard/bookings" : "/artisan/bookings";
  const shareText = encodeURIComponent(`Booking ${b.reference}: ${b.serviceTitle}, ${dateTime(b.startsAt)}. ${env.APP_URL}${path}/${b._id}`);

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
      <div className="space-y-6">
        <section className="panel">
          <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-xl font-bold">{b.serviceTitle}</h2><StatusPill status={s} /></div>
          <dl className="mt-4 grid gap-3 text-[15px] sm:grid-cols-2">
            <div><dt className="text-ink-500">Reference</dt><dd className="font-semibold">{b.reference}</dd></div>
            <div><dt className="text-ink-500">When</dt><dd className="font-semibold">{dateTime(b.startsAt)} · about {Math.round(b.durationMinutes / 30) / 2} hr</dd></div>
            <div><dt className="text-ink-500">{side === "customer" ? "Artisan" : "Customer"}</dt><dd className="font-semibold">{side === "customer" ? artisan?.displayName : customer?.name}</dd></div>
            <div><dt className="text-ink-500">Where</dt><dd className="font-semibold">{addressVisible ? `${b.address?.line1}, ${b.address?.area}` : `${b.address?.area} (full address shown once confirmed)`}{addressVisible && b.address?.landmark ? ` · near ${b.address?.landmark}` : ""}</dd></div>
          </dl>
          {b.notes && <p className="mt-4 whitespace-pre-line rounded-lg bg-ink-50 p-3 text-[15px]">{b.notes}</p>}
          {b.mediaKeys?.length ? <ul className="mt-3 flex flex-wrap gap-2">{b.mediaKeys.map((k, i) => <li key={k}><a className="btn btn-ghost btn-sm" href={`/api/files/${k}`} target="_blank" rel="noopener">Photo {i + 1}</a></li>)}</ul> : null}
          {side === "customer" && !closed && s !== "completed" && (b.mediaKeys?.length ?? 0) < 5 && (
            <form action={attachPhotoAction} encType="multipart/form-data" className="mt-3 flex flex-wrap items-end gap-2"><Hidden id={b._id} />
              <div><label className="label" htmlFor="photo">Add a photo of the problem</label><input id="photo" name="photo" type="file" accept="image/jpeg,image/png,image/webp" className="input" /></div>
              <button className="btn btn-ghost">Upload</button></form>
          )}
        </section>

        {/* -------- actions -------- */}
        {side === "artisan" && s === "pending_artisan_response" && (
          <section className="panel space-y-4"><h3 className="text-lg font-bold">Respond to this request</h3>
            <form action={artisanRespondAction} className="space-y-3"><Hidden id={b._id} />
              <input type="hidden" name="decision" value={b.pricingModel === "quote" ? "quote" : "accept"} />
              {b.pricingModel !== "fixed" && <div><label htmlFor="price" className="label">{b.pricingModel === "quote" ? "Your quote (₦, service charge)" : "Final price (₦, service charge)"}</label><input id="price" name="price" inputMode="decimal" required className="input" /><p className="hint">Travel charge of <Money kobo={b.pricing?.travelKobo ?? 0} /> is added automatically.</p></div>}
              {b.pricingModel === "quote" && <TextArea label="What the quote covers" name="note" />}
              {b.pricingModel === "fixed" && <p className="text-[15px]">Fixed price: <Money kobo={b.pricing?.serviceChargeKobo} /> service charge.</p>}
              <button className="btn btn-primary">{b.pricingModel === "quote" ? "Send quote" : "Accept booking"}</button></form>
            <form action={artisanRespondAction} className="flex flex-wrap items-end gap-2"><Hidden id={b._id} /><input type="hidden" name="decision" value="reject" />
              <div className="flex-1"><label htmlFor="reason" className="label">Can't do it? Say why (optional)</label><input id="reason" name="reason" className="input" /></div><button className="btn btn-danger">Decline</button></form>
          </section>
        )}

        {side === "customer" && s === "awaiting_customer_approval" && (
          <section className="panel space-y-3"><h3 className="text-lg font-bold">Review your quote</h3>
            {b.quoteNote && <p className="whitespace-pre-line rounded-lg bg-ink-50 p-3 text-[15px]">{b.quoteNote}</p>}
            <PriceBreakdown p={b.pricing} />
            <div className="flex flex-wrap gap-2">
              <form action={customerBookingAction}><Hidden id={b._id} op="approve_quote" /><button className="btn btn-primary">Approve quote</button></form>
              <form action={customerBookingAction}><Hidden id={b._id} op="decline_quote" /><button className="btn btn-ghost">Decline</button></form>
            </div></section>
        )}

        {side === "customer" && s === "awaiting_payment" && (
          <section className="panel space-y-3"><h3 className="text-lg font-bold">Pay to confirm your slot</h3>
            <PriceBreakdown p={b.pricing} />
            <form action={payBookingAction}><Hidden id={b._id} /><button className="btn btn-primary w-full sm:w-auto">Pay <Money kobo={b.pricing?.totalKobo} /> securely</button></form>
            {b.expiresAt && <p className="hint">Your slot is held until {dateTime(b.expiresAt)}.</p>}
          </section>
        )}

        {side === "artisan" && s === "confirmed" && (
          <section className="panel space-y-3"><h3 className="text-lg font-bold">Ready for the job</h3><p className="text-[15px] text-ink-500">The customer has paid. Start the job when you arrive.</p>
            <form action={artisanJobAction}><Hidden id={b._id} op="start" /><button className="btn btn-primary">Start job</button></form></section>
        )}
        {side === "artisan" && s === "in_progress" && (
          <section className="panel space-y-3"><h3 className="text-lg font-bold">Finished the work?</h3>
            {b.completionRequestedAt ? <p className="text-[15px]">You asked the customer to confirm on {dateTime(b.completionRequestedAt)}. It confirms automatically after {POLICY_DEFAULTS.autoConfirmCompletionHours} hours.</p> : <form action={artisanJobAction}><Hidden id={b._id} op="request_completion" /><button className="btn btn-primary">Mark work as done</button></form>}</section>
        )}
        {side === "customer" && s === "in_progress" && (
          <section className="panel space-y-3"><h3 className="text-lg font-bold">Is the job done?</h3>
            {b.completionRequestedAt && <p className="text-[15px]">Your artisan says the work is finished. Confirm it, or report a problem below.</p>}
            <form action={customerBookingAction}><Hidden id={b._id} op="confirm_completion" /><button className="btn btn-primary">Yes, confirm completion</button></form></section>
        )}
        {side === "customer" && s === "completed" && (
          <section className="panel space-y-3"><h3 className="text-lg font-bold">{review ? "Your review" : "How did it go?"}</h3>
            {review ? <p><span className="font-semibold text-sun-700">{"★".repeat(review.rating)}</span> {review.comment}</p> : (
              <form action={reviewAction} className="space-y-3"><Hidden id={b._id} />
                <div><label htmlFor="rating" className="label">Rating</label><select id="rating" name="rating" required className="input" defaultValue=""><option value="" disabled>Choose…</option>{[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{n} {n === 1 ? "star" : "stars"}</option>)}</select></div>
                <TextArea label="Comment (optional)" name="comment" /><button className="btn btn-primary">Submit review</button></form>
            )}</section>
        )}

        {/* -------- dispute -------- */}
        {dispute && (
          <section className="panel space-y-3 border-pepper-600/30"><h3 className="text-lg font-bold">Problem report: {dispute.status === "open" ? "under review" : "resolved"}</h3>
            <p className="text-sm text-ink-500">{REASONS.find((r) => r[0] === dispute.reason)?.[1]}</p>
            <ul className="space-y-2">{dispute.statements.map((st, i) => <li key={i} className="rounded-lg bg-ink-50 p-3 text-[15px]"><span className="font-semibold">{st.role === side ? "You" : st.role === "customer" ? "Customer" : "Artisan"}</span> <span className="text-xs text-ink-500">{dateTime(st.at)}</span><p className="mt-1 whitespace-pre-line">{st.text}</p></li>)}</ul>
            {dispute.status === "open" ? (
              <form action={addStatementAction} className="space-y-2"><Hidden id={b._id} /><TextArea label="Add more details" name="text" /><button className="btn btn-ghost">Add to report</button></form>
            ) : <p className="rounded-lg bg-leaf-50 p-3 text-[15px] text-leaf-700">Decision: {dispute.resolution === "refund_customer" ? "refund to the customer" : "job released to the artisan"}. {dispute.resolutionNote}</p>}
          </section>
        )}
        {canReport && (
          <details className="panel"><summary className="cursor-pointer font-semibold text-pepper-700">Report a problem</summary>
            <form action={openDisputeAction} className="mt-3 space-y-3"><Hidden id={b._id} />
              <div><label htmlFor="reason" className="label">What went wrong?</label><select id="reason" name="reason" className="input" required defaultValue="">{<option value="" disabled>Choose…</option>}{REASONS.filter((r) => side === "customer" ? r[0] !== "customer_refused_to_pay" : r[0] !== "no_show" && r[0] !== "incomplete_work").map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div>
              <TextArea label="Describe what happened" name="text" required /><button className="btn btn-danger">Send report</button>
              <p className="hint">Payment is held while we review. Both sides can add details.</p></form></details>
        )}

        {/* -------- messages -------- */}
        {!(side === "artisan" && s === "pending_artisan_response" && false) && (
          <section className="panel"><h3 className="text-lg font-bold">Messages</h3>
            {messages.length === 0 ? <p className="mt-2 text-sm text-ink-500">No messages yet. Keep conversation here so it's on record if there's ever a problem.</p> : (
              <ul className="mt-3 space-y-2">{messages.map((m) => <li key={String(m._id)} className={`max-w-[85%] rounded-lg p-3 text-[15px] ${m.fromRole === side ? "ml-auto bg-ink-100" : "bg-ink-50"}`}><p className="whitespace-pre-line">{m.body}</p><p className="mt-1 text-xs text-ink-500">{m.fromRole === side ? "You" : m.fromRole === "customer" ? "Customer" : "Artisan"} · {dateTime(m.createdAt)}</p></li>)}</ul>
            )}
            {!closed && <form action={sendMessageAction} className="mt-3 flex gap-2"><Hidden id={b._id} /><label htmlFor="body" className="sr-only">Message</label><input id="body" name="body" required maxLength={1000} className="input" placeholder="Write a message" /><button className="btn btn-primary">Send</button></form>}
          </section>
        )}
      </div>

      <aside className="space-y-4">
        <section className="panel">
          <h3 className="font-bold">{side === "artisan" ? "Your earnings" : "Payment"}</h3>
          {side === "customer" ? (b.pricing?.totalKobo ? <div className="mt-2"><PriceBreakdown p={b.pricing} /><p className="mt-2 text-sm text-ink-500">Payment: {b.paymentStatus === "paid" ? "paid" : b.paymentStatus === "unpaid" ? "not paid yet" : b.paymentStatus.replace("_", " ")}{payment?.paidAt ? ` on ${dateTime(payment.paidAt)}` : ""}</p>{b.cancellation?.refundKobo ? <p className="mt-1 text-sm">Refund: <Money kobo={b.cancellation.refundKobo} /></p> : null}</div> : <p className="mt-2 text-sm text-ink-500">Price appears after the artisan responds.</p>)
            : b.pricing?.totalKobo ? (
              <dl className="mt-2 text-[15px]">
                <div className="flex justify-between py-0.5"><dt className="text-ink-500">Service charge</dt><dd><Money kobo={b.pricing.serviceChargeKobo} /></dd></div>
                {(b.pricing.travelKobo ?? 0) > 0 && <div className="flex justify-between py-0.5"><dt className="text-ink-500">Travel</dt><dd><Money kobo={b.pricing.travelKobo} /></dd></div>}
                {(b.pricing.commissionKobo ?? 0) > 0 && <div className="flex justify-between py-0.5"><dt className="text-ink-500">Platform commission</dt><dd>-<Money kobo={b.pricing.commissionKobo} /></dd></div>}
                <div className="mt-2 flex justify-between border-t border-ink-200 pt-2 font-bold"><dt>You receive</dt><dd><Money kobo={b.pricing.artisanDueKobo} /></dd></div>
                <p className="mt-2 text-sm text-ink-500">Payment: {b.paymentStatus === "paid" ? "customer has paid" : "not paid yet"}</p>
              </dl>
            ) : <p className="mt-2 text-sm text-ink-500">Set a price when you respond.</p>}
        </section>
        <a className="btn btn-ghost w-full" href={`https://wa.me/?text=${shareText}`} target="_blank" rel="noopener">Share booking on WhatsApp</a>
        {side === "customer" && !closed && s !== "completed" && s !== "disputed" && s !== "in_progress" && (
          <form action={customerBookingAction} className="panel space-y-2"><Hidden id={b._id} op="cancel" />
            <label htmlFor="creason" className="label">Cancel this booking</label><input id="creason" name="reason" className="input" placeholder="Reason (optional)" />
            <button className="btn btn-danger w-full">Cancel booking</button>
            {s === "confirmed" && <p className="hint">Refunds depend on how much notice you give. See the <a className="underline" href="/legal/cancellation">cancellation policy</a>.</p>}</form>
        )}
        {side === "artisan" && s === "confirmed" && (
          <form action={artisanJobAction} className="panel space-y-2"><Hidden id={b._id} op="cancel" />
            <label htmlFor="acreason" className="label">Can't make it?</label><input id="acreason" name="reason" className="input" placeholder="Reason" />
            <button className="btn btn-danger w-full">Cancel booking</button><p className="hint">The customer is refunded in full.</p></form>
        )}
      </aside>
    </div>
  );
}
