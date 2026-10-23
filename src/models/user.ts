import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

const userSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    email: { type: String, required: true, lowercase: true, trim: true, unique: true },
    phone: { type: String, trim: true }, // E.164, e.g. +2348012345678
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ["customer", "artisan", "admin"], required: true, default: "customer" },
    emailVerifiedAt: Date,
    status: { type: String, enum: ["active", "suspended"], default: "active" },
    savedAddresses: [{ label: String, line1: String, area: String, city: String, state: String }],
    savedArtisans: [{ type: Schema.Types.ObjectId, ref: "ArtisanProfile" }],
    failedLoginCount: { type: Number, default: 0 },
    lockedUntil: Date,
  },
  { timestamps: true },
);
userSchema.index({ role: 1, status: 1 });

export type UserDoc = InferSchemaType<typeof userSchema> & { _id: mongoose.Types.ObjectId };
export const User: Model<UserDoc> = (mongoose.models.User as Model<UserDoc>) || mongoose.model<UserDoc>("User", userSchema);
