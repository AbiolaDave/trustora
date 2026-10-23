import type { Metadata } from "next";
import { connectDb } from "@/lib/db";
import { ServiceCategory } from "@/models/service";
import { saveCategoryAction } from "@/server/actions/admin";
import { Field, Flash, PageHeader } from "@/components/ui";
import { first } from "@/lib/validation";

export const metadata: Metadata = { title: "Categories" };
export const dynamic = "force-dynamic";

export default async function Categories({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams; await connectDb();
  const cats = await ServiceCategory.find().sort({ name: 1 }).lean();
  return (<><Flash ok={first(sp.ok)} error={first(sp.error)} /><PageHeader title="Service categories" intro="Featured categories show on the homepage." />
    <ul className="mb-8 space-y-2">{cats.map((c) => (
      <li key={String(c._id)} className="panel"><form action={saveCategoryAction} className="flex flex-wrap items-end gap-3"><input type="hidden" name="categoryId" value={String(c._id)} />
        <div className="min-w-[200px] flex-1"><label className="label" htmlFor={`n${c._id}`}>Name</label><input id={`n${c._id}`} name="name" defaultValue={c.name} className="input" /></div>
        <label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" name="featured" defaultChecked={c.featured} className="h-5 w-5" />Featured</label>
        <label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" name="active" defaultChecked={c.active} className="h-5 w-5" />Active</label><button className="btn btn-ghost btn-sm">Save</button></form></li>))}</ul>
    <form action={saveCategoryAction} className="panel flex max-w-lg items-end gap-3"><Field className="flex-1" label="New category" name="name" required placeholder="e.g. Plumbing" /><button className="btn btn-primary">Add</button></form></>);
}
