import type { Metadata } from "next";
import { requireArtisan } from "../../../lib/auth/server";
import { getLaunchLocations, pretty } from "../../../server/queries";
import { saveArtisanProfileAction } from "../../../server/actions/artisan";
import { Field, Flash, PageHeader, TextArea } from "../../../components/ui";
import { first } from "../../../lib/validation";

export const metadata: Metadata = { title: "Your profile" };
export const dynamic = "force-dynamic";

export default async function ArtisanProfilePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams; const { profile } = await requireArtisan(); const locs = await getLaunchLocations();
  if (!profile) return <Flash error="Profile not found." />;
  const cities = [...new Set(locs.map((l) => l.city))];
  return (<><Flash ok={first(sp.ok)} error={first(sp.error)} /><PageHeader title="Your profile" intro="This is what customers see before they book." />
    <form action={saveArtisanProfileAction} className="panel max-w-2xl space-y-4">
      <Field label="Name customers will see" name="displayName" defaultValue={profile.displayName} required />
      <TextArea label="About you" name="bio" defaultValue={profile.bio ?? ""} hint="Your trade, experience and what makes you reliable." />
      <div className="grid gap-4 sm:grid-cols-2"><Field label="Years of experience" name="yearsExperience" type="number" min={0} max={60} defaultValue={profile.yearsExperience ?? 0} /><Field label="Skills (comma separated)" name="skills" defaultValue={(profile.skills ?? []).join(", ")} placeholder="Pipe repair, Water heaters" /></div>
      <fieldset><legend className="label">Areas you serve</legend>
        {locs.length === 0 ? <p className="text-sm text-ink-500">No areas have been configured yet. An admin adds them under Settings.</p> : cities.map((c) => (
          <div key={c} className="mb-3"><p className="text-sm font-semibold text-ink-500">{pretty(c)}</p>
            <div className="mt-1 grid grid-cols-2 gap-2 sm:grid-cols-3">{locs.filter((l) => l.city === c).map((l) => <label key={l.slug} className="flex items-center gap-2 text-[15px]"><input type="checkbox" name="areas" value={l.slug} defaultChecked={profile.serviceAreas?.includes(l.slug)} className="h-5 w-5" />{l.name}</label>)}</div></div>))}</fieldset>
      <button className="btn btn-primary">Save profile</button></form></>);
}
