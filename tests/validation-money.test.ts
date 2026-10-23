import { describe, expect, it } from "vitest";
import { escapeRegex, phone, registerSchema, password } from "@/lib/validation";
import { nairaToKobo } from "@/lib/money";
import { isLocked } from "@/lib/auth/session";

describe("validation", () => {
  it("normalises Nigerian phone numbers and rejects junk", () => {
    expect(phone.parse("0803 123 4567")).toBe("+2348031234567");
    expect(phone.parse("+234 701 234 5678")).toBe("+2347012345678");
    expect(phone.safeParse("12345").success).toBe(false);
  });
  it("never lets a visitor register as admin", () => {
    const r = registerSchema.safeParse({ name: "Ada Obi", email: "a@b.com", password: "abcdef12", phone: "08031234567", role: "admin" });
    expect(r.success).toBe(false);
  });
  it("rejects weak passwords", () => {
    expect(password.safeParse("12345678").success).toBe(false);
    expect(password.safeParse("short1").success).toBe(false);
    expect(password.safeParse("goodpass1").success).toBe(true);
  });
  it("escapes regex input so search can't be abused", () => {
    expect(new RegExp(escapeRegex("a.*(b")).test("a.*(b")).toBe(true);
    expect(new RegExp(escapeRegex(".*")).test("anything")).toBe(false);
  });
});

describe("money and lockout", () => {
  it("converts naira text to whole kobo", () => {
    expect(nairaToKobo("15,000")).toBe(1_500_000);
    expect(nairaToKobo("₦2500.50")).toBe(250_050);
    expect(nairaToKobo("abc")).toBeNull();
    expect(nairaToKobo("-5")).toBeNull();
  });
  it("detects a locked account", () => {
    expect(isLocked(new Date(Date.now() + 60_000))).toBe(true);
    expect(isLocked(new Date(Date.now() - 60_000))).toBe(false);
    expect(isLocked(undefined)).toBe(false);
  });
});
