import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

const artisanProfileSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true, unique: true },
    displayName: { type: String, required: true, trim: true, maxlength: 120 },
    slug: { type: String, required: true, unique: true },
    bio: { type: String, maxlength: 1500 },
    yearsExperience: { type: Number, min: 0, max: 60 },
    skills: [String],
    photoUrl: String,
    portfolio: [{ url: String, caption: String }],
    /** Areas served, as references to configured Location slugs, e.g. "lagos/yaba". */
    serviceAreas: [{ type: String, index: true }],
    verificationStatus: { type: String, enum: ["unverified", "pending_review", "verified", "rejected"], default: "unverified", index: true },
    verifiedAt: Date,
    verifiedBy: { type: Schema.Types.ObjectId, ref: "User" },
    rejectionReason: String,
    /** Private storage keys only. Never public URLs. Served via short-lived signed links to the owner and admins. */
    verificationDocs: [{ kind: { type: String, enum: ["national_id", "drivers_license", "voters_card", "passport", "selfie", "trade_certificate"] }, storageKey: String, uploadedAt: Date }],
    /** Paystack subaccount/recipient code, NOT the raw account number. */
    payoutRecipientCode: String,
    payoutBankLast4: String,
    // MVP manual payouts: visible only to the owner and admins (select:false). Replace with a Paystack recipient code when transfers are set up.
    payoutBankName: String,
    payoutAccountName: String,
    payoutAccountNumber: { type: String, select: false },
    paused: { type: Boolean, default: false },
    featuredUntil: Date,
    // Denormalised from real reviews/bookings by server code only. Never set from client input.
    ratingAvg: { type: Number, default: 0 },
    ratingCount: { type: Number, default: 0 },
    completedJobs: { type: Number, default: 0 },
    noShowCount: { type: Number, default: 0 },
    workingWindows: [{ dayOfWeek: Number, startMinute: Number, endMinute: Number }],
    blackoutDates: [String], // YYYY-MM-DD, Lagos local date
  },
  { timestamps: true },
);
artisanProfileSchema.index({ verificationStatus: 1, paused: 1, serviceAreas: 1 });
artisanProfileSchema.index({ featuredUntil: -1 });

export type ArtisanProfileDoc = InferSchemaType<typeof artisanProfileSchema> & { _id: mongoose.Types.ObjectId };
export const ArtisanProfile: Model<ArtisanProfileDoc> =
  (mongoose.models.ArtisanProfile as Model<ArtisanProfileDoc>) || mongoose.model<ArtisanProfileDoc>("ArtisanProfile", artisanProfileSchema);
