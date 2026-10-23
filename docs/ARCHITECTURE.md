# Trustora: MVP architecture

## Layers (business logic never lives in components)
- `src/domain/`   Pure TypeScript rules: booking state machine, pricing, refund policy, availability, webhook checks. No database, fully unit-tested.
- `src/models/`   Mongoose schemas and indexes.
- `src/server/`   Database-touching workflows (reserve slots, settle payments). Server-only.
- `src/lib/`      env validation, DB connection, auth/session, payment-provider adapters.
- `src/app/`      (next step) Next.js pages, route handlers, UI components.

## Money rules
- Integer kobo everywhere. Prices come from artisans/quotes; fees from PlatformSettings. The browser sends only IDs.
- Commission applies to the service charge only. `artisanDue + platformRevenue = total`, always.
- Commission and customer fee default to 0%. Turn them on in PlatformSettings.
- No "escrow" wording. Settlement is `manual_payout` until Paystack split/subaccount onboarding is done.

## Booking lifecycle
pending_artisan_response -> (accept | quote -> awaiting_customer_approval) -> awaiting_payment -> confirmed -> in_progress -> completed
Side exits: cancelled, expired, disputed (admin resolves to completed or cancelled).
Only `transition()` may change status. Only `settleVerifiedCharge()` may raise `payment_verified`.

## Double-booking protection (no transactions needed)
Each booking inserts one `SlotReservation` row per 30-min bucket. A unique index on (artisan, bucket) makes MongoDB reject overlaps.
Payment holds carry `holdExpiresAt`; a TTL index deletes lapsed holds automatically. A sweeper cron expires the booking itself.

## Payment safety
Signature check on raw body -> compare reference/amount/currency with our own Payment row -> atomic claim (`status != success`) -> transition booking.
Duplicate webhooks return `already_processed`. A payment arriving after a hold lapsed queues a refund instead of being kept.

## Assumptions
- Lagos is the launch city; locations are configurable. WAT is UTC+1 with no daylight saving.
- Cookies hold a signed JWT (14 days). Sensitive writes re-load the user from the database.
- Sweeper jobs (expire stale bookings, auto-confirm completion) run via a scheduled route (Vercel Cron or similar).
