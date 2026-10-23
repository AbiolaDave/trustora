import Link from "next/link";
import type { ReactNode } from "react";
import { formatNaira } from "@/domain/pricing";

export function Flash({ ok, error }: { ok?: string; error?: string }) {
  if (!ok && !error) return null;
  return (
    <div role={error ? "alert" : "status"} className={`mb-5 rounded-lg border px-4 py-3 text-[15px] ${error ? "border-pepper-600/40 bg-pepper-50 text-pepper-700" : "border-leaf-600/30 bg-leaf-50 text-leaf-700"}`}>
      {error ?? ok}
    </div>
  );
}

export function Field({ label, name, hint, className = "", ...rest }: { label: string; name: string; hint?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className={className}>
      <label htmlFor={name} className="label">{label}</label>
      <input id={name} name={name} className="input" {...rest} />
      {hint && <p className="hint">{hint}</p>}
    </div>
  );
}

export function TextArea({ label, name, hint, ...rest }: { label: string; name: string; hint?: string } & React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <div>
      <label htmlFor={name} className="label">{label}</label>
      <textarea id={name} name={name} rows={4} className="input" {...rest} />
      {hint && <p className="hint">{hint}</p>}
    </div>
  );
}

export function PageHeader({ title, children, intro }: { title: string; intro?: string; children?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-3xl font-bold">{title}</h1>
        {intro && <p className="mt-1 max-w-prose text-ink-500">{intro}</p>}
      </div>
      {children}
    </div>
  );
}

export function EmptyState({ title, body, href, cta }: { title: string; body: string; href?: string; cta?: string }) {
  return (
    <div className="rounded-xl border border-dashed border-ink-200 bg-white px-6 py-10 text-center">
      <p className="font-display text-lg font-bold">{title}</p>
      <p className="mx-auto mt-1 max-w-md text-ink-500">{body}</p>
      {href && cta && <Link href={href} className="btn btn-primary mt-5">{cta}</Link>}
    </div>
  );
}

const STATUS: Record<string, { label: string; cls: string }> = {
  pending_artisan_response: { label: "Waiting for artisan", cls: "bg-sun-100 text-sun-700" },
  awaiting_customer_approval: { label: "Quote ready to review", cls: "bg-sun-100 text-sun-700" },
  awaiting_payment: { label: "Awaiting payment", cls: "bg-sun-100 text-sun-700" },
  confirmed: { label: "Confirmed", cls: "bg-leaf-50 text-leaf-700" },
  in_progress: { label: "In progress", cls: "bg-ink-100 text-ink-700" },
  completed: { label: "Completed", cls: "bg-leaf-50 text-leaf-700" },
  cancelled: { label: "Cancelled", cls: "bg-ink-100 text-ink-500" },
  disputed: { label: "Under review", cls: "bg-pepper-50 text-pepper-700" },
  expired: { label: "Expired", cls: "bg-ink-100 text-ink-500" },
};
export const statusLabel = (s: string) => STATUS[s]?.label ?? s;
export function StatusPill({ status }: { status: string }) {
  const s = STATUS[status] ?? { label: status, cls: "bg-ink-100 text-ink-700" };
  return <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${s.cls}`}>{s.label}</span>;
}

export function VerifiedBadge({ status }: { status: string }) {
  // Only an approved profile ever gets the badge. Every other state says exactly what it is.
  if (status === "verified") return <span className="inline-flex items-center gap-1 rounded-full bg-leaf-50 px-2.5 py-0.5 text-xs font-semibold text-leaf-700"><svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2 4 5v6c0 5 3.4 9.7 8 11 4.6-1.3 8-6 8-11V5l-8-3Zm-1.2 14.2-3.5-3.5 1.4-1.4 2.1 2.1 4.6-4.6 1.4 1.4-6 6Z" /></svg>ID verified</span>;
  return <span className="inline-block rounded-full bg-ink-100 px-2.5 py-0.5 text-xs font-semibold text-ink-500">Not yet verified</span>;
}

export function Rating({ avg, count }: { avg: number; count: number }) {
  if (!count) return <span className="text-sm text-ink-500">No reviews yet</span>; // never invent ratings
  return <span className="text-sm"><span className="font-semibold text-sun-700">★ {avg.toFixed(1)}</span> <span className="text-ink-500">({count} {count === 1 ? "review" : "reviews"})</span></span>;
}

export function Money({ kobo }: { kobo: number | null | undefined }) {
  return <>{kobo == null ? "-" : formatNaira(kobo)}</>;
}

export function PriceBreakdown({ p, title = "Price breakdown" }: { p?: { serviceChargeKobo?: number | null; travelKobo?: number | null; customerFeeKobo?: number | null; totalKobo?: number | null } | null; title?: string }) {
  if (!p?.totalKobo) return null;
  const rows: [string, number | null | undefined][] = [["Artisan's service charge", p.serviceChargeKobo], ["Travel charge", p.travelKobo], ["Booking fee", p.customerFeeKobo]];
  return (
    <dl className="rounded-lg bg-ink-50 p-4 text-[15px]" aria-label={title}>
      {rows.filter(([, v]) => v && v > 0).map(([k, v]) => (
        <div key={k} className="flex justify-between py-0.5"><dt className="text-ink-500">{k}</dt><dd><Money kobo={v} /></dd></div>
      ))}
      <div className="mt-2 flex justify-between border-t border-ink-200 pt-2 text-base font-bold"><dt>Total</dt><dd><Money kobo={p.totalKobo} /></dd></div>
    </dl>
  );
}

export function Pager({ page, pages, params }: { page: number; pages: number; params: Record<string, string | undefined> }) {
  if (pages <= 1) return null;
  const href = (n: number) => { const q = new URLSearchParams(); for (const [k, v] of Object.entries(params)) if (v) q.set(k, v); q.set("page", String(n)); return `?${q}`; };
  return (
    <nav className="mt-6 flex items-center justify-between" aria-label="Pagination">
      {page > 1 ? <Link className="btn btn-ghost btn-sm" href={href(page - 1)}>Previous</Link> : <span />}
      <span className="text-sm text-ink-500">Page {page} of {pages}</span>
      {page < pages ? <Link className="btn btn-ghost btn-sm" href={href(page + 1)}>Next</Link> : <span />}
    </nav>
  );
}

export const dateTime = (d: Date | string) => new Date(d).toLocaleString("en-NG", { timeZone: "Africa/Lagos", weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
export const dateOnly = (d: Date | string) => new Date(d).toLocaleDateString("en-NG", { timeZone: "Africa/Lagos", day: "numeric", month: "short", year: "numeric" });
