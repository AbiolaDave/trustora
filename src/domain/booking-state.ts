/**
 * Booking state machine. Every status change in the app goes through `transition()`.
 * Nothing else is allowed to write Booking.status directly.
 */
export const BOOKING_STATES = [
  "pending_artisan_response",
  "awaiting_customer_approval",
  "awaiting_payment",
  "confirmed",
  "in_progress",
  "completed",
  "cancelled",
  "disputed",
  "expired",
] as const;
export type BookingState = (typeof BOOKING_STATES)[number];

export type Actor = "customer" | "artisan" | "admin" | "system";
export type PricingModel = "fixed" | "starting_from" | "quote";

export type BookingEvent =
  | "artisan_accept"
  | "artisan_reject"
  | "artisan_submit_quote"
  | "customer_approve_quote"
  | "customer_decline_quote"
  | "payment_verified" // only ever raised by the server after Paystack verification
  | "artisan_start"
  | "customer_confirm_completion"
  | "auto_confirm_completion"
  | "cancel"
  | "open_dispute"
  | "admin_resolve_release" // dispute resolved in artisan's favour
  | "admin_resolve_refund" // dispute resolved in customer's favour
  | "expire";

export const TERMINAL_STATES: readonly BookingState[] = ["cancelled", "expired"];

export interface TransitionContext {
  pricingModel: PricingModel;
}

interface Rule {
  from: BookingState;
  event: BookingEvent;
  actors: Actor[];
  to: BookingState;
  guard?: (ctx: TransitionContext) => string | null; // return an error message to block
}

const needsNoQuote = (ctx: TransitionContext) =>
  ctx.pricingModel === "quote" ? "This service needs a quote before it can be accepted." : null;
const needsQuote = (ctx: TransitionContext) =>
  ctx.pricingModel !== "quote" ? "Only quote-based services accept quotes." : null;

const RULES: Rule[] = [
  { from: "pending_artisan_response", event: "artisan_accept", actors: ["artisan"], to: "awaiting_payment", guard: needsNoQuote },
  { from: "pending_artisan_response", event: "artisan_submit_quote", actors: ["artisan"], to: "awaiting_customer_approval", guard: needsQuote },
  { from: "pending_artisan_response", event: "artisan_reject", actors: ["artisan"], to: "cancelled" },
  { from: "pending_artisan_response", event: "cancel", actors: ["customer", "admin"], to: "cancelled" },
  { from: "pending_artisan_response", event: "expire", actors: ["system"], to: "expired" },

  { from: "awaiting_customer_approval", event: "customer_approve_quote", actors: ["customer"], to: "awaiting_payment" },
  { from: "awaiting_customer_approval", event: "customer_decline_quote", actors: ["customer"], to: "cancelled" },
  { from: "awaiting_customer_approval", event: "cancel", actors: ["customer", "artisan", "admin"], to: "cancelled" },
  { from: "awaiting_customer_approval", event: "expire", actors: ["system"], to: "expired" },

  { from: "awaiting_payment", event: "payment_verified", actors: ["system"], to: "confirmed" },
  { from: "awaiting_payment", event: "cancel", actors: ["customer", "artisan", "admin"], to: "cancelled" },
  { from: "awaiting_payment", event: "expire", actors: ["system"], to: "expired" },

  { from: "confirmed", event: "artisan_start", actors: ["artisan"], to: "in_progress" },
  { from: "confirmed", event: "cancel", actors: ["customer", "artisan", "admin"], to: "cancelled" },
  { from: "confirmed", event: "open_dispute", actors: ["customer", "artisan"], to: "disputed" }, // e.g. no-show

  { from: "in_progress", event: "customer_confirm_completion", actors: ["customer"], to: "completed" },
  { from: "in_progress", event: "auto_confirm_completion", actors: ["system"], to: "completed" },
  { from: "in_progress", event: "open_dispute", actors: ["customer", "artisan"], to: "disputed" },

  { from: "completed", event: "open_dispute", actors: ["customer"], to: "disputed" }, // within dispute window (caller checks)

  { from: "disputed", event: "admin_resolve_release", actors: ["admin"], to: "completed" },
  { from: "disputed", event: "admin_resolve_refund", actors: ["admin"], to: "cancelled" },
];

export class InvalidTransitionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidTransitionError";
  }
}

export function transition(from: BookingState, event: BookingEvent, actor: Actor, ctx: TransitionContext): BookingState {
  const rule = RULES.find((r) => r.from === from && r.event === event);
  if (!rule) throw new InvalidTransitionError(`"${event}" is not allowed while a booking is ${from}.`);
  if (!rule.actors.includes(actor)) throw new InvalidTransitionError(`A ${actor} cannot do "${event}".`);
  const blocked = rule.guard?.(ctx);
  if (blocked) throw new InvalidTransitionError(blocked);
  return rule.to;
}

/** Events an actor may attempt from a state (to decide which buttons to show; the server re-checks anyway). */
export function allowedEvents(from: BookingState, actor: Actor, ctx: TransitionContext): BookingEvent[] {
  return RULES.filter((r) => r.from === from && r.actors.includes(actor) && !r.guard?.(ctx)).map((r) => r.event);
}

/** States in which an artisan's time slot must stay reserved. */
export const SLOT_HOLDING_STATES: readonly BookingState[] = [
  "pending_artisan_response", "awaiting_customer_approval", "awaiting_payment", "confirmed", "in_progress", "disputed",
];
