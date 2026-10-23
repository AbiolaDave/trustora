import mongoose, { Schema } from "mongoose";
import { DEFAULT_CUSTOMER_CANCEL_TIERS } from "../domain/policy";

/** Single document (key = "global"). Admin-editable; every change should write an AuditLog row. */
const settingsSchema = new Schema(
  {
    key: { type: String, default: "global", unique: true },
    launchCities: { type: [String], default: ["lagos"] },
    commissionBps: { type: Number, default: 0, min: 0, max: 10000 }, // off until you decide to charge
    customerFeeBps: { type: Number, default: 0, min: 0, max: 10000 },
    customerFeeFlatKobo: { type: Number, default: 0, min: 0 },
    customerFeeCapKobo: { type: Number, default: null },
    cancelTiers: { type: [{ minHoursBeforeStart: Number, refundBps: Number }], default: DEFAULT_CUSTOMER_CANCEL_TIERS },
    settlement: { type: String, enum: ["manual_payout", "paystack_split"], default: "manual_payout" },
  },
  { timestamps: true },
);
export const PlatformSettings = (mongoose.models.PlatformSettings || mongoose.model("PlatformSettings", settingsSchema)) as unknown as import("mongoose").Model<Record<string, any>>;
