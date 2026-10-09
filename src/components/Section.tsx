import type { ReactNode } from 'react';

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-3 min-w-0">
      <h2 className="font-display font-extrabold uppercase text-2xl md:text-3xl">{title}</h2>
      {children}
    </section>
  );
}
