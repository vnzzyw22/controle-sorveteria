import 'server-only'
import {
  calcularPainelMeta,
  fimDoMes,
  inicioDoPeriodo,
  mesDe,
  periodoMesAnterior,
  ultimosMeses,
  type DiaDaSemana,
  type PainelMeta,
} from './analise'
import { chaveCategoria } from './categorias'
import { query } from './db'
import { isProdutoId, produtoPeloValor, type ProdutoId } from './produtos'
import { addDays } from './dates'
import type { FiltroContas, FiltroSaidas, FiltroVendas } from './filters'
import { PAGE_SIZE } from './filters'
import { FORMAS_ENTRADA, decimalToCents, type FormaEntrada, type FormaSaida } from './money'

export interface Maquininha {
  id: number
  nome: string
  ativa: boolean
}

export interface Taxa {
  maquininhaId: number
  forma: 'debito' | 'credito' | 'pix'
  parcelas: number
  percentual: number
  prazoDias: number
}

export interface Entrada {
  id: number
  data: string
  descricao: string | null
  forma: FormaEntrada
  maquininhaId: number | null
  maquininhaNome: string | null
  produto: ProdutoId
  parcelas: number
  brutoCentavos: number
  taxaPercentual: number
  taxaCentavos: number
  liquidoCentavos: number
  dataRecebimento: string
  criadoEm: string
}

export interface Parcela {
  id: number
  saidaId: number
  numero: number
  totalParcelas: number
  vencimento: string
  valorCentavos: number
  pagoEm: string | null
  descricao: string
  categoria: string | null
  fornecedor: string | null
  forma: FormaSaida
}

export interface Saida {
  id: number
  data: string
  descricao: string
  categoria: string | null
  fornecedor: string | null
  forma: FormaSaida
  condicao: 'a_vista' | 'parcelado'
  numParcelas: number
  totalCentavos: number
  criadoEm: string
  parcelas: { id: number; numero: number; vencimento: string; valorCentavos: number; pagoEm: string | null }[]
}

// ---------- Maquininhas e taxas ----------

export async function getMaquininhas(): Promise<Maquininha[]> {
  return query<Maquininha>('SELECT id, nome, ativa FROM maquininhas ORDER BY ativa DESC, nome')
}

export async function getTaxas(): Promise<Taxa[]> {
  const rows = await query<{
    maquininha_id: number
    forma: Taxa['forma']
    parcelas: number
    percentual: string
    prazo_dias: number
  }>('SELECT maquininha_id, forma, parcelas, percentual, prazo_dias FROM taxas')
  return rows.map((r) => ({
    maquininhaId: r.maquininha_id,
    forma: r.forma,
    parcelas: r.parcelas,
    percentual: Number(r.percentual),
    prazoDias: r.prazo_dias,
  }))
}

// ---------- Entradas ----------

const ENTRADA_COLUMNS = /* sql */ `
  e.id, e.data, e.descricao, e.forma, e.maquininha_id, m.nome AS maquininha_nome, e.parcelas,
  e.valor_bruto, e.taxa_percentual, e.valor_taxa, e.valor_liquido, e.data_recebimento, e.criado_em, e.produto
`

interface EntradaRow {
  id: number
  data: string
  descricao: string | null
  forma: FormaEntrada
  maquininha_id: number | null
  maquininha_nome: string | null
  parcelas: number
  valor_bruto: string
  taxa_percentual: string
  valor_taxa: string
  valor_liquido: string
  data_recebimento: string
  criado_em: Date
  produto: string | null
}

function mapEntrada(r: EntradaRow): Entrada {
  return {
    id: r.id,
    data: r.data,
    descricao: r.descricao,
    forma: r.forma,
    maquininhaId: r.maquininha_id,
    maquininhaNome: r.maquininha_nome,
    produto: isProdutoId(r.produto) ? r.produto : produtoPeloValor(decimalToCents(r.valor_bruto)),
    parcelas: r.parcelas,
    brutoCentavos: decimalToCents(r.valor_bruto),
    taxaPercentual: Number(r.taxa_percentual),
    taxaCentavos: decimalToCents(r.valor_taxa),
    liquidoCentavos: decimalToCents(r.valor_liquido),
    dataRecebimento: r.data_recebimento,
    criadoEm: r.criado_em.toISOString(),
  }
}

