'use server'

import type { PoolClient } from 'pg'
import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { requireAuth } from './auth'
import { nomeDoMes } from './analise'
import { CATEGORIAS_PADRAO, categoriaCanonica } from './categorias'
import { getCategoriasUsadas } from './data'
import { atualizarCobranca, cancelarCobranca, criarCobranca, mpPronto, mudarModoMaquininha, sincronizarDia, sincronizarSeNecessario, type ModoMaquininha } from './mercadopago'
import { query, transaction } from './db'
import { addDays, addMonths, hoje, isIsoDate } from './dates'
import {
  FORMAS_ENTRADA,
  FORMAS_SAIDA,
  FORMA_LABEL,
  MAX_PARCELAS_CREDITO,
  MAX_PARCELAS_SAIDA,
  calcularTaxa,
  centsToDecimal,
  decimalToCents,
  dividirParcelas,
  type FormaEntrada,
  type FormaSaida,
} from './money'
import { SESSION_COOKIE, createSessionToken, passwordMatches } from './session'
import { PRAZO_PADRAO } from './taxas'
import { isProdutoId, produtoPeloValor, type ProdutoId } from './produtos'

export interface ActionResult {
  ok: boolean
  message: string
  id?: number
  /** Muda a cada envio para a interface saber que chegou uma resposta nova. */
  at?: number
}

const fail = (message: string): ActionResult => ({ ok: false, message, at: Date.now() })
const done = (message: string, id?: number): ActionResult => ({ ok: true, message, id, at: Date.now() })

function text(formData: FormData, key: string, max = 200): string {
  const value = formData.get(key)
  return typeof value === 'string' ? value.trim().slice(0, max) : ''
}

function int(formData: FormData, key: string): number | null {
  const n = Number(text(formData, key))
  return Number.isInteger(n) ? n : null
}

/** Valores monetários chegam do formulário já em centavos (campo oculto do MoneyInput). */
function cents(formData: FormData, key: string): number | null {
  const n = int(formData, key)
  return n !== null && n > 0 && n < 100_000_000 ? n : null
}

function refresh() {
  revalidatePath('/', 'layout')
}

// ---------- Login ----------

export async function login(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  if (!process.env.APP_PASSWORD) {
    return fail('O sistema ainda não tem senha. Configure APP_PASSWORD (veja o README).')
  }
  if (!(await passwordMatches(text(formData, 'senha', 200)))) {
    // Pequena espera para dificultar tentativas em sequência.
    await new Promise((r) => setTimeout(r, 600))
    return fail('Senha incorreta.')
  }
  const { token, expires } = await createSessionToken()
  const store = await cookies()
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    expires,
  })
  redirect('/')
}

export async function logout() {
  const store = await cookies()
  store.delete(SESSION_COOKIE)
  redirect('/login')
}

// ---------- Entradas ----------

interface DadosEntrada {
  valor: number
  forma: FormaEntrada
  data: string
  descricao: string | null
  maquininhaId: number | null
  parcelas: number
  produto: ProdutoId
}

const falhou = (x: object): x is ActionResult => 'ok' in x

/** Lê e confere o formulário de venda (o mesmo para lançar e para editar). */
function lerEntrada(formData: FormData): DadosEntrada | ActionResult {
  const valor = cents(formData, 'valor')
  if (!valor) return fail('Informe o valor da venda.')

  const forma = text(formData, 'forma') as FormaEntrada
  if (!FORMAS_ENTRADA.includes(forma)) return fail('Escolha a forma de pagamento.')

  const data = text(formData, 'data')
  if (!isIsoDate(data)) return fail('Data inválida.')

  const descricao = text(formData, 'descricao') || null
  const maquininhaRaw = text(formData, 'maquininha')
  let maquininhaId: number | null = maquininhaRaw ? Number(maquininhaRaw) : null
  let parcelas = forma === 'credito' ? (int(formData, 'parcelas') ?? 1) : 1

  if (forma === 'dinheiro') maquininhaId = null
  if ((forma === 'debito' || forma === 'credito') && !maquininhaId) {
    return fail('Escolha em qual maquininha a venda passou.')
  }
  if (parcelas < 1 || parcelas > MAX_PARCELAS_CREDITO) return fail('Número de parcelas inválido.')
  if (maquininhaId === null) parcelas = 1
  else if (!Number.isInteger(maquininhaId)) return fail('Maquininha inválida.')

  // Produto escolhido na tela; se não veio, classifica pelo valor (preço fixo ou self-service).
  const produtoRaw = text(formData, 'produto')
  const produto = isProdutoId(produtoRaw) ? produtoRaw : produtoPeloValor(valor)

  return { valor, forma, data, descricao, maquininhaId, parcelas, produto }
}

