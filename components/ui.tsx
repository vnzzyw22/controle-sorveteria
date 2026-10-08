'use client'

import { animate, motion, useReducedMotion } from 'framer-motion'
import { Loader2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useFormStatus } from 'react-dom'
import { FORMA_LABEL, formatBRL, type FormaSaida } from '@/lib/money'

/** Valor em reais que "rola" até o número novo; leitores de tela recebem só o valor final. */
export function AnimatedBRL({ cents, className }: { cents: number; className?: string }) {
  const reduce = useReducedMotion()
  const [shown, setShown] = useState(cents)
  const from = useRef(cents)

  useEffect(() => {
    if (reduce) {
      setShown(cents)
      from.current = cents
      return
    }
    const controls = animate(from.current, cents, {
      duration: 0.5,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (v) => setShown(Math.round(v)),
    })
    from.current = cents
    return () => controls.stop()
  }, [cents, reduce])

  return (
    <span className={`tabular ${className ?? ''}`}>
      <span aria-hidden>{formatBRL(shown)}</span>
      <span className="sr-only">{formatBRL(cents)}</span>
    </span>
  )
}

const FORMA_CLASSES: Record<FormaSaida, string> = {
  dinheiro: 'bg-dinheiro-fundo text-dinheiro',
  pix: 'bg-pix-fundo text-pix',
  debito: 'bg-debito-fundo text-debito',
  credito: 'bg-credito-fundo text-credito',
  boleto: 'bg-boleto-fundo text-boleto',
}

export const FORMA_BAR: Record<FormaSaida, string> = {
  dinheiro: 'bg-[#8fbf6a]',
  pix: 'bg-[#4fb8a4]',
  debito: 'bg-[#e8c35a]',
  credito: 'bg-[#e07a98]',
  boleto: 'bg-[#8a93a6]',
}

