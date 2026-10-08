// Links para editar uma venda ou uma saída. `voltar` é a tela de onde a pessoa veio (volta para lá ao salvar).

/** Aceita só caminhos internos ("/historico?aba=saidas"); qualquer outra coisa cai no padrão. */
export function voltarSeguro(raw: string | string[] | undefined, padrao: string): string {
  const valor = Array.isArray(raw) ? raw[0] : raw
  if (!valor || !valor.startsWith('/') || valor.startsWith('//') || valor.includes('\\')) return padrao
  return valor
}

export const linkEditarVenda = (id: number, voltar: string) => `/vendas/${id}/editar?voltar=${encodeURIComponent(voltar)}`

export const linkEditarSaida = (id: number, voltar: string) => `/saidas/${id}/editar?voltar=${encodeURIComponent(voltar)}`
