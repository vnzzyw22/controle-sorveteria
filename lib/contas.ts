// Onde fica o dinheiro da empresa. Vendas e pagamentos em dinheiro mexem na espécie; o resto (Pix, cartão,
// boleto) mexe no banco (conta do Mercado Pago).

export const CONTAS = ['banco', 'especie'] as const
export type Conta = (typeof CONTAS)[number]

export const CONTA_LABEL: Record<Conta, string> = {
  banco: 'Mercado Pago (banco)',
  especie: 'Dinheiro em espécie',
}

export const isConta = (v: unknown): v is Conta => typeof v === 'string' && (CONTAS as readonly string[]).includes(v)

/** Conta que uma forma de pagamento movimenta. */
export const contaDaForma = (forma: string): Conta => (forma === 'dinheiro' ? 'especie' : 'banco')
