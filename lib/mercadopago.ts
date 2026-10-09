import 'server-only'
import { randomUUID } from 'node:crypto'
import { MercadoPagoConfig, Order, Payment, Point } from 'mercadopago'
import { revalidatePath } from 'next/cache'
import { query } from './db'
import { calcularTaxa, centsToDecimal, decimalToCents, type FormaEntrada } from './money'
import { acharTerminal, vendaDoPagamento, type PagamentoMP } from './mp-mapa'
import { addDays, hoje } from './dates'

// Integração híbrida com a maquininha Mercado Pago (Point):
// - Do computador: o sistema envia a cobrança para a maquininha (Orders API) e lança a venda quando ela é paga.
// - Direto na maquininha: o aviso (webhook) do Mercado Pago, ou o botão "Buscar vendas", lança a venda.
// Em todos os caminhos o id do pagamento fica gravado na venda, então o mesmo pagamento nunca entra duas vezes.

const API = 'https://api.mercadopago.com'
const PREFIXO_REF = 'sorveteria-'

export function mpConfig() {
  return {
    token: process.env.MERCADOPAGO_ACCESS_TOKEN?.trim() ?? '',
    segredoWebhook: process.env.MERCADOPAGO_WEBHOOK_SECRET?.trim() ?? '',
    terminal: process.env.MERCADOPAGO_POINT_TERMINAL?.trim() ?? '',
  }
}

export const mpPronto = () => mpConfig().token !== ''

function sdk() {
  const { token } = mpConfig()
  if (!token) throw new Error('O token do Mercado Pago (MERCADOPAGO_ACCESS_TOKEN) ainda não foi configurado.')
  return new MercadoPagoConfig({ accessToken: token, options: { timeout: 10_000 } })
}

// ---------- Conta dona do token ----------

export interface ContaMP {
  id: number
  nickname?: string
  email?: string
  tags?: string[]
}

/** De qual conta do Mercado Pago é o token (para conferir se é a mesma da maquininha). */
export async function contaDoToken(): Promise<{ conta?: ContaMP; erro?: string }> {
  const { token } = mpConfig()
  if (!token) return { erro: 'Token não configurado.' }
  const r = await fetch(`${API}/users/me`, { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' })
  if (!r.ok) return { erro: `O Mercado Pago respondeu ${r.status} ao consultar a conta do token.` }
  return { conta: (await r.json()) as ContaMP }
}

// ---------- Maquininha ----------

export interface Terminal {
  id: string
  operating_mode?: string
  pos_id?: number
  store_id?: string
}

/** Lista as maquininhas da conta e acha a configurada em MERCADOPAGO_POINT_TERMINAL. */
export async function buscarTerminal(): Promise<{ terminal: Terminal | null; todos: Terminal[]; erro?: string }> {
  const { token, terminal } = mpConfig()
  if (!token) return { terminal: null, todos: [], erro: 'Token do Mercado Pago não configurado.' }
  const r = await fetch(`${API}/terminals/v1/list?limit=50&offset=0`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  })
  if (!r.ok) {
    const erro =
      r.status === 401 || r.status === 403
        ? 'O Mercado Pago recusou o token. Confira o MERCADOPAGO_ACCESS_TOKEN (use o de produção).'
        : `O Mercado Pago respondeu ${r.status} ao listar as maquininhas. Tente de novo em alguns minutos.`
    return { terminal: null, todos: [], erro }
  }
  const json = (await r.json()) as { data?: { terminals?: Terminal[] }; terminals?: Terminal[] }
  const todos = json.data?.terminals ?? json.terminals ?? []
  const achado = acharTerminal(todos, terminal)
  return {
    terminal: achado,
    todos,
    erro: achado ? undefined : `Nenhuma maquininha da conta corresponde a "${terminal || '(não informado)'}".`,
  }
}

export type ModoMaquininha = 'PDV' | 'STANDALONE'

/**
 * Troca o modo da maquininha: PDV (recebe cobranças do sistema) ou STANDALONE (uso normal, digitando o valor nela).
 * Usa a API nova de terminais; se a conta ainda estiver na API antiga do Point, tenta por ela.
 * A maquininha precisa ser reiniciada para o novo modo valer.
 */
export async function mudarModoMaquininha(modo: ModoMaquininha): Promise<void> {
  const { token } = mpConfig()
  const { terminal, erro } = await buscarTerminal()
  if (!terminal) throw new Error(erro ?? 'Maquininha não encontrada na conta do Mercado Pago.')

  const r = await fetch(`${API}/terminals/v1/setup`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ terminals: [{ id: terminal.id, operating_mode: modo }] }),
    cache: 'no-store',
  })
  if (r.ok) return
  if (r.status === 404 || r.status === 405) {
    await new Point(sdk()).changeDeviceOperatingMode({ device_id: terminal.id, request: { operating_mode: modo } })
    return
  }
  const corpo = await r.text().catch(() => '')
  throw new Error(`O Mercado Pago não aceitou a troca de modo (${r.status}). ${corpo.slice(0, 200)}`)
}

