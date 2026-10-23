import { Types } from "mongoose";
import { bucketsFor } from "../../domain/availability";
import { SlotReservation } from "../../models/booking";

export class SlotTakenError extends Error {
  constructor() {
    super("That time was just taken. Please pick another slot.");
    this.name = "SlotTakenError";
  }
}

/**
 * Reserve every 30-minute bucket the job needs. MongoDB's unique index on (artisan, bucket) guarantees
 * that two people racing for the same time cannot both succeed, so no transactions are needed.
 * If any bucket is already taken we remove the ones we managed to insert and report SlotTakenError.
 */
export async function reserveSlots(opts: {
  artisanId: Types.ObjectId; bookingId: Types.ObjectId; startsAt: Date; durationMinutes: number; holdExpiresAt?: Date;
}) {
  const docs = bucketsFor(opts.startsAt, opts.durationMinutes).map((bucket) => ({
    artisan: opts.artisanId, bucket, booking: opts.bookingId, holdExpiresAt: opts.holdExpiresAt,
  }));
  // Clear any expired payment/response holds first, so a lapsed hold never blocks a new customer.
  await SlotReservation.deleteMany({ artisan: opts.artisanId, bucket: { $in: docs.map((d) => d.bucket) }, holdExpiresAt: { $lt: new Date() } });
  try {
    await SlotReservation.insertMany(docs, { ordered: false });
  } catch (err) {
    await SlotReservation.deleteMany({ booking: opts.bookingId }); // roll back partial inserts
    if ((err as { code?: number }).code === 11000 || (err as { writeErrors?: unknown[] }).writeErrors) throw new SlotTakenError();
    throw err;
  }
}

export const releaseSlots = (bookingId: Types.ObjectId) => SlotReservation.deleteMany({ booking: bookingId });

/** When payment is confirmed the hold becomes permanent (no expiry), until the booking is cancelled. */
export const makeHoldPermanent = (bookingId: Types.ObjectId) =>
  SlotReservation.updateMany({ booking: bookingId }, { $unset: { holdExpiresAt: 1 } });
