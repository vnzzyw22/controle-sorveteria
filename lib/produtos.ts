// Produtos da sorveteria. Cada venda é classificada pelo valor: preço exato de um produto fixo
// vira aquele produto; qualquer outro valor ("quebrado", da balança) é self-service.
// Para mudar um preço ou criar um produto, altere só esta lista.

export const PRODUTOS = [
  { id: 'self_service', nome: 'Self-service', precoCentavos: null, grupo: 'sorvete' },
  { id: 'cascao_1', nome: 'Cascão 1 bola', precoCentavos: 799, grupo: 'sorvete' },
  { id: 'cascao_2', nome: 'Cascão 2 bolas', precoCentavos: 1199, grupo: 'sorvete' },
  { id: 'agua', nome: 'Água', precoCentavos: 400, grupo: 'bebida' },
  { id: 'refrigerante', nome: 'Refrigerante', precoCentavos: 700, grupo: 'bebida' },
  { id: 'suco', nome: 'Suco', precoCentavos: 800, grupo: 'bebida' },
  { id: 'monster', nome: 'Monster', precoCentavos: 1400, grupo: 'bebida' },
  { id: 'red_bull', nome: 'Red Bull', precoCentavos: 1500, grupo: 'bebida' },
] as const

export type ProdutoId = (typeof PRODUTOS)[number]['id']
export const PRODUTO_PADRAO: ProdutoId = 'self_service'

export function isProdutoId(valor: unknown): valor is ProdutoId {
  return PRODUTOS.some((p) => p.id === valor)
}

/** Valor exato de um produto de preço fixo -> esse produto; qualquer outro valor -> self-service. */
export function produtoPeloValor(centavos: number): ProdutoId {
  return PRODUTOS.find((p) => p.precoCentavos === centavos)?.id ?? PRODUTO_PADRAO
}

export function nomeProduto(id: string | null | undefined): string {
  return PRODUTOS.find((p) => p.id === id)?.nome ?? 'Self-service'
}

/** CASE em SQL equivalente a produtoPeloValor, para classificar vendas que já estavam no banco. */
export function produtoPeloValorSql(coluna: string): string {
  const casos = PRODUTOS.filter((p) => p.precoCentavos !== null)
    .map((p) => `WHEN ${(p.precoCentavos! / 100).toFixed(2)} THEN '${p.id}'`)
    .join(' ')
  return `CASE ${coluna} ${casos} ELSE '${PRODUTO_PADRAO}' END`
}
