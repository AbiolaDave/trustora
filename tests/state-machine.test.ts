import { describe, expect, it } from "vitest";
import { allowedEvents, InvalidTransitionError, transition } from "../src/domain/booking-state";

const fixed = { pricingModel: "fixed" as const };
const quote = { pricingModel: "quote" as const };

describe("booking state machine", () => {
  it("fixed-price happy path", () => {
    let s = transition("pending_artisan_response", "artisan_accept", "artisan", fixed);
    expect(s).toBe("awaiting_payment");
    s = transition(s, "payment_verified", "system", fixed);
    expect(s).toBe("confirmed");
    s = transition(s, "artisan_start", "artisan", fixed);
    s = transition(s, "customer_confirm_completion", "customer", fixed);
    expect(s).toBe("completed");
  });

  it("quote path requires quote then customer approval", () => {
    expect(() => transition("pending_artisan_response", "artisan_accept", "artisan", quote)).toThrow(InvalidTransitionError);
    let s = transition("pending_artisan_response", "artisan_submit_quote", "artisan", quote);
    expect(s).toBe("awaiting_customer_approval");
    s = transition(s, "customer_approve_quote", "customer", quote);
    expect(s).toBe("awaiting_payment");
  });

  it("customers can never mark a payment verified or confirm a booking", () => {
    expect(() => transition("awaiting_payment", "payment_verified", "customer", fixed)).toThrow(/cannot/);
    expect(() => transition("awaiting_payment", "payment_verified", "admin", fixed)).toThrow(/cannot/);
  });

  it("artisans cannot confirm their own completion or resolve disputes", () => {
    expect(() => transition("in_progress", "customer_confirm_completion", "artisan", fixed)).toThrow();
    expect(() => transition("disputed", "admin_resolve_release", "artisan", fixed)).toThrow();
  });

  it("terminal states accept nothing", () => {
    for (const s of ["cancelled", "expired"] as const) {
      expect(allowedEvents(s, "admin", fixed)).toEqual([]);
    }
    expect(() => transition("cancelled", "artisan_accept", "artisan", fixed)).toThrow(InvalidTransitionError);
  });

  it("cannot skip steps", () => {
    expect(() => transition("pending_artisan_response", "artisan_start", "artisan", fixed)).toThrow();
    expect(() => transition("awaiting_payment", "customer_confirm_completion", "customer", fixed)).toThrow();
  });

  it("disputes resolve to completed or cancelled only by admin", () => {
    expect(transition("disputed", "admin_resolve_release", "admin", fixed)).toBe("completed");
    expect(transition("disputed", "admin_resolve_refund", "admin", fixed)).toBe("cancelled");
  });
});
