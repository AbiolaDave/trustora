import type { Metadata } from "next";
import { requireArtisan } from "@/lib/auth/server";
import { saveAvailabilityAction } from "@/server/actions/artisan";
import { Flash, PageHeader } from "@/components/ui";
import { first } from "@/lib/validation";

export const metadata: Metadata = { title: "Availability" };
export const dynamic = "force-dynamic";
const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const hhmm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

export default async function Availability({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams; const { profile } = await requireArtisan();
  const byDay = new Map((profile?.workingWindows ?? []).map((w) => [w.dayOfWeek, w]));
  return (<><Flash ok={first(sp.ok)} error={first(sp.error)} /><PageHeader title="Availability" intro="Customers can only book inside these hours. Times are Nigerian time." />
    <form action={saveAvailabilityAction} className="panel space-y-4">
      <ul className="space-y-3">{DAYS.map((d, i) => { const w = byDay.get(i); return (
        <li key={d} className="grid grid-cols-[1fr_auto_auto] items-center gap-2 sm:grid-cols-[160px_auto_auto]">
          <label className="flex items-center gap-2 font-semibold"><input type="checkbox" name={`day${i}`} defaultChecked={!!w} className="h-5 w-5" />{d}</label>
          <div><label className="sr-only" htmlFor={`start${i}`}>{d} start</label><input id={`start${i}`} type="time" name={`start${i}`} defaultValue={hhmm(w?.startMinute ?? 480)} className="input" /></div>
          <div><label className="sr-only" htmlFor={`end${i}`}>{d} end</label><input id={`end${i}`} type="time" name={`end${i}`} defaultValue={hhmm(w?.endMinute ?? 1020)} className="input" /></div></li>); })}</ul>
      <div><label htmlFor="blackout" className="label">Days off (one date per line, YYYY-MM-DD)</label><textarea id="blackout" name="blackout" rows={3} className="input" defaultValue={(profile?.blackoutDates ?? []).join("\n")} placeholder="2026-12-25" /></div>
      <label className="flex items-start gap-2"><input type="checkbox" name="paused" defaultChecked={!!profile?.paused} className="mt-1 h-5 w-5" /><span><strong>Pause new bookings</strong><br /><span className="text-sm text-ink-500">Use when you're fully booked. You'll be hidden from search. Existing bookings stay.</span></span></label>
      <button className="btn btn-primary">Save availability</button></form></>);
}
