export default function Loading() {
  return (
    <div className="mx-auto max-w-6xl animate-pulse px-4 py-10" aria-busy="true" aria-label="Loading">
      <div className="h-8 w-56 rounded bg-ink-100" />
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{[0, 1, 2].map((i) => <div key={i} className="h-40 rounded-xl bg-ink-100" />)}</div>
    </div>
  );
}
