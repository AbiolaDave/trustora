import mongoose, { Schema, type Model } from "mongoose";

type Id = mongoose.Types.ObjectId;
// Typed loosely on purpose: very deep Mongoose generics make the TypeScript compiler run out of memory.
function reg<T>(name: string, schema: Schema): Model<T> {
  return (mongoose.models[name] ?? mongoose.model(name, schema)) as unknown as Model<T>;
}

/** Configurable service areas. slug looks like "ogun/abeokuta/kuto". */
export const Location = reg<{ slug: string; state: string; city: string; name: string; active: boolean }>(
  "Location",
  new Schema({ slug: { type: String, unique: true, required: true }, state: String, city: String, name: String, active: { type: Boolean, default: true } }),
);

const reviewSchema = new Schema(
  {
    booking: { type: Schema.Types.ObjectId, ref: "Booking", required: true, unique: true }, // one review per booking
    customer: { type: Schema.Types.ObjectId, ref: "User", required: true },
    artisan: { type: Schema.Types.ObjectId, ref: "ArtisanProfile", required: true, index: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, maxlength: 1000 },
    hidden: { type: Boolean, default: false },
    reports: [{ by: Schema.Types.ObjectId, reason: String, at: Date }],
  },
  { timestamps: true },
);
export const Review = reg<{ _id: mongoose.Types.ObjectId; booking: mongoose.Types.ObjectId; customer: mongoose.Types.ObjectId; artisan: mongoose.Types.ObjectId; rating: number; comment?: string; hidden: boolean; reports: { by: mongoose.Types.ObjectId; reason: string; at: Date }[]; createdAt: Date }>("Review", reviewSchema);

const disputeSchema = new Schema(
  {
    booking: { type: Schema.Types.ObjectId, ref: "Booking", required: true, index: true },
    openedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    openedByRole: { type: String, enum: ["customer", "artisan"] },
    reason: { type: String, enum: ["no_show", "incomplete_work", "poor_quality", "price_mismatch", "customer_refused_to_pay", "other"], required: true },
    statements: [{ by: Schema.Types.ObjectId, role: String, text: String, at: Date }],
    status: { type: String, enum: ["open", "resolved"], default: "open", index: true },
    resolution: { type: String, enum: ["release_to_artisan", "refund_customer"] },
    resolutionNote: String,
    resolvedBy: Schema.Types.ObjectId,
    resolvedAt: Date,
  },
  { timestamps: true },
);
export const Dispute = reg<{ _id: mongoose.Types.ObjectId; booking: mongoose.Types.ObjectId; openedBy: mongoose.Types.ObjectId; openedByRole: string; reason: string; statements: { by: mongoose.Types.ObjectId; role: string; text: string; at: Date }[]; status: string; resolution?: string; resolutionNote?: string; createdAt: Date }>("Dispute", disputeSchema);

const notificationSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    type: String,
    title: { type: String, required: true },
    body: String, // never include payment data or contact details
    link: String,
    readAt: Date,
  },
  { timestamps: true },
);
notificationSchema.index({ user: 1, createdAt: -1 });
export const Notification = reg<{ _id: mongoose.Types.ObjectId; user: mongoose.Types.ObjectId; title: string; body?: string; link?: string; readAt?: Date; createdAt: Date }>("Notification", notificationSchema);

/** What we owe artisans. Created when a booking completes. Marked paid manually by an admin with the bank transfer reference. */
const payoutSchema = new Schema(
  {
    booking: { type: Schema.Types.ObjectId, ref: "Booking", required: true, unique: true },
    artisan: { type: Schema.Types.ObjectId, ref: "ArtisanProfile", required: true, index: true },
    amountKobo: { type: Number, required: true },
    commissionKobo: { type: Number, default: 0 },
    status: { type: String, enum: ["due", "paid", "withheld"], default: "due", index: true },
    payableAfter: Date, // end of the dispute window
    paidAt: Date,
    transferReference: String,
    paidBy: Schema.Types.ObjectId,
  },
  { timestamps: true },
);
export const Payout = reg<{ _id: mongoose.Types.ObjectId; booking: mongoose.Types.ObjectId; artisan: mongoose.Types.ObjectId; amountKobo: number; commissionKobo: number; status: string; payableAfter?: Date; paidAt?: Date; transferReference?: string; createdAt: Date }>("Payout", payoutSchema);

const messageSchema = new Schema(
  {
    booking: { type: Schema.Types.ObjectId, ref: "Booking", required: true, index: true },
    from: { type: Schema.Types.ObjectId, ref: "User", required: true },
    fromRole: String,
    body: { type: String, required: true, maxlength: 1000 },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);
export const Message = reg<{ _id: mongoose.Types.ObjectId; booking: mongoose.Types.ObjectId; from: mongoose.Types.ObjectId; fromRole: string; body: string; createdAt: Date }>("Message", messageSchema);

/** Email-verification and password-reset tokens. Only a hash is stored. */
const tokenSchema = new Schema({
  user: { type: Schema.Types.ObjectId, required: true, index: true },
  purpose: { type: String, enum: ["verify_email", "reset_password"], required: true },
  tokenHash: { type: String, required: true, unique: true },
  expiresAt: { type: Date, required: true, expires: 0 }, // TTL cleanup
});
export const AuthToken = reg<{ user: mongoose.Types.ObjectId; purpose: string; tokenHash: string; expiresAt: Date }>("AuthToken", tokenSchema);
