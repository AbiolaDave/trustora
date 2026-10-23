import { env, requireEnv } from "../env";

export interface InitializeInput { email: string; amountKobo: number; reference: string; callbackUrl: string; metadata?: Record<string, string> }
export interface InitializeResult { authorizationUrl: string; reference: string }
export interface VerifiedCharge { status: string; reference: string; amount: number; currency: string; paidAt?: string; channel?: string; feeKobo?: number }

/** Add Flutterwave/others later by implementing this interface. Nothing else in the app talks to a provider. */
export interface PaymentProvider {
  readonly name: "paystack" | "mock";
  initialize(input: InitializeInput): Promise<InitializeResult>;
  verify(reference: string): Promise<VerifiedCharge>;
  refund(reference: string, amountKobo: number): Promise<{ providerRef: string; status: "pending" | "processed" }>;
}

const BASE = "https://api.paystack.co";

export class PaystackProvider implements PaymentProvider {
  readonly name = "paystack" as const;
  private headers() {
    const key = requireEnv("PAYSTACK_SECRET_KEY", "Get your test secret key from the Paystack dashboard (Settings > API Keys).");
    return { Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
  }
  private async call<T>(path: string, init?: RequestInit): Promise<T> {
    const res = await fetch(`${BASE}${path}`, { ...init, headers: this.headers() });
    const json = (await res.json()) as { status: boolean; message: string; data: T };
    if (!res.ok || !json.status) throw new Error(`Paystack error: ${json.message}`);
    return json.data;
  }
  async initialize(i: InitializeInput) {
    const d = await this.call<{ authorization_url: string; reference: string }>("/transaction/initialize", {
      method: "POST",
      body: JSON.stringify({ email: i.email, amount: i.amountKobo, reference: i.reference, currency: "NGN", callback_url: i.callbackUrl, metadata: i.metadata }),
    });
    return { authorizationUrl: d.authorization_url, reference: d.reference };
  }
  async verify(reference: string) {
    const d = await this.call<{ status: string; reference: string; amount: number; currency: string; paid_at?: string; channel?: string; fees?: number }>(
      `/transaction/verify/${encodeURIComponent(reference)}`,
    );
    return { status: d.status, reference: d.reference, amount: d.amount, currency: d.currency, paidAt: d.paid_at, channel: d.channel, feeKobo: d.fees };
  }
  async refund(reference: string, amountKobo: number) {
    const d = await this.call<{ id: number; status: string }>("/refund", { method: "POST", body: JSON.stringify({ transaction: reference, amount: amountKobo }) });
    return { providerRef: String(d.id), status: d.status === "processed" ? ("processed" as const) : ("pending" as const) };
  }
}

/**
 * SANDBOX ONLY. A clearly labelled local stand-in so you can develop without Paystack keys.
 * It cannot run in production, and payments only become "success" when a developer explicitly
 * calls `mockMarkPaid(reference)` (the dev-only "Simulate payment" page does this).
 */
const mockPaid = new Set<string>();
const mockAmounts = new Map<string, number>();
export const mockMarkPaid = (reference: string) => {
  if (env.NODE_ENV === "production") throw new Error("Mock payments are disabled in production.");
  mockPaid.add(reference);
};
export class MockProvider implements PaymentProvider {
  readonly name = "mock" as const;
  constructor() {
    if (env.NODE_ENV === "production") throw new Error("MockProvider cannot be used in production. Set PAYSTACK_SECRET_KEY.");
  }
  async initialize(i: InitializeInput) {
    mockAmounts.set(i.reference, i.amountKobo);
    return { authorizationUrl: `${env.APP_URL}/dev/mock-pay?reference=${encodeURIComponent(i.reference)}`, reference: i.reference };
  }
  async verify(reference: string) {
    return { status: mockPaid.has(reference) ? "success" : "abandoned", reference, amount: mockAmounts.get(reference) ?? 0, currency: "NGN" };
  }
  async refund(reference: string) {
    return { providerRef: `mock-refund-${reference}`, status: "pending" as const };
  }
}

export function getPaymentProvider(): PaymentProvider {
  return env.PAYSTACK_SECRET_KEY ? new PaystackProvider() : new MockProvider();
}