// ---------- Registrar pagamentos como vendas ----------

async function idMaquininhaMercadoPago(): Promise<number> {
  await query(`INSERT INTO maquininhas (nome) VALUES ('Mercado Pago') ON CONFLICT (nome) DO NOTHING`)
  const [m] = await query<{ id: number }>(`SELECT id FROM maquininhas WHERE nome = 'Mercado Pago'`)
  return m.id
}

/** Só entra o que veio da maquininha: pagamento feito na Point ou cobrança enviada por este sistema. */
function veioDaMaquininha(p: PagamentoMP): boolean {
  return /POINT/i.test(p.point_of_interaction?.type ?? '') || (p.external_reference ?? '').startsWith(PREFIXO_REF)
}

/** Lança (ou remove, se foi estornado) a venda de um pagamento. Devolve o que aconteceu, em texto. */
export async function registrarPagamento(p: PagamentoMP, exigirMaquininha = true): Promise<{ texto: string; entradaId?: number }> {
  const id = p.id === undefined ? '' : String(p.id)
  if (['refunded', 'cancelled', 'charged_back'].includes(p.status ?? '')) {
    const removidas = await query('DELETE FROM entradas WHERE mp_payment_id = $1 RETURNING id', [id])
    return { texto: removidas.length ? `pagamento ${p.status}: venda removida` : `pagamento ${p.status}: nada a remover` }
  }
  if (exigirMaquininha && !veioDaMaquininha(p)) {
    return { texto: `ignorado: não veio da maquininha (origem ${p.point_of_interaction?.type ?? 'desconhecida'})` }
  }
  const v = vendaDoPagamento(p)
  if ('ignorar' in v) return { texto: `ignorado: ${v.ignorar}` }

  const [row] = await query<{ id: number }>(
    `INSERT INTO entradas (data, descricao, forma, maquininha_id, parcelas, valor_bruto, taxa_percentual,
                           valor_taxa, valor_liquido, data_recebimento, origem, mp_payment_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'maquininha', $11)
     ON CONFLICT (mp_payment_id) WHERE mp_payment_id IS NOT NULL DO NOTHING RETURNING id`,
    [
      v.data,
      'Maquininha Mercado Pago',
      v.forma,
      await idMaquininhaMercadoPago(),
      v.parcelas,
      centsToDecimal(v.brutoCentavos),
      v.taxaPercentual.toFixed(2),
      centsToDecimal(v.taxaCentavos),
      centsToDecimal(v.liquidoCentavos),
      v.dataRecebimento,
      v.mpPaymentId,
    ],
  )
  if (!row) return { texto: 'já estava lançada' }
  revalidatePath('/', 'layout')
  return { texto: `venda lançada (#${row.id})`, entradaId: row.id }
}

/** Aviso do tipo "payment": busca o pagamento no Mercado Pago (nunca confia no corpo do aviso). */
export async function processarPagamento(paymentId: string): Promise<string> {
  const p = (await new Payment(sdk()).get({ id: paymentId })) as PagamentoMP
  const r = await registrarPagamento(p)
  // Pagamento de cobrança enviada pelo sistema: liga a venda à cobrança.
  if (r.entradaId && (p.external_reference ?? '').startsWith(PREFIXO_REF)) {
    await query('UPDATE mp_cobrancas SET entrada_id = $2, atualizado_em = now() WHERE external_reference = $1', [
      p.external_reference,
      r.entradaId,
    ])
  }
  return r.texto
}

// ---------- Cobranças enviadas do computador (Orders API) ----------

export type FormaCobranca = Exclude<FormaEntrada, 'dinheiro'>