export function FormaBadge({ forma, parcelas }: { forma: FormaSaida; parcelas?: number }) {
  return (
    <span
      className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ${FORMA_CLASSES[forma]}`}
    >
      {FORMA_LABEL[forma]}
      {parcelas && parcelas > 1 ? ` ${parcelas}x` : ''}
    </span>
  )
}

export function SubmitButton({
  children,
  pendingLabel = 'Salvando…',
  className = '',
  disabled,
}: {
  children: React.ReactNode
  pendingLabel?: string
  className?: string
  disabled?: boolean
}) {
  const { pending } = useFormStatus()
  return (
    <motion.button
      type="submit"
      disabled={pending || disabled}
      whileTap={{ scale: 0.98 }}
      className={`inline-flex items-center justify-center gap-2 rounded-xl bg-framboesa px-5 py-3 font-semibold text-white shadow-sm shadow-framboesa/30 transition-colors hover:bg-framboesa-escura disabled:cursor-not-allowed disabled:opacity-55 ${className}`}
    >
      {pending && <Loader2 aria-hidden className="size-4 animate-spin" />}
      {pending ? pendingLabel : children}
    </motion.button>
  )
}

/**
 * Grupo de opções (rádios nativos) com um "marcador" que desliza até a opção escolhida.
 * Teclado: setas trocam a opção, como em qualquer grupo de rádio.
 */
export function Segmented<T extends string>({
  name,
  legend,
  options,
  value,
  onChange,
  layoutId,
  columns,
  size = 'md',
  hideLegend,
}: {
  name: string
  legend: string
  options: { value: T; label: React.ReactNode; tone?: string; disabled?: boolean }[]
  value: T
  onChange: (v: T) => void
  layoutId: string
  columns?: string
  size?: 'md' | 'lg'
  hideLegend?: boolean
}) {
  return (
    <fieldset>
      <legend className={hideLegend ? 'sr-only' : 'rotulo'}>{legend}</legend>
      <div className={`grid gap-1.5 rounded-2xl bg-creme-fundo p-1.5 ${columns ?? 'grid-flow-col auto-cols-fr'}`}>
        {options.map((o) => {
          const checked = o.value === value
          return (
            <label
              key={o.value}
              className={`relative flex cursor-pointer select-none items-center justify-center gap-2 rounded-xl text-center font-semibold transition-colors has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-framboesa ${
                size === 'lg' ? 'min-h-14 px-2 text-[15px]' : 'min-h-11 px-2 text-sm'
              } ${checked ? (o.tone ?? 'text-cacau') : 'text-cacau-suave hover:text-cacau'} ${
                o.disabled ? 'cursor-not-allowed opacity-45' : ''
              }`}
            >
              <input
                type="radio"
                name={name}
                value={o.value}
                checked={checked}
                disabled={o.disabled}
                onChange={() => onChange(o.value)}
                className="sr-only"
              />
              {checked && (
                <motion.span
                  layoutId={layoutId}
                  transition={{ type: 'spring', stiffness: 550, damping: 38 }}
                  className="absolute inset-0 rounded-xl bg-superficie shadow-sm ring-1 ring-linha"
                />
              )}
              <span className="relative flex items-center gap-2">{o.label}</span>
            </label>
          )
        })}
      </div>
    </fieldset>
  )
}

/**
 * Campo de dinheiro no estilo maquininha: os dígitos entram pela direita (1, 12, 125 -> R$ 1,25).
 * O valor vai para o servidor em centavos, num campo oculto.
 */
export function MoneyInput({
  name,
  id,
  value,
  onChange,
  large,
  autoFocus,
  describedBy,
  inputRef,
}: {
  name: string
  id: string
  value: number
  onChange: (cents: number) => void
  large?: boolean
  autoFocus?: boolean
  describedBy?: string
  inputRef?: React.Ref<HTMLInputElement>
}) {
  return (
    <>
      <input
        ref={inputRef}
        id={id}
        inputMode="numeric"
        autoComplete="off"
        autoFocus={autoFocus}
        aria-describedby={describedBy}
        value={value ? formatBRL(value) : ''}
        placeholder="R$ 0,00"
        onChange={(e) => {
          const digits = e.target.value.replace(/\D/g, '').slice(0, 9)
          onChange(Number(digits || '0'))
        }}
        className={`campo tabular ${large ? 'rounded-2xl! py-4! text-right font-display text-4xl! font-bold tracking-tight' : 'text-right'}`}
      />
      <input type="hidden" name={name} value={value || ''} />
    </>
  )
}

/** Botão de exclusão em duas etapas, sem janela modal. */
export function ConfirmButton({
  onConfirm,
  label,
  confirmLabel,
  className = '',
}: {
  onConfirm: () => Promise<void> | void
  label: string
  confirmLabel: string
  className?: string
}) {
  const [armed, setArmed] = useState(false)
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    if (!armed) return
    const t = setTimeout(() => setArmed(false), 4000)
    return () => clearTimeout(t)
  }, [armed])

  return (
    <button
      type="button"
      disabled={busy}
      onClick={async () => {
        if (!armed) return setArmed(true)
        setBusy(true)
        try {
          await onConfirm()
        } finally {
          setBusy(false)
          setArmed(false)
        }
      }}
      className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors disabled:opacity-60 ${
        armed ? 'bg-saida text-white' : 'border border-linha text-saida hover:border-saida/40 hover:bg-saida/5'
      } ${className}`}
    >
      {busy && <Loader2 aria-hidden className="size-4 animate-spin" />}
      {armed ? confirmLabel : label}
    </button>
  )
}

export function PageHeader({
  title,
  description,
  children,
}: {
  title: string
  description?: React.ReactNode
  children?: React.ReactNode
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="font-display text-[28px] font-bold leading-tight tracking-tight sm:text-[32px]">{title}</h1>
        {description && <p className="mt-1 text-cacau-suave">{description}</p>}
      </div>
      {children}
    </div>
  )
}