/**
 * Taxa e prazo da venda. Busca na tabela de taxas; ao editar uma venda cuja forma de pagamento
 * não mudou, `manter` preserva a taxa que valia na época (a taxa fica gravada na própria venda).
 */
async function taxaDaVenda(
  d: DadosEntrada,
  manter?: { percentual: number; prazoDias: number },
): Promise<{ erro: string } | { percentual: number; prazoDias: number; semTaxa: boolean }> {
  if (d.maquininhaId === null) return { percentual: 0, prazoDias: 0, semTaxa: false }
  if (manter) return { ...manter, semTaxa: false }

  const [maq] = await query<{ ativa: boolean }>('SELECT ativa FROM maquininhas WHERE id = $1', [d.maquininhaId])
  if (!maq || !maq.ativa) return { erro: 'Essa maquininha não está ativa.' }

  const [taxa] = await query<{ percentual: string; prazo_dias: number }>(
    'SELECT percentual, prazo_dias FROM taxas WHERE maquininha_id = $1 AND forma = $2 AND parcelas = $3',
    [d.maquininhaId, d.forma, d.parcelas],
  )
  // Taxa ainda não cadastrada: lança sem desconto (líquido = bruto) e avisa.
  return {
    percentual: taxa ? Number(taxa.percentual) : 0,
    prazoDias: taxa ? taxa.prazo_dias : PRAZO_PADRAO[d.forma as 'debito' | 'credito' | 'pix'],
    semTaxa: !taxa,
  }
}

export async function createEntrada(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  await requireAuth()
  const d = lerEntrada(formData)
  if (falhou(d)) return d
  const t = await taxaDaVenda(d)
  if ('erro' in t) return fail(t.erro)

  const { taxaCentavos, liquidoCentavos } = calcularTaxa(d.valor, t.percentual)
  const [row] = await query<{ id: number }>(
    `INSERT INTO entradas (data, descricao, forma, maquininha_id, parcelas, valor_bruto, taxa_percentual,
                           valor_taxa, valor_liquido, data_recebimento, produto)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING id`,
    [
      d.data,
      d.descricao,
      d.forma,
      d.maquininhaId,
      d.parcelas,
      centsToDecimal(d.valor),
      t.percentual.toFixed(2),
      centsToDecimal(taxaCentavos),
      centsToDecimal(liquidoCentavos),
      addDays(d.data, t.prazoDias),
      d.produto,
    ],
  )
  refresh()
  return done(t.semTaxa ? 'Venda lançada sem taxa (taxa ainda não cadastrada).' : 'Venda lançada.', row.id)
}

