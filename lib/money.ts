// Valores monetários circulam no sistema como centavos (inteiros) para evitar
// erros de arredondamento de ponto flutuante. O banco guarda NUMERIC(10,2).

export const FORMAS_ENTRADA = ['dinheiro', 'pix', 'debito', 'credito'] as const
export type FormaEntrada = (typeof FORMAS_ENTRADA)[number]

export const FORMAS_SAIDA = ['dinheiro', 'pix', 'debito', 'credito', 'boleto'] as const
export type FormaSaida = (typeof FORMAS_SAIDA)[number]

export const FORMA_LABEL: Record<FormaSaida, string> = {
  dinheiro: 'Dinheiro',
  pix: 'Pix',
  debito: 'Débito',
  credito: 'Crédito',
  boleto: 'Boleto',
}

export const MAX_PARCELAS_CREDITO = 12
export const MAX_PARCELAS_SAIDA = 48

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

export function formatBRL(centavos: number): string {
  return brl.format(centavos / 100)
}

/** "12.50" (formato do Postgres) -> 1250 */
export function decimalToCents(value: string | number | null | undefined): number {
  if (value === null || value === undefined || value === '') return 0
  const str = typeof value === 'number' ? value.toFixed(2) : value.trim()
  const negative = str.startsWith('-')
  const [int = '0', frac = ''] = str.replace('-', '').split('.')
  const cents = Number(int) * 100 + Number((frac + '00').slice(0, 2))
  return negative ? -cents : cents
}

/** 1250 -> "12.50" (para gravar no Postgres) */
export function centsToDecimal(centavos: number): string {
  const negative = centavos < 0
  const abs = Math.abs(centavos)
  const str = `${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, '0')}`
  return negative ? `-${str}` : str
}

/**
 * Lê valores digitados em formato brasileiro: "1.234,56", "12,5", "12" ou "12.50".
 * Retorna null quando não é um valor válido.
 */
export function parseBRLInput(raw: string): number | null {
  const s = raw.replace(/[R$\s]/g, '')
  if (!s) return null
  let normalized: string
  if (s.includes(',')) {
    normalized = s.replace(/\./g, '').replace(',', '.')
  } else if (/^\d{1,3}(\.\d{3})+$/.test(s)) {
    normalized = s.replace(/\./g, '')
  } else {
    normalized = s
  }
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return null
  return decimalToCents(normalized)
}

/** Percentual com até 2 casas, em centésimos de ponto: 3.15% -> 315 */
export function percentToBasis(percentual: number): number {
  return Math.round(percentual * 100)
}

export interface CalculoTaxa {
  taxaCentavos: number
  liquidoCentavos: number
}

/**
 * Taxa da maquininha sobre o valor bruto, arredondada ao centavo.
 * A conta usa inteiros (centavos x centésimos de ponto percentual) para ser exata.
 */
export function calcularTaxa(brutoCentavos: number, percentual: number): CalculoTaxa {
  const basis = percentToBasis(percentual)
  const taxaCentavos = Math.round((brutoCentavos * basis) / 10000)
  return { taxaCentavos, liquidoCentavos: brutoCentavos - taxaCentavos }
}

/**
 * Divide um total em N parcelas iguais; a última absorve os centavos que sobram.
 * Ex.: 10000 em 3 -> [3333, 3333, 3334]
 */
export function dividirParcelas(totalCentavos: number, n: number): number[] {
  if (!Number.isInteger(n) || n < 1) throw new Error('Número de parcelas inválido')
  const base = Math.floor(totalCentavos / n)
  const parcelas = Array.from({ length: n }, () => base)
  parcelas[n - 1] = totalCentavos - base * (n - 1)
  return parcelas
}
