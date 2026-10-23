import { z } from "zod";

export const objectId = z.string().regex(/^[a-f0-9]{24}$/, "Invalid id");
export const email = z.string().trim().toLowerCase().email("Enter a valid email address.").max(200);
export const password = z.string().min(8, "Use at least 8 characters.").max(100).refine((p) => !/^\d+$/.test(p), "Add some letters to your password.");
/** Nigerian numbers: 080..., 0701..., +234... Stored as +234XXXXXXXXXX. */
export const phone = z.string().trim().transform((v) => v.replace(/[\s-]/g, "")).refine((v) => /^(\+234|234|0)[789][01]\d{8}$/.test(v), "Enter a valid Nigerian phone number.").transform((v) => "+234" + v.replace(/^(\+234|234|0)/, ""));

export const registerSchema = z.object({
  name: z.string().trim().min(2, "Enter your full name.").max(120),
  email, password, phone,
  role: z.enum(["customer", "artisan"]),
});
export const loginSchema = z.object({ email, password: z.string().min(1).max(100) });

export const addressSchema = z.object({
  line1: z.string().trim().min(5, "Enter the street address.").max(200),
  area: z.string().trim().min(2, "Enter the area or neighbourhood.").max(100),
  landmark: z.string().trim().max(150).optional(),
});

export const bookingSchema = z.object({
  serviceId: objectId,
  startsAt: z.string().datetime({ message: "Pick a time slot." }),
  notes: z.string().trim().max(2000).optional(),
}).merge(addressSchema);

export const serviceSchema = z.object({
  title: z.string().trim().min(3, "Give the service a clear title.").max(140),
  description: z.string().trim().max(2000).optional(),
  category: objectId,
  pricingModel: z.enum(["fixed", "starting_from", "quote"]),
  durationMinutes: z.coerce.number().int().min(30).max(1440),
});

export const slugify = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 50) || "artisan";
export const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
export const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
