/** Logo da UP: preta sobre fundos claros, branca sobre escuros (`invert`) e no tema escuro. */
export function Logo({ className = 'h-10 w-auto', invert = false }: { className?: string; invert?: boolean }) {
  return (
    <>
      <img src={invert ? '/brand/up-logo-white.svg' : '/brand/up-logo-black.svg'} alt="Unidade Popular" className={`${className} dark:hidden`} />
      <img src="/brand/up-logo-white.svg" alt="Unidade Popular" className={`${className} hidden dark:block`} />
    </>
  );
}
