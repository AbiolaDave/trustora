/**
 * Seeds REFERENCE data (categories, service areas, platform settings) and an admin account.
 * Add --demo to also create clearly labelled demo accounts. Demo artisans are NEVER verified and have no
 * reviews or job counts. Verify them yourself through the admin queue to test that flow.
 *
 *   npm run seed                 reference data + admin
 *   npm run seed -- --demo       also demo customer + demo artisan
 */
import mongoose from "mongoose";
import { connectDb } from "../src/lib/db";
import { hashPassword } from "../src/lib/auth/session";
import { slugify } from "../src/lib/validation";
import { User } from "../src/models/user";
import { ArtisanProfile } from "../src/models/artisan-profile";
import { Service, ServiceCategory } from "../src/models/service";
import { Location } from "../src/models/misc";
import { PlatformSettings } from "../src/models/platform-settings";

const CATEGORIES = ["Plumbing", "Electrical", "Cleaning", "AC and refrigeration", "Generators and inverters", "Carpentry", "Painting", "Tiling", "Appliance repair", "Laundry"];
// Area names are a starting point. Check and edit them in Admin > Settings with local knowledge.
const AREAS: Record<string, Record<string, string[]>> = {
  ogun: {
    abeokuta: ["Kuto", "Adatan", "Asero", "Sapon", "Ibara", "Lafenwa", "Oke-Ilewo", "Panseke"],
    "ijebu-ode": ["Ijebu-Ode Central"],
    sagamu: ["Sagamu Central"],
    ota: ["Sango-Ota", "Ota Central"],
  },
  lagos: { ikeja: ["Ikeja", "Maryland"], yaba: ["Yaba"], lekki: ["Lekki Phase 1", "Ajah"], surulere: ["Surulere"] },
};

async function main() {
  await connectDb();
  const demo = process.argv.includes("--demo");

  await PlatformSettings.updateOne({ key: "global" }, { $setOnInsert: { key: "global", launchCities: ["ogun"], commissionBps: 0, customerFeeBps: 0 } }, { upsert: true });
  for (const [i, name] of CATEGORIES.entries()) await ServiceCategory.updateOne({ slug: slugify(name) }, { $setOnInsert: { name, slug: slugify(name), sortOrder: i, featured: i < 8, active: true } }, { upsert: true });
  for (const [state, cities] of Object.entries(AREAS)) for (const [city, areas] of Object.entries(cities)) for (const name of areas) {
    const slug = `${state}/${city}/${slugify(name)}`;
    await Location.updateOne({ slug }, { $setOnInsert: { slug, state, city, name, active: true } }, { upsert: true });
  }
  console.log(`Reference data ready: ${CATEGORIES.length} categories, service areas for ${Object.keys(AREAS).join(" and ")}. Launch region: ogun.`);

  const adminEmail = process.env.SEED_ADMIN_EMAIL?.toLowerCase(), adminPw = process.env.SEED_ADMIN_PASSWORD;
  if (adminEmail && adminPw) {
    if (adminPw.length < 10) throw new Error("SEED_ADMIN_PASSWORD must be at least 10 characters.");
    await User.updateOne({ email: adminEmail }, { $setOnInsert: { name: "Platform Admin", email: adminEmail, passwordHash: await hashPassword(adminPw), role: "admin", emailVerifiedAt: new Date() } }, { upsert: true });
    console.log(`Admin account ready: ${adminEmail}`);
  } else console.log("No admin created. Set SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD in .env.local to create one.");

  if (demo) {
    const pw = process.env.SEED_DEMO_PASSWORD;
    if (!pw || pw.length < 10) throw new Error("Set SEED_DEMO_PASSWORD (10+ characters) in .env.local to create demo accounts.");
    const hash = await hashPassword(pw);
    await User.updateOne({ email: "demo.customer@example.com" }, { $setOnInsert: { name: "DEMO Customer", email: "demo.customer@example.com", phone: "+2348000000001", passwordHash: hash, role: "customer", emailVerifiedAt: new Date() } }, { upsert: true });
    const au = await User.findOneAndUpdate({ email: "demo.artisan@example.com" }, { $setOnInsert: { name: "DEMO Artisan", email: "demo.artisan@example.com", phone: "+2348000000002", passwordHash: hash, role: "artisan", emailVerifiedAt: new Date() } }, { upsert: true, new: true });
    const profile = await ArtisanProfile.findOneAndUpdate({ user: au!._id }, { $setOnInsert: { user: au!._id, displayName: "DEMO Plumber (sample data)", slug: "demo-plumber", bio: "Sample profile created by the seed script so you can test the booking flow.", yearsExperience: 5, skills: ["Pipe repair"], serviceAreas: ["ogun/abeokuta/kuto", "ogun/abeokuta/adatan"], workingWindows: [1, 2, 3, 4, 5, 6].map((d) => ({ dayOfWeek: d, startMinute: 480, endMinute: 1020 })) } }, { upsert: true, new: true });
    const plumbing = await ServiceCategory.findOne({ slug: "plumbing" });
    if (plumbing && !(await Service.exists({ artisan: profile!._id }))) {
      await Service.create([
        { artisan: profile!._id, category: plumbing._id, title: "DEMO: Fix a leaking tap", pricingModel: "fixed", priceKobo: 1_000_000, travelKobo: 100_000, durationMinutes: 60 },
        { artisan: profile!._id, category: plumbing._id, title: "DEMO: Install a water tank", pricingModel: "starting_from", priceKobo: 2_500_000, durationMinutes: 180 },
        { artisan: profile!._id, category: plumbing._id, title: "DEMO: Bathroom plumbing inspection", pricingModel: "quote", durationMinutes: 120 },
      ]);
    }
    console.log("Demo accounts ready: demo.customer@example.com and demo.artisan@example.com (password = SEED_DEMO_PASSWORD). The demo artisan is NOT verified.");
  }
  await mongoose.disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
