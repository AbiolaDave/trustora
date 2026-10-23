import { connectDb } from "./db";
import { PlatformSettings } from "../models/platform-settings";
import type { FeeSettings } from "../domain/pricing";
import type { RefundTier } from "../domain/policy";

export interface Settings extends FeeSettings { launchCities: string[]; cancelTiers: RefundTier[]; settlement: "manual_payout" | "paystack_split" }

/** One settings document, created on first use with safe defaults: launch in Ogun, no commission, no fees. */
export async function getSettings(): Promise<Settings> {
  await connectDb();
  const s = ((await PlatformSettings.findOneAndUpdate({ key: "global" }, { $setOnInsert: { key: "global", launchCities: ["ogun"] } }, { upsert: true, new: true, lean: true })) ?? {}) as Record<string, any>;
  return {
    launchCities: s.launchCities ?? ["ogun"], commissionBps: s.commissionBps ?? 0, customerFeeBps: s.customerFeeBps ?? 0,
    customerFeeFlatKobo: s.customerFeeFlatKobo ?? 0, customerFeeCapKobo: s.customerFeeCapKobo ?? null,
    cancelTiers: (s.cancelTiers as RefundTier[]) ?? [], settlement: (s.settlement as Settings["settlement"]) ?? "manual_payout",
  };
}
