import { connectDb } from "../lib/db";
import { getSettings } from "../lib/settings";
import { Location } from "../models/misc";
import { ServiceCategory } from "../models/service";

export async function getCategories(featuredOnly = false) {
  await connectDb();
  return ServiceCategory.find({ active: true, ...(featuredOnly ? { featured: true } : {}) }).sort({ sortOrder: 1, name: 1 }).lean();
}
/** Areas in the configured launch states/cities only. */
export async function getLaunchLocations() {
  await connectDb();
  const s = await getSettings();
  const locs = await Location.find({ active: true }).sort({ city: 1, name: 1 }).lean();
  return locs.filter((l) => s.launchCities.some((c) => l.state === c || l.city === c));
}
export const pretty = (slug: string) => slug.split("/").pop()!.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
