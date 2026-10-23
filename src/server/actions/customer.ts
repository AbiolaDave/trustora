"use server";
import { connectDb } from "../../lib/db";
import { fail, done } from "../../lib/flash";
import { requireUser } from "../../lib/auth/server";
import { phone, addressSchema, objectId } from "../../lib/validation";
import { User } from "../../models/user";
import { ArtisanProfile } from "../../models/artisan-profile";
import { Notification } from "../../models/misc";

const str = (f: FormData, k: string) => (f.get(k) ?? "").toString();

export async function saveCustomerProfileAction(form: FormData) {
  const user = await requireUser(["customer"]);
  const name = str(form, "name").trim();
  const ph = phone.safeParse(str(form, "phone"));
  if (name.length < 2) return fail("/dashboard/profile", "Enter your name.");
  if (!ph.success) return fail("/dashboard/profile", ph.error.issues[0]?.message ?? "Invalid phone number.");
  await connectDb();
  await User.updateOne({ _id: user._id }, { $set: { name, phone: ph.data } });
  return done("/dashboard/profile", "Profile saved.");
}

export async function addAddressAction(form: FormData) {
  const user = await requireUser(["customer"]);
  const p = addressSchema.safeParse({ line1: str(form, "line1"), area: str(form, "area") });
  if (!p.success) return fail("/dashboard/profile", p.error.issues[0]?.message ?? "Check the address.");
  await connectDb();
  if ((user.savedAddresses?.length ?? 0) >= 5) return fail("/dashboard/profile", "You can save up to 5 addresses.");
  await User.updateOne({ _id: user._id }, { $push: { savedAddresses: { label: str(form, "label").slice(0, 40) || "Home", line1: p.data.line1, area: p.data.area } } });
  return done("/dashboard/profile", "Address saved.");
}

export async function removeAddressAction(form: FormData) {
  const user = await requireUser(["customer"]);
  const id = str(form, "addressId");
  if (!objectId.safeParse(id).success) return fail("/dashboard/profile", "Address not found.");
  await connectDb();
  await User.updateOne({ _id: user._id }, { $pull: { savedAddresses: { _id: id } } });
  return done("/dashboard/profile", "Address removed.");
}

export async function toggleSavedArtisanAction(form: FormData) {
  const user = await requireUser(["customer"]);
  const id = str(form, "artisanId");
  const back = str(form, "back").startsWith("/") ? str(form, "back") : "/dashboard/saved";
  if (!objectId.safeParse(id).success) return fail(back, "Artisan not found.");
  await connectDb();
  if (!(await ArtisanProfile.exists({ _id: id }))) return fail(back, "Artisan not found.");
  const has = user.savedArtisans?.some((a) => String(a) === id);
  await User.updateOne({ _id: user._id }, has ? { $pull: { savedArtisans: id } } : { $addToSet: { savedArtisans: id } });
  return done(back, has ? "Removed from saved artisans." : "Saved.");
}

export async function markNotificationsReadAction() {
  const user = await requireUser();
  await connectDb();
  await Notification.updateMany({ user: user._id, readAt: { $exists: false } }, { $set: { readAt: new Date() } });
  return done(user.role === "artisan" ? "/artisan/notifications" : "/dashboard/notifications", "All caught up.");
}
