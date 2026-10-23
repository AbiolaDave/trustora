import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  APP_URL: z.string().url().default("http://localhost:3000"),
  MONGODB_URI: z.string().optional(),
  AUTH_SECRET: z.string().min(32, "AUTH_SECRET must be at least 32 characters").optional(),
  PAYSTACK_SECRET_KEY: z.string().optional(),
  NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY: z.string().optional(),
  GMAIL_USER: z.string().optional(),
  GMAIL_APP_PASSWORD: z.string().optional(),
  APP_NAME: z.string().default("Trustora"),
  CRON_SECRET: z.string().optional(),
  NEXT_PUBLIC_WHATSAPP_NUMBER: z.string().optional(),
  UPLOAD_PROVIDER_CREDENTIALS: z.string().optional(),
});

export const env = schema.parse(process.env);

/** Ask for a variable at the moment it is needed, with a helpful message instead of an unexplained crash. */
export function requireEnv<K extends keyof typeof env>(key: K, hint: string): NonNullable<(typeof env)[K]> {
  const v = env[key];
  if (v === undefined || v === "") {
    throw new Error(`Missing ${String(key)}. ${hint} Copy .env.example to .env.local and fill it in.`);
  }
  return v as NonNullable<(typeof env)[K]>;
}
