// Datas de negócio circulam como texto "AAAA-MM-DD" (sem fuso), no horário de Brasília.
// O servidor (Vercel) roda em UTC, então "hoje" sempre é calculado explicitamente no fuso da loja.

export const TIMEZONE = 'America/Sao_Paulo'

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

export function isIsoDate(value: unknown): value is string {
  if (typeof value !== 'string' || !ISO_DATE.test(value)) return false
  const [y, m, d] = value.split('-').map(Number)
  const date = new Date(Date.UTC(y, m - 1, d))
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d
}

export function hoje(now: Date = new Date()): string {
  // en-CA formata como AAAA-MM-DD
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now)
}

function toUTC(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d))
}

function fromUTC(date: Date): string {
  return date.toISOString().slice(0, 10)
}

export function addDays(iso: string, days: number): string {
  const date = toUTC(iso)
  date.setUTCDate(date.getUTCDate() + days)
  return fromUTC(date)
}

/** Soma meses mantendo o dia; se o mês não tiver o dia (31/01 + 1), usa o último dia do mês. */
export function addMonths(iso: string, months: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  const target = new Date(Date.UTC(y, m - 1 + months, 1))
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate()
  target.setUTCDate(Math.min(d, lastDay))
  return fromUTC(target)
}

export function inicioDoMes(iso: string): string {
  return `${iso.slice(0, 7)}-01`
}

export function formatData(iso: string): string {
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

export function formatDataCurta(iso: string): string {
  const [, m, d] = iso.split('-')
  return `${d}/${m}`
}

const weekday = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', timeZone: 'UTC' })
const longDate = new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'long', timeZone: 'UTC' })

export function formatDataExtenso(iso: string): string {
  const date = toUTC(iso)
  const texto = `${weekday.format(date)}, ${longDate.format(date)}`
  return texto.charAt(0).toUpperCase() + texto.slice(1)
}

export function formatHora(date: Date): string {
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}
