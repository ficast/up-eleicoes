export const FILIE_SE = 'https://unidadepopular.org.br/filie-se';

export function JoinCta({ size = 'lg' }: { size?: 'sm' | 'lg' }) {
  const cls = size === 'lg'
    ? 'px-5 py-3 text-xl sm:px-6 sm:py-4 sm:text-2xl md:text-3xl'
    : 'px-3 py-1.5 text-base';
  return (
    <a href={FILIE_SE} target="_blank" rel="noopener"
      className={`inline-flex items-center gap-2 bg-amarelo text-preto font-display font-extrabold uppercase italic tracking-tight leading-tight border-2 border-preto shadow-[4px_4px_0_#000] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0_#000] focus-visible:outline-3 focus-visible:outline-preto focus-visible:outline-offset-2 transition-transform ${cls}`}>
      Votei na UP e quero me organizar! <span aria-hidden>→</span>
    </a>
  );
}
