import Link from "next/link";
import { EmptyState, Money, StatusPill, dateTime } from "@/components/ui";
import type { BookingDoc } from "@/models/booking";
import type { Types } from "mongoose";

type B = BookingDoc & { _id: Types.ObjectId };
export function BookingList({ bookings, base, emptyTitle, emptyBody }: { bookings: B[]; base: string; emptyTitle: string; emptyBody: string }) {
  if (!bookings.length) return <EmptyState title={emptyTitle} body={emptyBody} href={base.startsWith("/dashboard") ? "/services" : undefined} cta="Find a service" />;
  return (
    <ul className="space-y-3">
      {bookings.map((b) => (
        <li key={String(b._id)}>
          <Link href={`${base}/${b._id}`} className="panel block hover:border-ink-500">
            <div className="flex flex-wrap items-center justify-between gap-2"><p className="font-display text-lg font-bold">{b.serviceTitle}</p><StatusPill status={b.status} /></div>
            <p className="mt-1 text-sm text-ink-500">{dateTime(b.startsAt)} · {b.address?.area} · {b.reference}</p>
            {b.pricing?.totalKobo ? <p className="mt-1 font-semibold"><Money kobo={b.pricing.totalKobo} /></p> : null}
          </Link>
        </li>
      ))}
    </ul>
  );
}
