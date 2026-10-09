export function Segmented<T extends string | number>({ label, value, options, onChange }: {
  label: string; value: T | undefined; options: { value: T; label: string; disabled?: boolean; hint?: string }[]; onChange: (v: T) => void;
}) {
  return (
    <fieldset className="min-w-0 max-w-full">
      <legend className="font-display uppercase text-xs tracking-widest text-[var(--muted)] mb-1">{label}</legend>
      <div role="radiogroup" aria-label={label} className="flex flex-wrap border-2 border-[var(--line)]">
        {options.map((o) => (
          <button key={String(o.value)} type="button" role="radio" aria-checked={value === o.value} disabled={o.disabled} title={o.hint}
            onClick={() => onChange(o.value)}
            className={`px-3 py-1.5 font-display font-bold uppercase text-sm md:text-base whitespace-nowrap transition-colors disabled:opacity-35 disabled:cursor-not-allowed
              ${value === o.value ? 'bg-[var(--fg)] text-[var(--bg)]' : 'hover:bg-[var(--band)]'}`}>
            {o.label}
          </button>
        ))}
      </div>
    </fieldset>
  );
}
