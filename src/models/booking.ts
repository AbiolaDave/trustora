import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";
import { BOOKING_STATES } from "../domain/booking-state";

const bookingSchema = new Schema(
  {
    reference: { type: String, required: true, unique: true }, // human-friendly, e.g. KSW-7F3K9Q
    customer: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    artisan: { type: Schema.Types.ObjectId, ref: "ArtisanProfile", required: true, index: true },
    service: { type: Schema.Types.ObjectId, ref: "Service", required: true },
    // Snapshot at booking time so later edits to the service never change an existing booking.
    serviceTitle: { type: String, required: true },
    pricingModel: { type: String, enum: ["fixed", "starting_from", "quote"], required: true },
    startsAt: { type: Date, required: true },
    durationMinutes: { type: Number, required: true },
    address: { line1: { type: String, required: true }, area: { type: String, required: true }, city: String, state: String, landmark: String },
    notes: { type: String, maxlength: 2000 },
    mediaKeys: [String],

    status: { type: String, enum: BOOKING_STATES, required: true, default: "pending_artisan_response", index: true },
    statusHistory: [{ from: String, to: String, event: String, actor: String, actorId: Schema.Types.ObjectId, at: Date }],
    quoteNote: String,
    expiresAt: Date, // current deadline for whoever must act next; swept by a cron job

    // Money, in kobo. Set ONLY by server code from artisan prices and PlatformSettings.
    pricing: {
      serviceChargeKobo: Number, travelKobo: Number, customerFeeKobo: Number, totalKobo: Number,
      commissionKobo: Number, artisanDueKobo: Number, platformRevenueKobo: Number,
    },
    paymentStatus: { type: String, enum: ["unpaid", "paid", "partially_refunded", "refunded"], default: "unpaid" },
    completionRequestedAt: Date,
    completedAt: Date,
    cancellation: { by: String, reason: String, at: Date, refundKobo: Number },
  },
  { timestamps: true },
);
bookingSchema.index({ artisan: 1, startsAt: 1 });
bookingSchema.index({ status: 1, expiresAt: 1 }); // expiry sweeper
bookingSchema.index({ customer: 1, createdAt: -1 });

export const BOOKING_STATES_FOR_FILTER: string[] = [...BOOKING_STATES];
export type BookingDoc = InferSchemaType<typeof bookingSchema> & { _id: mongoose.Types.ObjectId };
export const Booking: Model<BookingDoc> = (mongoose.models.Booking as Model<BookingDoc>) || mongoose.model<BookingDoc>("Booking", bookingSchema);

/** One row per reserved 30-minute bucket. The unique index is what makes double-booking impossible. */
const slotSchema = new Schema({
  artisan: { type: Schema.Types.ObjectId, required: true },
  bucket: { type: Number, required: true },
  booking: { type: Schema.Types.ObjectId, ref: "Booking", required: true, index: true },
  holdExpiresAt: Date, // set while awaiting payment; the row is released if unpaid by then
});
slotSchema.index({ artisan: 1, bucket: 1 }, { unique: true });
slotSchema.index({ holdExpiresAt: 1 }, { expireAfterSeconds: 0, partialFilterExpression: { holdExpiresAt: { $type: "date" } } });

export const SlotReservation = (mongoose.models.SlotReservation || mongoose.model("SlotReservation", slotSchema)) as unknown as Model<{ artisan: mongoose.Types.ObjectId; bucket: number; booking: mongoose.Types.ObjectId; holdExpiresAt?: Date }>;