export async function criarCobranca(valorCentavos: number, forma: FormaCobranca, parcelas: number): Promise<string> {
  const { terminal, erro } = await buscarTerminal()
  if (!terminal) throw new Error(erro ?? 'Maquininha não encontrada na conta do Mercado Pago.')
  if (terminal.operating_mode && terminal.operating_mode !== 'PDV') {
    throw new Error('A maquininha não está no modo PDV (integrado). Mude o modo para receber cobranças do sistema.')
  }

  const referencia = `${PREFIXO_REF}${randomUUID()}`
  const tipo = forma === 'credito' ? 'credit_card' : forma === 'debito' ? 'debit_card' : undefined
  const body = {
    type: 'point',
    external_reference: referencia,
    expiration_time: 'PT16M',
    description: 'Venda da sorveteria',
    transactions: { payments: [{ amount: centsToDecimal(valorCentavos) }] },
    config: {
      point: { terminal_id: terminal.id, print_on_terminal: 'no_ticket' },
      ...(tipo
        ? { payment_method: { default_type: tipo, ...(tipo === 'credit_card' ? { default_installments: parcelas } : {}) } }
        : {}),
    },
  }
  const order = await new Order(sdk()).create({
    body: body as Parameters<Order['create']>[0]['body'],
    requestOptions: { idempotencyKey: referencia },
  })
  if (!order.id) throw new Error('O Mercado Pago não devolveu o número da cobrança.')
  await query(`INSERT INTO mp_cobrancas (order_id, external_reference, valor, status) VALUES ($1, $2, $3, $4)`, [
    order.id,
    referencia,
    centsToDecimal(valorCentavos),
    order.status ?? 'created',
  ])
  return order.id
}

const STATUS_FINAIS = ['processed', 'canceled', 'cancelled', 'expired', 'failed', 'refunded']

/** Consulta a cobrança no Mercado Pago; quando foi paga, lança a venda (uma vez só). */
export async function atualizarCobranca(orderId: string): Promise<{ status: string; final: boolean; entradaId: number | null }> {
  const [cobranca] = await query<{ external_reference: string; entrada_id: number | null }>(
    'SELECT external_reference, entrada_id FROM mp_cobrancas WHERE order_id = $1',
    [orderId],
  )
  if (!cobranca) throw new Error('Cobrança desconhecida.')

  const order = await new Order(sdk()).get({ id: orderId })
  const status = order.status ?? 'desconhecido'
  await query('UPDATE mp_cobrancas SET status = $2, atualizado_em = now() WHERE order_id = $1', [orderId, status])

  let entradaId = cobranca.entrada_id
  if (status === 'processed' && !entradaId) {
    // Preferência: o pagamento "de verdade" (com a taxa real cobrada), achado pela referência da cobrança.
    const busca = await new Payment(sdk()).search({ options: { external_reference: cobranca.external_reference } })
    for (const resumo of busca.results ?? []) {
      if (!resumo.id) continue
      const p = (await new Payment(sdk()).get({ id: resumo.id })) as PagamentoMP
      const r = await registrarPagamento(p, false)
      entradaId = r.entradaId ?? entradaId
    }
    if (!entradaId) {
      const [ja] = await query<{ id: number }>(
        `SELECT e.id FROM entradas e WHERE e.mp_payment_id IN (SELECT unnest($1::text[]))`,
        [(order.transactions?.payments ?? []).map((p) => p.id ?? '')],
      )
      entradaId = ja?.id ?? (await lancarPelaCobranca(order)) ?? null
    }
    if (entradaId) await query('UPDATE mp_cobrancas SET entrada_id = $2 WHERE order_id = $1', [orderId, entradaId])
  }
  return { status, final: STATUS_FINAIS.includes(status), entradaId }
}

/** Plano B: o pagamento ainda não aparece na busca, então lança pela própria cobrança com a taxa de Configurações. */
async function lancarPelaCobranca(order: Awaited<ReturnType<Order['get']>>): Promise<number | null> {
  const pg = order.transactions?.payments?.[0]
  if (!pg?.id) return null
  const tipo = pg.payment_method?.type
  const forma: FormaEntrada = tipo === 'credit_card' ? 'credito' : tipo === 'debit_card' ? 'debito' : 'pix'
  const parcelas = forma === 'credito' ? Math.min(Math.max(pg.payment_method?.installments ?? 1, 1), 12) : 1
  const bruto = decimalToCents(pg.paid_amount ?? pg.amount ?? '0')
  if (bruto <= 0) return null
  const maquininhaId = await idMaquininhaMercadoPago()
  const [taxa] = await query<{ percentual: string; prazo_dias: number }>(
    'SELECT percentual, prazo_dias FROM taxas WHERE maquininha_id = $1 AND forma = $2 AND parcelas = $3',
    [maquininhaId, forma, parcelas],
  )
  const percentual = taxa ? Number(taxa.percentual) : 0
  const { taxaCentavos, liquidoCentavos } = calcularTaxa(bruto, percentual)
  const data = hoje()
  const [row] = await query<{ id: number }>(
    `INSERT INTO entradas (data, descricao, forma, maquininha_id, parcelas, valor_bruto, taxa_percentual,
                           valor_taxa, valor_liquido, data_recebimento, origem, mp_payment_id)
     VALUES ($1, 'Maquininha Mercado Pago', $2, $3, $4, $5, $6, $7, $8, $9, 'maquininha', $10)
     ON CONFLICT (mp_payment_id) WHERE mp_payment_id IS NOT NULL DO NOTHING RETURNING id`,
    [
      data,
      forma,
      maquininhaId,
      parcelas,
      centsToDecimal(bruto),
      percentual.toFixed(2),
      centsToDecimal(taxaCentavos),
      centsToDecimal(liquidoCentavos),
      addDays(data, taxa?.prazo_dias ?? 0),
      pg.id,
    ],
  )
  if (row) revalidatePath('/', 'layout')
  return row?.id ?? null
}

