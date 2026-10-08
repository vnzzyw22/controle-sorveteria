// Conversão de um pagamento do Mercado Pago em venda do sistema. Sem acesso à rede nem ao banco,
// para poder ser testado sozinho.

import { hoje } from './dates.ts'
import { decimalToCents, type FormaEntrada } from './money.ts'

/** Campos do pagamento (GET /v1/payments/{id}) que o sistema usa. */
export interface PagamentoMP {
  id?: string | number
  status?: string
  payment_type_id?: string
  installments?: number
  transaction_amount?: number
  date_approved?: string
  date_created?: string
  money_release_date?: string
  external_reference?: string
  fee_details?: { type?: string; amount?: number; fee_payer?: string }[]
  transaction_details?: { net_received_amount?: number }
  point_of_interaction?: { type?: string }
}

/** Tipo de pagamento do Mercado Pago -> forma de pagamento do sistema (null = não é venda de balcão). */
export function formaDoPagamento(tipo: string | undefined): FormaEntrada | null {
  switch (tipo) {
    case 'credit_card':
      return 'credito'
    case 'debit_card':
    case 'prepaid_card':
      return 'debito'
    case 'bank_transfer': // Pix
    case 'account_money':
      return 'pix'
    default:
      return null
  }
}

/** Data (AAAA-MM-DD) no horário de Brasília de um instante ISO do Mercado Pago. */
export function dataBrasilia(iso: string | undefined): string | null {
  if (!iso) return null
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? null : hoje(d)
}

export interface VendaDoMP {
  mpPaymentId: string
  forma: FormaEntrada
  parcelas: number
  brutoCentavos: number
  taxaCentavos: number
  liquidoCentavos: number
  /** Percentual efetivo cobrado, com duas casas (ex.: 3.15). */
  taxaPercentual: number
  data: string
  dataRecebimento: string
}

/**
 * Pagamento aprovado -> venda. A taxa é a que o Mercado Pago realmente cobrou (fee_details pago pela loja),
 * não a da tabela de Configurações. Devolve um motivo em texto quando o pagamento não vira venda.
 */
export function vendaDoPagamento(p: PagamentoMP): VendaDoMP | { ignorar: string } {
  if (p.id === undefined || p.id === null) return { ignorar: 'pagamento sem id' }
  if (p.status !== 'approved') return { ignorar: `status ${p.status ?? 'desconhecido'}` }
  const forma = formaDoPagamento(p.payment_type_id)
  if (!forma) return { ignorar: `tipo de pagamento ${p.payment_type_id ?? 'desconhecido'}` }

  const bruto = decimalToCents(p.transaction_amount ?? 0)
  if (bruto <= 0) return { ignorar: 'valor zerado' }
  const taxaDaLoja = (p.fee_details ?? [])
    .filter((f) => (f.fee_payer ?? 'collector') === 'collector')
    .reduce((soma, f) => soma + decimalToCents(f.amount ?? 0), 0)
  const liquidoInformado = p.transaction_details?.net_received_amount
  const liquido = liquidoInformado !== undefined ? decimalToCents(liquidoInformado) : bruto - taxaDaLoja
  const taxa = bruto - liquido

  const data = dataBrasilia(p.date_approved) ?? dataBrasilia(p.date_created) ?? hoje()
  return {
    mpPaymentId: String(p.id),
    forma,
    parcelas: forma === 'credito' ? Math.min(Math.max(p.installments ?? 1, 1), 12) : 1,
    brutoCentavos: bruto,
    taxaCentavos: taxa,
    liquidoCentavos: liquido,
    taxaPercentual: Math.round((taxa / bruto) * 10_000) / 100,
    data,
    dataRecebimento: dataBrasilia(p.money_release_date) ?? data,
  }
}

/** O terminal configurado pode ser o id completo (MODELO__SERIE) ou só o número/série da etiqueta. */
export function acharTerminal<T extends { id: string }>(terminais: T[], configurado: string): T | null {
  const alvo = configurado.trim().toUpperCase()
  if (!alvo) return terminais.length === 1 ? terminais[0] : null
  return (
    terminais.find((t) => t.id.toUpperCase() === alvo) ??
    terminais.find((t) => t.id.toUpperCase().endsWith(alvo) || t.id.toUpperCase().includes(alvo)) ??
    null
  )
}
