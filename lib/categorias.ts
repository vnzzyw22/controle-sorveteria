// Categorias das saídas. O campo continua livre (dá para digitar outra), mas estas sugestões
// e a unificação de maiúsculas/acentos evitam "Energia", "energia" e "Energía" virarem três linhas no resumo.

export const CATEGORIAS_PADRAO = [
  'Leite e laticínios',
  'Frutas e polpas',
  'Casquinhas e embalagens',
  'Aluguel',
  'Funcionários',
  'Energia e água',
  'Manutenção e equipamentos',
  'Marketing',
  'Impostos',
  'Outros',
] as const

const MARCAS_DE_ACENTO = new RegExp('[\\u0300-\\u036f]', 'g')

/** Chave de comparação: sem acento, sem maiúscula, sem espaços repetidos. */
export function chaveCategoria(texto: string): string {
  return texto.normalize('NFD').replace(MARCAS_DE_ACENTO, '').toLowerCase().replace(/\s+/g, ' ').trim()
}

/**
 * Devolve a grafia já usada quando a categoria digitada é "a mesma" (ignorando maiúsculas e acentos);
 * senão, a própria digitada com a primeira letra maiúscula.
 */
export function categoriaCanonica(digitada: string, conhecidas: readonly string[]): string | null {
  const limpa = digitada.replace(/\s+/g, ' ').trim()
  if (!limpa) return null
  const chave = chaveCategoria(limpa)
  const igual = conhecidas.find((c) => chaveCategoria(c) === chave)
  if (igual) return igual
  return limpa.charAt(0).toUpperCase() + limpa.slice(1)
}

/** Sugestões do formulário: primeiro as mais usadas, depois as padrão que ainda não foram usadas. */
export function sugestoesCategorias(usadas: readonly string[], limite = 14): string[] {
  const vistas = new Set<string>()
  const lista: string[] = []
  for (const c of [...usadas, ...CATEGORIAS_PADRAO]) {
    const chave = chaveCategoria(c)
    if (!chave || vistas.has(chave)) continue
    vistas.add(chave)
    lista.push(c)
  }
  return lista.slice(0, limite)
}