function whereVendas(f: FiltroVendas): { sql: string; params: unknown[] } {
  const conds = ['e.data BETWEEN $1 AND $2']
  const params: unknown[] = [f.de, f.ate]
  if (f.forma) {
    params.push(f.forma)
    conds.push(`e.forma = $${params.length}`)
  }
  if (f.maquininha === 'nenhuma') {
    conds.push('e.maquininha_id IS NULL')
  } else if (f.maquininha) {
    params.push(f.maquininha)
    conds.push(`e.maquininha_id = $${params.length}`)
  }
  if (f.produto) {
    params.push(f.produto)
    conds.push(`e.produto = $${params.length}`)
  }
  if (f.q) {
    params.push(`%${f.q}%`)
    const n = params.length
    conds.push(`(e.descricao ILIKE $${n} OR CAST(e.id AS TEXT) = $${n + 1})`)
    params.push(f.q.replace(/^#/, ''))
  }
  return { sql: conds.join(' AND '), params }
}

export interface Totais {
  quantidade: number
  brutoCentavos: number
  taxaCentavos: number
  liquidoCentavos: number
}

export async function listVendas(f: FiltroVendas, opts: { all?: boolean } = {}) {
  const { sql, params } = whereVendas(f)
  const limit = opts.all ? '' : `LIMIT ${PAGE_SIZE} OFFSET ${(f.pagina - 1) * PAGE_SIZE}`
  const [rows, [tot]] = await Promise.all([
    query<EntradaRow>(
      `SELECT ${ENTRADA_COLUMNS} FROM entradas e LEFT JOIN maquininhas m ON m.id = e.maquininha_id
       WHERE ${sql} ORDER BY e.data DESC, e.id DESC ${limit}`,
      params,
    ),
    query<{ quantidade: string; bruto: string | null; taxa: string | null; liquido: string | null }>(
      `SELECT COUNT(*) AS quantidade, SUM(valor_bruto) AS bruto, SUM(valor_taxa) AS taxa, SUM(valor_liquido) AS liquido
       FROM entradas e WHERE ${sql}`,
      params,
    ),
  ])
  const totais: Totais = {
    quantidade: Number(tot.quantidade),
    brutoCentavos: decimalToCents(tot.bruto),
    taxaCentavos: decimalToCents(tot.taxa),
    liquidoCentavos: decimalToCents(tot.liquido),
  }
  return { vendas: rows.map(mapEntrada), totais }
}

// ---------- Saídas ----------

interface SaidaRow {
  id: number
  data: string
  descricao: string
  categoria: string | null
  fornecedor: string | null
  forma: FormaSaida
  condicao: Saida['condicao']
  num_parcelas: number
  valor_total: string
  criado_em: Date
  parcelas: { id: number; numero: number; vencimento: string; valor: string; pago_em: string | null }[]
}

function mapSaida(r: SaidaRow): Saida {
  return {
    id: r.id,
    data: r.data,
    descricao: r.descricao,
    categoria: r.categoria,
    fornecedor: r.fornecedor,
    forma: r.forma,
    condicao: r.condicao,
    numParcelas: r.num_parcelas,
    totalCentavos: decimalToCents(r.valor_total),
    criadoEm: r.criado_em.toISOString(),
    parcelas: r.parcelas.map((p) => ({
      id: p.id,
      numero: p.numero,
      vencimento: p.vencimento,
      valorCentavos: decimalToCents(p.valor),
      pagoEm: p.pago_em,
    })),
  }
}

const SAIDA_COM_PARCELAS = /* sql */ `
  SELECT s.*, COALESCE((
    SELECT json_agg(json_build_object('id', p.id, 'numero', p.numero, 'vencimento', p.vencimento,
                                      'valor', p.valor::text, 'pago_em', p.pago_em) ORDER BY p.numero)
    FROM saidas_parcelas p WHERE p.saida_id = s.id), '[]') AS parcelas
  FROM saidas s
`

/** Uma saída com todas as parcelas (tela de edição). */
export async function getSaida(id: number): Promise<Saida | null> {
  const [row] = await query<SaidaRow>(`${SAIDA_COM_PARCELAS} WHERE s.id = $1`, [id])
  return row ? mapSaida(row) : null
}

/** Uma venda (tela de edição). */
export async function getEntrada(id: number): Promise<Entrada | null> {
  const [row] = await query<EntradaRow>(
    `SELECT ${ENTRADA_COLUMNS} FROM entradas e LEFT JOIN maquininhas m ON m.id = e.maquininha_id WHERE e.id = $1`,
    [id],
  )
  return row ? mapEntrada(row) : null
}

function whereSaidas(f: FiltroSaidas): { sql: string; params: unknown[] } {
  const conds = ['s.data BETWEEN $1 AND $2']
  const params: unknown[] = [f.de, f.ate]
  if (f.forma) {
    params.push(f.forma)
    conds.push(`s.forma = $${params.length}`)
  }
  if (f.condicao) {
    params.push(f.condicao)
    conds.push(`s.condicao = $${params.length}`)
  }
  if (f.categoria) {
    params.push(f.categoria)
    conds.push(`s.categoria ILIKE $${params.length}`)
  }
  if (f.q) {
    params.push(`%${f.q}%`)
    const n = params.length
    conds.push(`(s.descricao ILIKE $${n} OR s.fornecedor ILIKE $${n} OR s.categoria ILIKE $${n})`)
  }
  return { sql: conds.join(' AND '), params }
}

export async function listSaidas(f: FiltroSaidas, opts: { all?: boolean } = {}) {
  const { sql, params } = whereSaidas(f)
  const limit = opts.all ? '' : `LIMIT ${PAGE_SIZE} OFFSET ${(f.pagina - 1) * PAGE_SIZE}`
  const [rows, [tot]] = await Promise.all([
    query<SaidaRow>(
      `${SAIDA_COM_PARCELAS} WHERE ${sql} ORDER BY s.data DESC, s.id DESC ${limit}`,
      params,
    ),
    query<{ quantidade: string; total: string | null }>(
      `SELECT COUNT(*) AS quantidade, SUM(valor_total) AS total FROM saidas s WHERE ${sql}`,
      params,
    ),
  ])
  const saidas = rows.map(mapSaida)
  return {
    saidas,
    totais: { quantidade: Number(tot.quantidade), totalCentavos: decimalToCents(tot.total) },
  }
}

// ---------- Parcelas (contas a pagar e saídas do dia) ----------

interface ParcelaRow {
  id: number
  saida_id: number
  numero: number
  num_parcelas: number
  vencimento: string
  valor: string
  pago_em: string | null
  descricao: string
  categoria: string | null
  fornecedor: string | null
  forma: FormaSaida
}

const PARCELA_SELECT = /* sql */ `
  SELECT p.id, p.saida_id, p.numero, s.num_parcelas, p.vencimento, p.valor, p.pago_em,
         s.descricao, s.categoria, s.fornecedor, s.forma
  FROM saidas_parcelas p JOIN saidas s ON s.id = p.saida_id
`

function mapParcela(r: ParcelaRow): Parcela {
  return {
    id: r.id,
    saidaId: r.saida_id,
    numero: r.numero,
    totalParcelas: r.num_parcelas,
    vencimento: r.vencimento,
    valorCentavos: decimalToCents(r.valor),
    pagoEm: r.pago_em,
    descricao: r.descricao,
    categoria: r.categoria,
    fornecedor: r.fornecedor,
    forma: r.forma,
  }
}

export async function listContas(f: FiltroContas) {
  const conds = ['p.vencimento <= $1']
  if (f.status === 'pendentes') conds.push('p.pago_em IS NULL')
  if (f.status === 'pagas') conds.push('p.pago_em IS NOT NULL')
  const where = conds.join(' AND ')
  const order = f.status === 'pagas' ? 'p.vencimento DESC' : 'p.vencimento ASC'
  const [rows, [tot]] = await Promise.all([
    query<ParcelaRow>(
      `${PARCELA_SELECT} WHERE ${where} ORDER BY ${order}, p.id LIMIT ${PAGE_SIZE} OFFSET ${(f.pagina - 1) * PAGE_SIZE}`,
      [f.ate],
    ),
    query<{ quantidade: string; total: string | null }>(
      `SELECT COUNT(*) AS quantidade, SUM(p.valor) AS total FROM saidas_parcelas p WHERE ${where}`,
      [f.ate],
    ),
  ])
  return {
    parcelas: rows.map(mapParcela),
    totais: { quantidade: Number(tot.quantidade), totalCentavos: decimalToCents(tot.total) },
  }
}

// ---------- Caixa do dia ----------

export interface ResumoForma {
  forma: FormaEntrada
  quantidade: number
  brutoCentavos: number
  taxaCentavos: number
  liquidoCentavos: number
}

export interface ResumoMaquininha {
  nome: string
  quantidade: number
  brutoCentavos: number
  taxaCentavos: number
}

export async function getCaixaDoDia(data: string) {
  const [entradas, porForma, porMaquininha, parcelas] = await Promise.all([
    query<EntradaRow>(
      `SELECT ${ENTRADA_COLUMNS} FROM entradas e LEFT JOIN maquininhas m ON m.id = e.maquininha_id
       WHERE e.data = $1 ORDER BY e.criado_em DESC, e.id DESC`,
      [data],
    ),
    query<{ forma: FormaEntrada; quantidade: string; bruto: string; taxa: string; liquido: string }>(
      `SELECT forma, COUNT(*) AS quantidade, SUM(valor_bruto) AS bruto, SUM(valor_taxa) AS taxa,
              SUM(valor_liquido) AS liquido
       FROM entradas WHERE data = $1 GROUP BY forma`,
      [data],
    ),
    query<{ nome: string; quantidade: string; bruto: string; taxa: string }>(
      `SELECT m.nome, COUNT(*) AS quantidade, SUM(e.valor_bruto) AS bruto, SUM(e.valor_taxa) AS taxa
       FROM entradas e JOIN maquininhas m ON m.id = e.maquininha_id
       WHERE e.data = $1 GROUP BY m.nome ORDER BY SUM(e.valor_bruto) DESC`,
      [data],
    ),
    query<ParcelaRow>(`${PARCELA_SELECT} WHERE p.vencimento = $1 ORDER BY p.id`, [data]),
  ])

  const formas: ResumoForma[] = porForma.map((r) => ({
    forma: r.forma,
    quantidade: Number(r.quantidade),
    brutoCentavos: decimalToCents(r.bruto),
    taxaCentavos: decimalToCents(r.taxa),
    liquidoCentavos: decimalToCents(r.liquido),
  }))
  const saidas = parcelas.map(mapParcela)
  const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0)
  const brutoCentavos = sum(formas.map((f) => f.brutoCentavos))
  const taxaCentavos = sum(formas.map((f) => f.taxaCentavos))
  const liquidoCentavos = sum(formas.map((f) => f.liquidoCentavos))
  const saidasCentavos = sum(saidas.map((s) => s.valorCentavos))

  return {
    entradas: entradas.map(mapEntrada),
    formas,
    maquininhas: porMaquininha.map<ResumoMaquininha>((r) => ({
      nome: r.nome,
      quantidade: Number(r.quantidade),
      brutoCentavos: decimalToCents(r.bruto),
      taxaCentavos: decimalToCents(r.taxa),
    })),
    saidas,
    totais: {
      quantidadeVendas: entradas.length,
      brutoCentavos,
      taxaCentavos,
      liquidoCentavos,
      saidasCentavos,
      saldoCentavos: liquidoCentavos - saidasCentavos,
    },
  }
}

export type CaixaDia = Awaited<ReturnType<typeof getCaixaDoDia>>

// ---------- Contas a vencer (aviso da tela inicial) ----------

export interface ContasAlerta {
  vencidas: { quantidade: number; totalCentavos: number; itens: Parcela[] }
  hoje: Parcela[]
  amanha: Parcela[]
}

/** Parcelas ainda não pagas: vencidas, que vencem hoje e que vencem amanhã. */
export async function getContasAlerta(today: string): Promise<ContasAlerta> {
  const amanha = addDays(today, 1)
  const [proximas, vencidas, [resumo]] = await Promise.all([
    query<ParcelaRow>(
      `${PARCELA_SELECT} WHERE p.pago_em IS NULL AND p.vencimento BETWEEN $1 AND $2 ORDER BY p.vencimento, p.id`,
      [today, amanha],
    ),
    query<ParcelaRow>(
      `${PARCELA_SELECT} WHERE p.pago_em IS NULL AND p.vencimento < $1 ORDER BY p.vencimento, p.id LIMIT 5`,
      [today],
    ),
    query<{ quantidade: string; total: string | null }>(
      `SELECT COUNT(*) AS quantidade, SUM(valor) AS total FROM saidas_parcelas WHERE pago_em IS NULL AND vencimento < $1`,
      [today],
    ),
  ])
  const parcelas = proximas.map(mapParcela)
  return {
    vencidas: {
      quantidade: Number(resumo.quantidade),
      totalCentavos: decimalToCents(resumo.total),
      itens: vencidas.map(mapParcela),
    },
    hoje: parcelas.filter((p) => p.vencimento === today),
    amanha: parcelas.filter((p) => p.vencimento === amanha),
  }
}

// ---------- Meta do mês e ponto de equilíbrio ----------

/** Meta em vigor no mês: a mais recente cadastrada até ele (a meta vale até ser trocada). */
export async function getMeta(mes: string): Promise<{ valorCentavos: number; desde: string } | null> {
  const [row] = await query<{ mes: string; valor: string }>(
    'SELECT mes, valor FROM metas WHERE mes <= $1 ORDER BY mes DESC LIMIT 1',
    [mes],
  )
  return row ? { valorCentavos: decimalToCents(row.valor), desde: row.mes } : null
}

/** Todas as metas cadastradas (a tabela é pequena: uma linha por mês definido). */
export async function getTodasMetas(): Promise<{ mes: string; valorCentavos: number }[]> {
  const rows = await query<{ mes: string; valor: string }>('SELECT mes, valor FROM metas ORDER BY mes')
  return rows.map((r) => ({ mes: r.mes, valorCentavos: decimalToCents(r.valor) }))
}

/** Vendas brutas de cada mês do ano ("AAAA-MM" -> centavos). */
export async function getVendasPorMes(ano: number): Promise<Record<string, number>> {
  const rows = await query<{ mes: string; bruto: string }>(
    `SELECT to_char(data, 'YYYY-MM') AS mes, SUM(valor_bruto) AS bruto
     FROM entradas WHERE data BETWEEN $1 AND $2 GROUP BY 1`,
    [`${ano}-01-01`, `${ano}-12-31`],
  )
  return Object.fromEntries(rows.map((r) => [r.mes, decimalToCents(r.bruto)]))
}

/** Tudo que o painel de meta precisa para o mês de `today`. */
export async function getPainelMeta(today: string): Promise<PainelMeta & { metaDesde: string | null }> {
  const mes = mesDe(today)
  const [[vendas], [contas], [taxa], meta] = await Promise.all([
    query<{ bruto: string | null }>('SELECT SUM(valor_bruto) AS bruto FROM entradas WHERE data BETWEEN $1 AND $2', [
      `${mes}-01`,
      today,
    ]),
    query<{ total: string | null }>(
      'SELECT SUM(valor) AS total FROM saidas_parcelas WHERE vencimento BETWEEN $1 AND $2',
      [`${mes}-01`, fimDoMes(mes)],
    ),
    // Taxa média dos últimos 90 dias: mais estável do que a do mês, que começa com poucas vendas.
    query<{ bruto: string | null; taxa: string | null }>(
      'SELECT SUM(valor_bruto) AS bruto, SUM(valor_taxa) AS taxa FROM entradas WHERE data BETWEEN $1 AND $2',
      [inicioDoPeriodo(today, 90), today],
    ),
    getMeta(mes),
  ])
  const brutoTaxa = decimalToCents(taxa.bruto)
  const painel = calcularPainelMeta({
    hoje: today,
    vendidoCentavos: decimalToCents(vendas.bruto),
    contasCentavos: decimalToCents(contas.total),
    taxaMediaBp: brutoTaxa > 0 ? Math.round((decimalToCents(taxa.taxa) / brutoTaxa) * 10_000) : 0,
    metaCentavos: meta?.valorCentavos ?? null,
  })
  return { ...painel, metaDesde: meta?.desde ?? null }
}

// ---------- Resumo: comparativos e gráficos ----------

export interface MesResumo {
  mes: string
  brutoCentavos: number
  liquidoCentavos: number
  quantidade: number
}

export interface PeriodoResumo {
  brutoCentavos: number
  liquidoCentavos: number
  quantidade: number
}

async function totaisVendas(de: string, ate: string): Promise<PeriodoResumo> {
  const [r] = await query<{ bruto: string | null; liquido: string | null; quantidade: string }>(
    `SELECT SUM(valor_bruto) AS bruto, SUM(valor_liquido) AS liquido, COUNT(*) AS quantidade
     FROM entradas WHERE data BETWEEN $1 AND $2`,
    [de, ate],
  )
  return {
    brutoCentavos: decimalToCents(r.bruto),
    liquidoCentavos: decimalToCents(r.liquido),
    quantidade: Number(r.quantidade),
  }
}

export interface FormaResumo {
  forma: FormaEntrada
  quantidade: number
  brutoCentavos: number
  taxaCentavos: number
}

export interface CategoriaResumo {
  /** null = saídas sem categoria */
  categoria: string | null
  totalCentavos: number
}

export async function getResumo(today: string, de: string, ate: string) {
  const mesAtual = mesDe(today)
  const meses = ultimosMeses(mesAtual, 6)
  const anterior = periodoMesAnterior(today)

  const [atual, mesmoPeriodoAnterior, porMes, porDia, porForma, porMaquininha, porCategoria] = await Promise.all([
    totaisVendas(`${mesAtual}-01`, today),
    totaisVendas(anterior.de, anterior.ate),
    query<{ mes: string; bruto: string; liquido: string; quantidade: string }>(
      `SELECT to_char(data, 'YYYY-MM') AS mes, SUM(valor_bruto) AS bruto, SUM(valor_liquido) AS liquido, COUNT(*) AS quantidade
       FROM entradas WHERE data BETWEEN $1 AND $2 GROUP BY 1`,
      [`${meses[0]}-01`, today],
    ),
    query<{ dow: number; dias: string; vendas: string; bruto: string }>(
      `SELECT EXTRACT(DOW FROM data)::int AS dow, COUNT(DISTINCT data) AS dias, COUNT(*) AS vendas, SUM(valor_bruto) AS bruto
       FROM entradas WHERE data BETWEEN $1 AND $2 GROUP BY 1`,
      [de, ate],
    ),
    query<{ forma: FormaEntrada; quantidade: string; bruto: string; taxa: string }>(
      `SELECT forma, COUNT(*) AS quantidade, SUM(valor_bruto) AS bruto, SUM(valor_taxa) AS taxa
       FROM entradas WHERE data BETWEEN $1 AND $2 GROUP BY forma`,
      [de, ate],
    ),
    query<{ nome: string; quantidade: string; bruto: string; taxa: string }>(
      `SELECT m.nome, COUNT(*) AS quantidade, SUM(e.valor_bruto) AS bruto, SUM(e.valor_taxa) AS taxa
       FROM entradas e JOIN maquininhas m ON m.id = e.maquininha_id
       WHERE e.data BETWEEN $1 AND $2 GROUP BY m.nome ORDER BY SUM(e.valor_bruto) DESC`,
      [de, ate],
    ),
    // Saídas pelo dia do vencimento, como no caixa: compra de R$ 900 em 3x pesa R$ 300 por mês.
    query<{ categoria: string; total: string }>(
      `SELECT COALESCE(btrim(s.categoria), '') AS categoria, SUM(p.valor) AS total
       FROM saidas_parcelas p JOIN saidas s ON s.id = p.saida_id
       WHERE p.vencimento BETWEEN $1 AND $2 GROUP BY 1`,
      [de, ate],
    ),
  ])

  const serie: MesResumo[] = meses.map((mes) => {
    const r = porMes.find((x) => x.mes === mes)
    return {
      mes,
      brutoCentavos: decimalToCents(r?.bruto),
      liquidoCentavos: decimalToCents(r?.liquido),
      quantidade: Number(r?.quantidade ?? 0),
    }
  })

  const diasDaSemana: DiaDaSemana[] = porDia.map((r) => ({
    dow: r.dow,
    dias: Number(r.dias),
    vendas: Number(r.vendas),
    brutoCentavos: decimalToCents(r.bruto),
  }))

  const formas: FormaResumo[] = FORMAS_ENTRADA.flatMap((forma) => {
    const r = porForma.find((x) => x.forma === forma)
    return r
      ? [
          {
            forma,
            quantidade: Number(r.quantidade),
            brutoCentavos: decimalToCents(r.bruto),
            taxaCentavos: decimalToCents(r.taxa),
          },
        ]
      : []
  })

  // "Energia" e "energia" viram uma linha só; vale a grafia que mais pesou.
  const grupos = new Map<string, { nome: string | null; maior: number; total: number }>()
  for (const r of porCategoria) {
    const valor = decimalToCents(r.total)
    const chave = r.categoria ? chaveCategoria(r.categoria) : ''
    const g = grupos.get(chave) ?? { nome: r.categoria || null, maior: 0, total: 0 }
    if (valor > g.maior) {
      g.maior = valor
      g.nome = r.categoria || null
    }
    g.total += valor
    grupos.set(chave, g)
  }
  const categorias: CategoriaResumo[] = [...grupos.values()]
    .map((g) => ({ categoria: g.nome, totalCentavos: g.total }))
    .sort((a, b) => b.totalCentavos - a.totalCentavos)

  return {
    mesAtual,
    atual,
    mesmoPeriodoAnterior,
    periodoAnterior: anterior,
    serie,
    diasDaSemana,
    formas,
    maquininhas: porMaquininha.map<ResumoMaquininha>((r) => ({
      nome: r.nome,
      quantidade: Number(r.quantidade),
      brutoCentavos: decimalToCents(r.bruto),
      taxaCentavos: decimalToCents(r.taxa),
    })),
    categorias,
  }
}

/** Categorias já usadas, da mais frequente para a menos (sem repetir "Aluguel" e "aluguel"). */
export async function getCategoriasUsadas(): Promise<string[]> {
  const rows = await query<{ categoria: string }>(
    `SELECT btrim(categoria) AS categoria FROM saidas WHERE btrim(categoria) <> ''
     GROUP BY btrim(categoria) ORDER BY COUNT(*) DESC, 1 LIMIT 40`,
  )
  const vistas = new Set<string>()
  return rows.map((r) => r.categoria).filter((c) => !vistas.has(chaveCategoria(c)) && vistas.add(chaveCategoria(c)))
}

/** Número da venda mais recente (usado pelas telas que se atualizam sozinhas). */
export async function ultimaEntradaId(): Promise<number> {
  const [r] = await query<{ ultima: number | null }>('SELECT max(id) AS ultima FROM entradas')
  return r?.ultima ?? 0
}

// ---------- Saldo da empresa ----------

export interface SaldoEmpresa {
  /** Saldo informado em Ajustes, no fim do dia `data`. */
  inicialCentavos: number
  data: string
  /** Vendas depois de `data` cujo dinheiro já caiu (líquido, sem as taxas). */
  entradasCentavos: number
  /** Pagamentos marcados como pagos depois de `data`. */
  saidasCentavos: number
  /** Vendas depois de `data` cujo dinheiro ainda vai cair (cartão a receber). */
  aReceberCentavos: number
  atualCentavos: number
}

export async function getSaldoEmpresa(hoje: string): Promise<SaldoEmpresa | null> {
  const [base] = await query<{ valor: string; data: string }>('SELECT valor, data FROM saldo_inicial WHERE id = 1')
  if (!base) return null
  const [mov] = await query<{ recebido: string | null; a_receber: string | null; pago: string | null }>(
    `SELECT
       (SELECT SUM(valor_liquido) FROM entradas WHERE data > $1 AND data <= $2 AND data_recebimento <= $2) AS recebido,
       (SELECT SUM(valor_liquido) FROM entradas WHERE data > $1 AND data <= $2 AND data_recebimento > $2) AS a_receber,
       (SELECT SUM(valor) FROM saidas_parcelas WHERE pago_em > $1 AND pago_em <= $2) AS pago`,
    [base.data, hoje],
  )
  const inicialCentavos = decimalToCents(base.valor)
  const entradasCentavos = decimalToCents(mov.recebido)
  const saidasCentavos = decimalToCents(mov.pago)
  return {
    inicialCentavos,
    data: base.data,
    entradasCentavos,
    saidasCentavos,
    aReceberCentavos: decimalToCents(mov.a_receber),
    atualCentavos: inicialCentavos + entradasCentavos - saidasCentavos,
  }
}
