/** "15,000" or "15000.50" (naira) -> kobo integer, or null if invalid. */
export function nairaToKobo(input: FormDataEntryValue | null | undefined): number | null {
  if (typeof input !== "string") return null;
  const n = Number(input.replace(/[,\s₦]/g, ""));
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100);
}
export const koboToNaira = (k: number) => String(k / 100);
