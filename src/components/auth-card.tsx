export function AuthCard({ title, intro, children }: { title: string; intro?: string; children: React.ReactNode }) {
  return (
    <main className="mx-auto max-w-md px-4 py-12">
      <h1 className="text-3xl font-bold">{title}</h1>
      {intro && <p className="mt-2 text-ink-500">{intro}</p>}
      <div className="panel mt-6">{children}</div>
    </main>
  );
}
