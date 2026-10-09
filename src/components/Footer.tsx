import { Logo } from './Logo';
import { JoinCta } from './JoinCta';

export function Footer() {
  return (
    <footer className="bg-preto text-branco pb-28 lg:pb-0">
      <div className="mx-auto max-w-7xl px-4 py-12 flex flex-col md:flex-row gap-8 md:items-center md:justify-between">
        <div>
          <Logo invert className="h-12 w-auto" />
          <p className="mt-3 font-display uppercase text-2xl">Organize-se. Lute. Vença.</p>
          <p className="mt-2 text-sm text-cinza">Fonte: Tribunal Superior Eleitoral — Portal de Dados Abertos.</p>
        </div>
        <div><JoinCta /></div>
      </div>
    </footer>
  );
}
