import Link from "next/link";
export default function NotFound() {
  return (
    <div className="mx-auto max-w-lg px-4 py-20 text-center">
      <h1 className="text-3xl font-bold">We couldn't find that page</h1>
      <p className="mt-2 text-ink-500">The link may be old, or the booking may belong to a different account.</p>
      <Link href="/" className="btn btn-primary mt-6">Go to the homepage</Link>
    </div>
  );
}