/** Aviso do tipo "order": só interessa se for uma cobrança enviada por este sistema. */
export async function processarOrder(orderId: string): Promise<string> {
  const [cobranca] = await query('SELECT 1 FROM mp_cobrancas WHERE order_id = $1', [orderId])
  if (!cobranca) return 'ignorado: cobrança não foi criada por este sistema'
  const r = await atualizarCobranca(orderId)
  return `cobrança ${r.status}${r.entradaId ? ` (venda #${r.entradaId})` : ''}`
}

export async function cancelarCobranca(orderId: string): Promise<void> {
  await new Order(sdk()).cancel({ id: orderId })
  await query(`UPDATE mp_cobrancas SET status = 'canceled', atualizado_em = now() WHERE order_id = $1`, [orderId])
}

// ---------- Buscar as vendas do dia (sem depender do aviso) ----------

function resumoPagamento(p: { date_created?: string; transaction_amount?: number; payment_type_id?: string; status?: string }, origem?: string) {
  const quando = p.date_created ? new Date(p.date_created) : null
  const data = quando
    ? new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).format(quando)
    : '?'
  const valor = p.transaction_amount !== undefined ? `R$ ${p.transaction_amount.toFixed(2).replace('.', ',')}` : 'R$ ?'
  return `${data} ${valor} (${p.payment_type_id ?? '?'}, ${p.status ?? '?'}${origem ? `, origem ${origem}` : ''})`
}

/** Busca os pagamentos do dia na conta e lança os que vieram da maquininha e ainda não estão no sistema. */
export async function sincronizarDia(
  dia: string,
): Promise<{ lancadas: number; jaEstavam: number; ignoradas: number; detalhe: string }> {
  const busca = await new Payment(sdk()).search({
    options: {
      range: 'date_created',
      begin_date: `${dia}T00:00:00.000-03:00`,
      end_date: `${dia}T23:59:59.999-03:00`,
      sort: 'date_created',
      criteria: 'asc',
      limit: 100,
    },
  })
  const resultado = { lancadas: 0, jaEstavam: 0, ignoradas: 0 }
  const motivos: string[] = []
  for (const resumo of busca.results ?? []) {
    if (!resumo.id) continue
    const p = (await new Payment(sdk()).get({ id: resumo.id })) as PagamentoMP
    const r = await registrarPagamento(p)
    if (r.entradaId) resultado.lancadas++
    else if (r.texto === 'já estava lançada') resultado.jaEstavam++
    else {
      resultado.ignoradas++
      motivos.push(`${resumoPagamento(p as never, p.point_of_interaction?.type)}: ${r.texto}`)
    }
  }

  let detalhe = `${resultado.lancadas} lançadas, ${resultado.jaEstavam} já estavam, ${resultado.ignoradas} ignoradas`
  if (motivos.length) detalhe += `. Ignoradas: ${motivos.slice(0, 5).join(' | ')}`
  if (!busca.results?.length) {
    // Nenhum pagamento hoje: mostra os últimos da conta, para saber se o token enxerga as vendas da maquininha.
    const ultimos = await new Payment(sdk()).search({ options: { sort: 'date_created', criteria: 'desc', limit: 3 } })
    const lista = (ultimos.results ?? []).map((p) => resumoPagamento(p as never))
    detalhe += lista.length
      ? `. Nenhum pagamento hoje nesta conta. Últimos pagamentos da conta: ${lista.join(' | ')}`
      : '. Esta conta não tem NENHUM pagamento registrado no Mercado Pago.'
  }
  await registrarEvento('busca manual', dia, detalhe)
  return { ...resultado, detalhe }
}

// ---------- Registro dos avisos ----------

export async function registrarEvento(tipo: string, recursoId: string | null, resultado: string) {
  await query('INSERT INTO mp_eventos (tipo, recurso_id, resultado) VALUES ($1, $2, $3)', [tipo, recursoId, resultado.slice(0, 900)])
  await query(`DELETE FROM mp_eventos WHERE recebido_em < now() - interval '60 days'`)
}

export async function ultimosEventos(limite = 10) {
  return query<{ recebido_em: Date; tipo: string; recurso_id: string | null; resultado: string }>(
    'SELECT recebido_em, tipo, recurso_id, resultado FROM mp_eventos ORDER BY recebido_em DESC LIMIT $1',
    [limite],
  )
}
