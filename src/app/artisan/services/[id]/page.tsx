import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { connectDb } from "@/lib/db";
import { requireArtisan } from "@/lib/auth/server";
import { Service } from "@/models/service";
import { getCategories } from "@/server/queries";
import { ServiceForm } from "@/components/service-form";
import { Flash, PageHeader } from "@/components/ui";
import { first, objectId } from "@/lib/validation";

export const metadata: Metadata = { title: "Edit service" };
export const dynamic = "force-dynamic";

export default async function EditService({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const [{ id }, sp, { profile }] = await Promise.all([params, searchParams, requireArtisan()]);
  if (!profile || !objectId.safeParse(id).success) notFound();
  await connectDb();
  const service = await Service.findOne({ _id: id, artisan: profile._id }).lean(); // only your own
  if (!service) notFound();
  return (<><Flash ok={first(sp.ok)} error={first(sp.error)} /><PageHeader title="Edit service" intro="Changes apply to new bookings. Existing bookings keep the price they were made at." /><ServiceForm categories={await getCategories()} service={service} /></>);
}
