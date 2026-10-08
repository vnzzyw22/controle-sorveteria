export function LogoMark({ className = 'size-9' }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" aria-hidden className={className}>
      <circle cx="20" cy="20" r="20" fill="var(--color-framboesa)" />
      {/* bola */}
      <path d="M11 18a9 9 0 0 1 18 0z" fill="var(--color-creme)" />
      <circle cx="16" cy="13.5" r="1.3" fill="var(--color-framboesa-clara)" />
      <circle cx="22.5" cy="12" r="1.1" fill="var(--color-framboesa-clara)" />
      {/* casquinha */}
      <path d="M11.5 19.5h17L20 33z" fill="#e9b872" />
      <path d="M15 19.5l7 9M20 19.5l4.4 5.6M25 19.5l-8 10.3" stroke="#c48a3f" strokeWidth="1" fill="none" />
    </svg>
  )
}

export function Logo() {
  return (
    <span className="flex items-center gap-2.5">
      <LogoMark />
      <span className="leading-tight">
        <span className="block font-display text-[17px] font-bold tracking-tight">Caixa da Sorveteria</span>
        <span className="block text-xs text-cacau-suave">Fluxo de caixa</span>
      </span>
    </span>
  )
}
