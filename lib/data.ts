import 'server-only'
import { query } from './db'
import type { FiltroContas, FiltroSaidas, FiltroVendas } from './filters'
import { PAGE_SIZE } from './filters'
import { decimalToCents, type FormaEntrada, type FormaSaida } from './money'

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
  e.valor_bruto, e.taxa_percentual, e.valor_taxa, e.valor_liquido, e.data_recebimento, e.criado_em
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
}

function mapEntrada(r: EntradaRow): Entrada {
  return {
    id: r.id,
    data: r.data,
    descricao: r.descricao,
    forma: r.forma,
    maquininhaId: r.maquininha_id,
    maquininhaNome: r.maquininha_nome,
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
      `SELECT s.*, COALESCE((
         SELECT json_agg(json_build_object('id', p.id, 'numero', p.numero, 'vencimento', p.vencimento,
                                           'valor', p.valor::text, 'pago_em', p.pago_em) ORDER BY p.numero)
         FROM saidas_parcelas p WHERE p.saida_id = s.id), '[]') AS parcelas
       FROM saidas s WHERE ${sql} ORDER BY s.data DESC, s.id DESC ${limit}`,
      params,
    ),
    query<{ quantidade: string; total: string | null }>(
      `SELECT COUNT(*) AS quantidade, SUM(valor_total) AS total FROM saidas s WHERE ${sql}`,
      params,
    ),
  ])
  const saidas: Saida[] = rows.map((r) => ({
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
  }))
  return {
    saidas,
    totais: { quantidade: Number(tot.quantidade), totalCentavos: decimalToCents(tot.total) },
  }
}

export async function getCategorias(): Promise<string[]> {
  const rows = await query<{ categoria: string }>(
    `SELECT categoria FROM saidas WHERE categoria IS NOT NULL AND categoria <> ''
     GROUP BY categoria ORDER BY COUNT(*) DESC LIMIT 30`,
  )
  return rows.map((r) => r.categoria)
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
  const [entradas, porForma, porMaquininha, parcelas, [pendentes]] = await Promise.all([
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
    query<{ quantidade: string; total: string | null }>(
      `SELECT COUNT(*) AS quantidade, SUM(valor) AS total FROM saidas_parcelas
       WHERE pago_em IS NULL AND vencimento < $1`,
      [data],
    ),
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
    atrasadas: { quantidade: Number(pendentes.quantidade), totalCentavos: decimalToCents(pendentes.total) },
  }
}

export type CaixaDia = Awaited<ReturnType<typeof getCaixaDoDia>>
