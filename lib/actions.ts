'use server'

import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { requireAuth } from './auth'
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
  dividirParcelas,
  type FormaEntrada,
  type FormaSaida,
} from './money'
import { SESSION_COOKIE, createSessionToken, passwordMatches } from './session'
import { PRAZO_PADRAO } from './taxas'

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

export async function createEntrada(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  await requireAuth()

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

  let percentual = 0
  let prazoDias = 0

  if (maquininhaId !== null) {
    if (!Number.isInteger(maquininhaId)) return fail('Maquininha inválida.')
    const [maq] = await query<{ nome: string; ativa: boolean }>('SELECT nome, ativa FROM maquininhas WHERE id = $1', [
      maquininhaId,
    ])
    if (!maq || !maq.ativa) return fail('Essa maquininha não está ativa.')

    const [taxa] = await query<{ percentual: string; prazo_dias: number }>(
      'SELECT percentual, prazo_dias FROM taxas WHERE maquininha_id = $1 AND forma = $2 AND parcelas = $3',
      [maquininhaId, forma, parcelas],
    )
    if (!taxa) {
      const tipo = forma === 'credito' ? `crédito ${parcelas}x` : FORMA_LABEL[forma].toLowerCase()
      return fail(`A taxa de ${tipo} da ${maq.nome} não está cadastrada. Cadastre em Configurações.`)
    }
    percentual = Number(taxa.percentual)
    prazoDias = taxa.prazo_dias
  } else {
    parcelas = 1
  }

  const { taxaCentavos, liquidoCentavos } = calcularTaxa(valor, percentual)
  const [row] = await query<{ id: number }>(
    `INSERT INTO entradas (data, descricao, forma, maquininha_id, parcelas, valor_bruto, taxa_percentual,
                           valor_taxa, valor_liquido, data_recebimento)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id`,
    [
      data,
      descricao,
      forma,
      maquininhaId,
      parcelas,
      centsToDecimal(valor),
      percentual.toFixed(2),
      centsToDecimal(taxaCentavos),
      centsToDecimal(liquidoCentavos),
      addDays(data, prazoDias),
    ],
  )
  refresh()
  return done('Venda lançada.', row.id)
}

export async function deleteEntrada(id: number): Promise<ActionResult> {
  await requireAuth()
  if (!Number.isInteger(id)) return fail('Venda inválida.')
  const rows = await query<{ id: number }>('DELETE FROM entradas WHERE id = $1 RETURNING id', [id])
  refresh()
  return rows.length ? done('Venda excluída.') : fail('Essa venda já não existe.')
}

// ---------- Saídas ----------

export async function createSaida(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  await requireAuth()

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

  const categoria = text(formData, 'categoria', 60) || null
  const fornecedor = text(formData, 'fornecedor', 120) || null
  const valores = dividirParcelas(valor, numParcelas)
  const today = hoje()

  const id = await transaction(async (client) => {
    const { rows } = await client.query<{ id: number }>(
      `INSERT INTO saidas (data, descricao, categoria, fornecedor, forma, condicao, num_parcelas, valor_total)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
      [data, descricao, categoria, fornecedor, forma, condicao, numParcelas, centsToDecimal(valor)],
    )
    const saidaId = rows[0].id
    for (let i = 0; i < numParcelas; i++) {
      const vencimento = addMonths(primeiroVencimento, i)
      // À vista que já venceu é considerado pago; parcelas ficam em aberto até serem marcadas.
      const pagoEm = condicao === 'a_vista' && vencimento <= today ? vencimento : null
      await client.query(
        `INSERT INTO saidas_parcelas (saida_id, numero, vencimento, valor, pago_em) VALUES ($1, $2, $3, $4, $5)`,
        [saidaId, i + 1, vencimento, centsToDecimal(valores[i]), pagoEm],
      )
    }
    return saidaId
  })

  refresh()
  return done(condicao === 'parcelado' ? `Saída lançada em ${numParcelas} parcelas.` : 'Saída lançada.', id)
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
