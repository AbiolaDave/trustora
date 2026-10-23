import Link from "next/link";
import { env } from "../lib/env";

export function SiteFooter() {
  const wa = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER;
  const l = "text-ink-200 hover:text-white";
  return (
    <footer className="mt-16 bg-ink-900 text-ink-200">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:grid-cols-3">
        <div>
          <p className="font-display text-lg font-bold text-white">{env.APP_NAME}</p>
          <p className="mt-2 max-w-xs text-sm">Book artisans you can trust for your home, shop or office.</p>
          {wa && <a className="btn btn-accent btn-sm mt-4" href={`https://wa.me/${wa}`} rel="noopener">Chat with support on WhatsApp</a>}
        </div>
        <div>
          <p className="font-semibold text-white">Explore</p>
          <ul className="mt-2 space-y-1.5 text-sm">
            <li><Link className={l} href="/services">Find a service</Link></li>
            <li><Link className={l} href="/how-it-works">How it works</Link></li>
            <li><Link className={l} href="/trust">Trust &amp; verification</Link></li>
            <li><Link className={l} href="/pricing">Pricing &amp; fees</Link></li>
            <li><Link className={l} href="/register?role=artisan">Join as an artisan</Link></li>
            <li><Link className={l} href="/help">Help &amp; contact</Link></li>
          </ul>
        </div>
        <div>
          <p className="font-semibold text-white">Policies</p>
          <ul className="mt-2 space-y-1.5 text-sm">
            <li><Link className={l} href="/legal/terms">Terms of service</Link></li>
            <li><Link className={l} href="/legal/privacy">Privacy policy</Link></li>
            <li><Link className={l} href="/legal/cancellation">Cancellation &amp; refunds</Link></li>
            <li><Link className={l} href="/legal/disputes">Disputes</Link></li>
          </ul>
        </div>
      </div>
    </footer>
  );
}
