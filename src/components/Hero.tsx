import { Logo } from './Logo';
import { JoinCta } from './JoinCta';
import { GeradoEm } from './GeradoEm';

export function Hero() {
  return (
    <header className="bg-[var(--band)]">
      <div className="mx-auto max-w-7xl px-4 py-10 md:py-16 grid gap-8 md:grid-cols-[1fr_auto] items-end">
        <div className="min-w-0">
          <Logo className="h-14 md:h-20 w-auto" />
          <h1 className="mt-6 font-display font-extrabold uppercase leading-[0.9] text-5xl md:text-7xl">
            A Unidade Popular <br /> nas urnas <span className="inline-block bg-amarelo text-preto px-2 italic">80</span>
          </h1>
          <p className="mt-4 max-w-2xl text-lg md:text-xl font-light">
            Onde recebemos votos de 2020 a 2026, onde crescemos e onde ainda temos chão pela frente — no Brasil e no exterior.
          </p>
        </div>
        <div><JoinCta /></div>
      </div>
      <GeradoEm />
    </header>
  );
}