export async function updateEntrada(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  await requireAuth()
  const id = int(formData, 'id')
  if (!id) return fail('Venda inválida.')
  const d = lerEntrada(formData)
  if (falhou(d)) return d

  const [atual] = await query<{
    forma: FormaEntrada
    maquininha_id: number | null
    parcelas: number
    taxa_percentual: string
    prazo: number
  }>(
    `SELECT forma, maquininha_id, parcelas, taxa_percentual, (data_recebimento - data) AS prazo
     FROM entradas WHERE id = $1`,
    [id],
  )
  if (!atual) return fail('Essa venda já não existe.')

  const mesmoPagamento =
    atual.forma === d.forma && atual.maquininha_id === d.maquininhaId && atual.parcelas === d.parcelas
  const t = await taxaDaVenda(
    d,
    mesmoPagamento ? { percentual: Number(atual.taxa_percentual), prazoDias: atual.prazo } : undefined,
  )
  if ('erro' in t) return fail(t.erro)

  const { taxaCentavos, liquidoCentavos } = calcularTaxa(d.valor, t.percentual)
  await query(
    `UPDATE entradas SET data = $2, descricao = $3, forma = $4, maquininha_id = $5, parcelas = $6,
            valor_bruto = $7, taxa_percentual = $8, valor_taxa = $9, valor_liquido = $10, data_recebimento = $11,
            produto = $12
     WHERE id = $1`,
    [
      id,
      d.data,
      d.descricao,
      d.forma,
      d.maquininhaId,
      d.parcelas,
      centsToDecimal(d.valor),
      t.percentual.toFixed(2),
      centsToDecimal(taxaCentavos),
      centsToDecimal(liquidoCentavos),
      addDays(d.data, t.prazoDias),
      d.produto,
    ],
  )
  refresh()
  return done(t.semTaxa ? 'Venda atualizada sem taxa (taxa ainda não cadastrada).' : 'Venda atualizada.', id)
}

export async function deleteEntrada(id: number): Promise<ActionResult> {
  await requireAuth()
  if (!Number.isInteger(id)) return fail('Venda inválida.')
  const rows = await query<{ id: number }>('DELETE FROM entradas WHERE id = $1 RETURNING id', [id])
  refresh()
  return rows.length ? done('Venda excluída.') : fail('Essa venda já não existe.')
}

// ---------- Saídas ----------

interface DadosSaida {
  descricao: string
  valor: number
  forma: FormaSaida
  data: string
  condicao: 'a_vista' | 'parcelado'
  numParcelas: number
  primeiroVencimento: string
  categoria: string | null
  fornecedor: string | null
}

/** Lê e confere o formulário de saída (o mesmo para lançar e para editar). */
async function lerSaida(formData: FormData): Promise<DadosSaida | ActionResult> {
  const descricao = text(formData, 'descricao')
  if (!descricao) return fail('Descreva a saída (ex.: "Leite condensado").')

  const valor = cents(formData, 'valor')
  if (!valor) return fail('Informe o valor total.')

  const forma = text(formData, 'forma') as FormaSaida
  if (!FORMAS_SAIDA.includes(forma)) return fail('Escolha a forma de pagamento.')

  const data = text(formData, 'data')
  if (!isIsoDate(data)) return fail('Data da compra inválida.')

  const condicao = text(formData, 'condicao') === 'parcelado' ? 'parcelado' : 'a_vista'
  const numParcelas = condicao === 'parcelado' ? (int(formData, 'parcelas') ?? 0) : 1
  if (condicao === 'parcelado' && (numParcelas < 2 || numParcelas > MAX_PARCELAS_SAIDA)) {
    return fail(`Parcelado precisa ter entre 2 e ${MAX_PARCELAS_SAIDA} parcelas.`)
  }
  if (valor < numParcelas) return fail('Valor pequeno demais para tantas parcelas.')

  let primeiroVencimento = text(formData, 'primeiro_vencimento')
  if (!isIsoDate(primeiroVencimento)) {
    primeiroVencimento = condicao === 'parcelado' ? addMonths(data, 1) : data
  }

  // "aluguel", "Aluguel " e "ALUGUEL" viram a mesma categoria, senão o resumo mostraria linhas repetidas.
  const jaUsadas = await getCategoriasUsadas()
  const categoria = categoriaCanonica(text(formData, 'categoria', 60), [...jaUsadas, ...CATEGORIAS_PADRAO])
  const fornecedor = text(formData, 'fornecedor', 120) || null

  return { descricao, valor, forma, data, condicao, numParcelas, primeiroVencimento, categoria, fornecedor }
}

