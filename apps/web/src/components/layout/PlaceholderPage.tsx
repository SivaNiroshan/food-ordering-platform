/** Temporary page for routes whose feature is built in a later phase. */
export function PlaceholderPage({ title, phase }: { title: string; phase: string }) {
  return (
    <section>
      <h1 className="text-3xl font-bold">{title}</h1>
      <p className="mt-2 text-ash">This page is built in phase {phase}.</p>
    </section>
  );
}