/** Cria as parcelas da saída. À vista que já venceu é considerado pago; parcelas ficam em aberto até serem marcadas. */
async function gravarParcelas(client: PoolClient, saidaId: number, d: DadosSaida) {
  const valores = dividirParcelas(d.valor, d.numParcelas)
  const today = hoje()
  for (let i = 0; i < d.numParcelas; i++) {
    const vencimento = addMonths(d.primeiroVencimento, i)
    const pagoEm = d.condicao === 'a_vista' && vencimento <= today ? vencimento : null
    await client.query(
      `INSERT INTO saidas_parcelas (saida_id, numero, vencimento, valor, pago_em) VALUES ($1, $2, $3, $4, $5)`,
      [saidaId, i + 1, vencimento, centsToDecimal(valores[i]), pagoEm],
    )
  }
}

export async function createSaida(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  await requireAuth()
  const d = await lerSaida(formData)
  if (falhou(d)) return d

  const id = await transaction(async (client) => {
    const { rows } = await client.query<{ id: number }>(
      `INSERT INTO saidas (data, descricao, categoria, fornecedor, forma, condicao, num_parcelas, valor_total)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
      [d.data, d.descricao, d.categoria, d.fornecedor, d.forma, d.condicao, d.numParcelas, centsToDecimal(d.valor)],
    )
    await gravarParcelas(client, rows[0].id, d)
    return rows[0].id
  })

  refresh()
  return done(d.condicao === 'parcelado' ? `Saída lançada em ${d.numParcelas} parcelas.` : 'Saída lançada.', id)
}

export async function updateSaida(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  await requireAuth()
  const id = int(formData, 'id')
  if (!id) return fail('Saída inválida.')
  const d = await lerSaida(formData)
  if (falhou(d)) return d

  const [atual] = await query<{
    condicao: 'a_vista' | 'parcelado'
    num_parcelas: number
    valor_total: string
    pagas: string
    primeiro: string
  }>(
    `SELECT s.condicao, s.num_parcelas, s.valor_total::text AS valor_total,
            (SELECT COUNT(*) FROM saidas_parcelas p WHERE p.saida_id = s.id AND p.pago_em IS NOT NULL) AS pagas,
            (SELECT MIN(p.vencimento) FROM saidas_parcelas p WHERE p.saida_id = s.id) AS primeiro
     FROM saidas s WHERE s.id = $1`,
    [id],
  )
  if (!atual) return fail('Essa saída já não existe.')

  // Valor, número de parcelas e vencimento refazem as parcelas; o resto (nome, categoria...) é só texto.
  const mudouValores =
    decimalToCents(atual.valor_total) !== d.valor ||
    atual.condicao !== d.condicao ||
    atual.num_parcelas !== d.numParcelas ||
    atual.primeiro !== d.primeiroVencimento
  if (mudouValores && atual.condicao === 'parcelado' && Number(atual.pagas) > 0) {
    return fail(
      'Esta saída já tem parcelas pagas. Para mudar o valor, o número de parcelas ou o vencimento, desfaça os pagamentos antes (Histórico, aba Contas a pagar).',
    )
  }

  await transaction(async (client) => {
    await client.query(
      `UPDATE saidas SET data = $2, descricao = $3, categoria = $4, fornecedor = $5, forma = $6,
              condicao = $7, num_parcelas = $8, valor_total = $9 WHERE id = $1`,
      [id, d.data, d.descricao, d.categoria, d.fornecedor, d.forma, d.condicao, d.numParcelas, centsToDecimal(d.valor)],
    )
    if (mudouValores) {
      await client.query('DELETE FROM saidas_parcelas WHERE saida_id = $1', [id])
      await gravarParcelas(client, id, d)
    }
  })

  refresh()
  return done('Saída atualizada.', id)
}

export async function deleteSaida(id: number): Promise<ActionResult> {
  await requireAuth()
  if (!Number.isInteger(id)) return fail('Saída inválida.')
  const rows = await query<{ id: number }>('DELETE FROM saidas WHERE id = $1 RETURNING id', [id])
  refresh()
  return rows.length ? done('Saída excluída.') : fail('Essa saída já não existe.')
}

export async function setParcelaPaga(id: number, paga: boolean): Promise<ActionResult> {
  await requireAuth()
  if (!Number.isInteger(id)) return fail('Parcela inválida.')
  const rows = await query<{ id: number }>(
    'UPDATE saidas_parcelas SET pago_em = $2 WHERE id = $1 RETURNING id',
    [id, paga ? hoje() : null],
  )
  refresh()
  if (!rows.length) return fail('Essa parcela já não existe.')
  return done(paga ? 'Parcela marcada como paga.' : 'Pagamento desfeito.')
}

// ---------- Meta do mês ----------

export async function saveMeta(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  await requireAuth()
  const valor = cents(formData, 'valor')
  if (!valor) return fail('Informe o valor da meta de vendas do mês.')

  const mes = hoje().slice(0, 7)
  await query(
    `INSERT INTO metas (mes, valor) VALUES ($1, $2)
     ON CONFLICT (mes) DO UPDATE SET valor = EXCLUDED.valor`,
    [mes, centsToDecimal(valor)],
  )
  refresh()
  return done(`Meta de ${nomeDoMes(mes)} salva. Ela vale também para os próximos meses, até você mudar.`)
}

export async function saveMetas(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  await requireAuth()
  const ano = text(formData, 'ano', 4)
  if (!/^\d{4}$/.test(ano) || Number(ano) < 2020 || Number(ano) > 2100) return fail('Ano inválido.')

  // Campo preenchido = meta própria do mês; campo vazio = o mês volta a usar a meta anterior.
  await transaction(async (client) => {
    for (let m = 1; m <= 12; m++) {
      const mes = `${ano}-${String(m).padStart(2, '0')}`
      const valor = cents(formData, `meta_${mes}`)
      if (valor) {
        await client.query(
          'INSERT INTO metas (mes, valor) VALUES ($1, $2) ON CONFLICT (mes) DO UPDATE SET valor = EXCLUDED.valor',
          [mes, centsToDecimal(valor)],
        )
      } else {
        await client.query('DELETE FROM metas WHERE mes = $1', [mes])
      }
    }
  })
  refresh()
  return done(`Metas de ${ano} salvas.`)
}

// ---------- Configurações ----------

function parsePercent(raw: string): number | null {
  const s = raw.replace('%', '').replace(',', '.').trim()
  if (!/^\d{1,2}(\.\d{1,2})?$/.test(s)) return null
  return Number(s)
}

export async function saveTaxas(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  await requireAuth()
  const maquininhaId = int(formData, 'maquininha')
  if (!maquininhaId) return fail('Maquininha inválida.')

  const combos: { forma: 'debito' | 'pix' | 'credito'; parcelas: number; key: string; label: string }[] = [
    { forma: 'debito', parcelas: 1, key: 'debito', label: 'Débito' },
    { forma: 'pix', parcelas: 1, key: 'pix', label: 'Pix' },
    ...Array.from({ length: MAX_PARCELAS_CREDITO }, (_, i) => ({
      forma: 'credito' as const,
      parcelas: i + 1,
      key: `credito_${i + 1}`,
      label: `Crédito ${i + 1}x`,
    })),
  ]

  const upserts: { forma: string; parcelas: number; percentual: number; prazo: number }[] = []
  const removals: { forma: string; parcelas: number }[] = []
  for (const c of combos) {
    const pctRaw = text(formData, `${c.key}_pct`)
    const prazoRaw = text(formData, `${c.key}_prazo`)
    if (!pctRaw) {
      removals.push(c)
      continue
    }
    const percentual = parsePercent(pctRaw)
    if (percentual === null) return fail(`${c.label}: taxa inválida. Use algo como 3,15.`)
    const prazo = prazoRaw === '' ? PRAZO_PADRAO[c.forma] : Number(prazoRaw)
    if (!Number.isInteger(prazo) || prazo < 0 || prazo > 365) return fail(`${c.label}: prazo inválido.`)
    upserts.push({ forma: c.forma, parcelas: c.parcelas, percentual, prazo })
  }

  await transaction(async (client) => {
    for (const r of removals) {
      await client.query('DELETE FROM taxas WHERE maquininha_id = $1 AND forma = $2 AND parcelas = $3', [
        maquininhaId,
        r.forma,
        r.parcelas,
      ])
    }
    for (const u of upserts) {
      await client.query(
        `INSERT INTO taxas (maquininha_id, forma, parcelas, percentual, prazo_dias) VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (maquininha_id, forma, parcelas)
         DO UPDATE SET percentual = EXCLUDED.percentual, prazo_dias = EXCLUDED.prazo_dias`,
        [maquininhaId, u.forma, u.parcelas, u.percentual.toFixed(2), u.prazo],
      )
    }
  })

  refresh()
  return done('Taxas salvas. As próximas vendas já usam os novos valores.')
}

export async function addMaquininha(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  await requireAuth()
  const nome = text(formData, 'nome', 60)
  if (!nome) return fail('Informe o nome da maquininha.')
  const rows = await query<{ id: number }>(
    'INSERT INTO maquininhas (nome) VALUES ($1) ON CONFLICT (nome) DO NOTHING RETURNING id',
    [nome],
  )
  if (!rows.length) return fail('Já existe uma maquininha com esse nome.')
  refresh()
  return done(`${nome} adicionada. Agora cadastre as taxas dela.`, rows[0].id)
}

export async function setMaquininhaAtiva(id: number, ativa: boolean): Promise<ActionResult> {
  await requireAuth()
  if (!Number.isInteger(id)) return fail('Maquininha inválida.')
  await query('UPDATE maquininhas SET ativa = $2 WHERE id = $1', [id, ativa])
  refresh()
  return done(ativa ? 'Maquininha reativada.' : 'Maquininha desativada. O histórico dela continua salvo.')
}

// ---------- Maquininha Mercado Pago ----------

export interface ResultadoCobranca {
  ok: boolean
  message: string
  orderId?: string
  status?: string
  final?: boolean
}

/** Envia o valor da venda para a maquininha. A venda só é lançada quando o cliente paga. */
export async function cobrarNaMaquininha(
  valorCentavos: number,
  forma: FormaEntrada,
  parcelas: number,
): Promise<ResultadoCobranca> {
  await requireAuth()
  if (!mpPronto()) return { ok: false, message: 'O Mercado Pago ainda não foi configurado (falta o token).' }
  if (!Number.isInteger(valorCentavos) || valorCentavos <= 0 || valorCentavos >= 100_000_000) {
    return { ok: false, message: 'Informe o valor da venda.' }
  }
  if (forma === 'dinheiro' || !FORMAS_ENTRADA.includes(forma)) return { ok: false, message: 'Forma de pagamento inválida.' }
  const n = forma === 'credito' ? Math.min(Math.max(Math.trunc(parcelas) || 1, 1), MAX_PARCELAS_CREDITO) : 1
  try {
    const orderId = await criarCobranca(valorCentavos, forma, n)
    return { ok: true, message: 'Cobrança enviada para a maquininha.', orderId, status: 'created', final: false }
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : 'Não foi possível enviar a cobrança.' }
  }
}

const MENSAGEM_STATUS: Record<string, string> = {
  created: 'Aguardando o cliente pagar na maquininha…',
  at_terminal: 'Cliente pagando na maquininha…',
  processed: 'Pago! Venda lançada no caixa.',
  canceled: 'Cobrança cancelada.',
  cancelled: 'Cobrança cancelada.',
  expired: 'A cobrança expirou sem pagamento.',
  failed: 'O pagamento não foi aprovado.',
  refunded: 'Pagamento estornado.',
}

export async function acompanharCobranca(orderId: string): Promise<ResultadoCobranca> {
  await requireAuth()
  try {
    const r = await atualizarCobranca(String(orderId))
    if (r.status === 'processed') refresh()
    return {
      ok: true,
      orderId,
      status: r.status,
      final: r.final,
      message: MENSAGEM_STATUS[r.status] ?? `Situação da cobrança: ${r.status}`,
    }
  } catch (error) {
    return { ok: false, orderId, message: error instanceof Error ? error.message : 'Não foi possível consultar a cobrança.' }
  }
}

export async function cancelarCobrancaMaquininha(orderId: string): Promise<ResultadoCobranca> {
  await requireAuth()
  try {
    await cancelarCobranca(String(orderId))
    return { ok: true, orderId, status: 'canceled', final: true, message: 'Cobrança cancelada.' }
  } catch (error) {
    return { ok: false, orderId, message: error instanceof Error ? error.message : 'Não foi possível cancelar.' }
  }
}

/** Botão de Configurações: busca as vendas feitas direto na maquininha hoje que ainda não estão no sistema. */
export async function buscarVendasDaMaquininha(): Promise<ActionResult> {
  await requireAuth()
  if (!mpPronto()) return fail('O Mercado Pago ainda não foi configurado (falta o token).')
  try {
    const r = await sincronizarDia(hoje())
    refresh()
    const partes = [
      r.lancadas
        ? `${r.lancadas} ${r.lancadas === 1 ? 'venda nova lançada' : 'vendas novas lançadas'} da maquininha.`
        : 'Nenhuma venda nova da maquininha.',
    ]
    if (r.jaEstavam) partes.push(`${r.jaEstavam} já ${r.jaEstavam === 1 ? 'estava' : 'estavam'} no caixa.`)
    if (r.ignoradas) partes.push(`${r.ignoradas} ${r.ignoradas === 1 ? 'pagamento ignorado' : 'pagamentos ignorados'} (o motivo fica em Ajustes).`)
    return done(partes.join(' '))
  } catch (error) {
    return fail(error instanceof Error ? error.message : 'Não foi possível buscar as vendas.')
  }
}

/** Botão de Ajustes: liga ou desliga o modo PDV (integrado) da maquininha. */
export async function trocarModoMaquininha(modo: ModoMaquininha): Promise<ActionResult> {
  await requireAuth()
  if (modo !== 'PDV' && modo !== 'STANDALONE') return fail('Modo inválido.')
  if (!mpPronto()) return fail('O Mercado Pago ainda não foi configurado (falta o token).')
  try {
    await mudarModoMaquininha(modo)
    refresh()
    return done(
      modo === 'PDV'
        ? 'Modo PDV ativado. Reinicie a maquininha (desligue e ligue) para começar a receber cobranças do sistema.'
        : 'Modo normal ativado. Reinicie a maquininha (desligue e ligue) para voltar a digitar o valor nela.',
    )
  } catch (error) {
    return fail(error instanceof Error ? error.message : 'Não foi possível trocar o modo da maquininha.')
  }
}

/**
 * Chamada a cada 30 s pelas telas Caixa e Venda: puxa as vendas novas da maquininha (se o Mercado Pago estiver
 * configurado) e devolve o número da última venda, para a tela saber se precisa se atualizar.
 */
export async function verificarVendasNovas(): Promise<{ ultimaId: number }> {
  await requireAuth()
  if (mpPronto()) {
    try {
      await sincronizarSeNecessario(hoje())
    } catch (error) {
      console.error('Busca automática do Mercado Pago falhou:', error instanceof Error ? error.message : error)
    }
  }
  const [r] = await query<{ ultima: number | null }>('SELECT max(id) AS ultima FROM entradas')
  return { ultimaId: r?.ultima ?? 0 }
}

/** Ajustes: quanto a empresa tem (caixa + conta) no fim de um dia. Não entra como venda. */
export async function salvarSaldoInicial(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  await requireAuth()
  const valor = cents(formData, 'valor')
  if (!valor) return fail('Informe quanto a empresa tem hoje.')
  const data = text(formData, 'data')
  if (!isIsoDate(data) || data > hoje()) return fail('Escolha uma data até hoje.')
  await query(
    `INSERT INTO saldo_inicial (id, valor, data) VALUES (1, $1, $2)
     ON CONFLICT (id) DO UPDATE SET valor = EXCLUDED.valor, data = EXCLUDED.data, atualizado_em = now()`,
    [centsToDecimal(valor), data],
  )
  refresh()
  return done('Saldo da empresa salvo. Ele aparece no Caixa e não conta como venda.')
}
