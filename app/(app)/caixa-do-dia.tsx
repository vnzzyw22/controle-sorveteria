'use client'

import { AnimatePresence, motion } from 'framer-motion'
import Link from 'next/link'
import { useState } from 'react'
import { AnimatedBRL, ConfirmButton, FORMA_BAR, FormaBadge } from '@/components/ui'
import { useToast } from '@/components/toast'
import { deleteEntrada } from '@/lib/actions'
import type { CaixaDia } from '@/lib/data'
import { formatDataCurta, formatHora } from '@/lib/dates'
import { FORMAS_ENTRADA, FORMA_LABEL, formatBRL } from '@/lib/money'

const grupo = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] as const } },
}

export function CaixaDoDia({ caixa, data }: { caixa: CaixaDia; data: string }) {
  const { totais } = caixa
  return (
    <motion.div
      initial="hidden"
      animate="show"
      transition={{ staggerChildren: 0.07 }}
      className="space-y-6"
    >
      {/* Indicadores */}
      <motion.section variants={grupo} aria-label="Resumo do dia" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Kpi label="Vendas (bruto)" cents={totais.brutoCentavos} hint={`${totais.quantidadeVendas} ${totais.quantidadeVendas === 1 ? 'venda' : 'vendas'}`} />
        <Kpi label="Taxas das maquininhas" cents={-totais.taxaCentavos} hint="descontadas" tone="text-saida" />
        <Kpi label="Entrou (líquido)" cents={totais.liquidoCentavos} tone="text-entrada" />
        <Kpi label="Saídas do dia" cents={-totais.saidasCentavos} hint={`${caixa.saidas.length} ${caixa.saidas.length === 1 ? 'pagamento' : 'pagamentos'}`} tone="text-saida" />
        <div className="col-span-full rounded-2xl bg-cacau p-5 text-creme sm:col-span-2 lg:col-span-1">
          <p className="text-sm text-creme/70">Saldo do dia</p>
          <AnimatedBRL cents={totais.saldoCentavos} className="mt-1 block font-display text-[28px] font-bold tracking-tight" />
          <p className="mt-1 text-xs text-creme/70">líquido − saídas</p>
        </div>
      </motion.section>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        {/* Por forma de pagamento */}
        <motion.section variants={grupo} aria-labelledby="formas-titulo" className="cartao p-5 sm:p-6">
          <h2 id="formas-titulo" className="font-display text-lg font-bold">
            Por forma de pagamento
          </h2>
          {totais.brutoCentavos === 0 ? (
            <Vazio>Nenhuma venda neste dia.</Vazio>
          ) : (
            <>
              <BarraSabores formas={caixa.formas} total={totais.brutoCentavos} />
              <table className="mt-5 w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-cacau-suave">
                    <th className="pb-2 font-medium">Forma</th>
                    <th className="pb-2 text-right font-medium">Bruto</th>
                    <th className="pb-2 text-right font-medium">Taxa</th>
                    <th className="pb-2 text-right font-medium">Líquido</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-linha">
                  {FORMAS_ENTRADA.map((f) => {
                    const r = caixa.formas.find((x) => x.forma === f)
                    return (
                      <tr key={f} className={r ? '' : 'text-cacau-suave'}>
                        <td className="py-2.5">
                          <span className="flex items-center gap-2">
                            <span aria-hidden className={`size-2.5 rounded-full ${FORMA_BAR[f]}`} />
                            {FORMA_LABEL[f]}
                            {r && <span className="text-xs text-cacau-suave">({r.quantidade})</span>}
                          </span>
                        </td>
                        <td className="tabular py-2.5 text-right">{formatBRL(r?.brutoCentavos ?? 0)}</td>
                        <td className="tabular py-2.5 text-right text-saida">
                          {r?.taxaCentavos ? `− ${formatBRL(r.taxaCentavos)}` : '—'}
                        </td>
                        <td className="tabular py-2.5 text-right font-semibold">{formatBRL(r?.liquidoCentavos ?? 0)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </>
          )}
        </motion.section>

        {/* Por maquininha */}
        <motion.section variants={grupo} aria-labelledby="maq-titulo" className="cartao p-5 sm:p-6">
          <h2 id="maq-titulo" className="font-display text-lg font-bold">
            Por maquininha
          </h2>
          {caixa.maquininhas.length === 0 ? (
            <Vazio>Nenhuma venda passou em maquininha.</Vazio>
          ) : (
            <ul className="mt-4 space-y-3">
              {caixa.maquininhas.map((m) => {
                const pct = m.brutoCentavos ? (m.taxaCentavos / m.brutoCentavos) * 100 : 0
                return (
                  <li key={m.nome} className="rounded-xl bg-creme-fundo p-4">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="font-semibold">{m.nome}</span>
                      <span className="tabular font-semibold">{formatBRL(m.brutoCentavos)}</span>
                    </div>
                    <div className="mt-1 flex items-baseline justify-between gap-3 text-sm text-cacau-suave">
                      <span>
                        {m.quantidade} {m.quantidade === 1 ? 'venda' : 'vendas'}
                      </span>
                      <span className="tabular text-saida">
                        taxa − {formatBRL(m.taxaCentavos)} ({pct.toFixed(2).replace('.', ',')}%)
                      </span>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </motion.section>
      </div>

      {/* Movimentações */}
      <div className="grid gap-6 lg:grid-cols-2">
        <motion.section variants={grupo} aria-labelledby="vendas-titulo" className="cartao p-5 sm:p-6">
          <div className="flex items-baseline justify-between gap-3">
            <h2 id="vendas-titulo" className="font-display text-lg font-bold">
              Vendas
            </h2>
            <Link href={`/historico?de=${data}&ate=${data}`} className="text-sm font-semibold text-framboesa hover:underline">
              Abrir no histórico
            </Link>
          </div>
          {caixa.entradas.length === 0 ? (
            <Vazio>
              Nada lançado ainda.{' '}
              <Link href="/vendas/nova" className="font-semibold text-framboesa underline">
                Lançar venda
              </Link>
            </Vazio>
          ) : (
            <ListaVendas entradas={caixa.entradas} />
          )}
        </motion.section>

        <motion.section variants={grupo} aria-labelledby="saidas-titulo" className="cartao p-5 sm:p-6">
          <div className="flex items-baseline justify-between gap-3">
            <h2 id="saidas-titulo" className="font-display text-lg font-bold">
              Saídas do dia
            </h2>
            <Link href="/historico?aba=contas" className="text-sm font-semibold text-framboesa hover:underline">
              Contas a pagar
            </Link>
          </div>
          {caixa.saidas.length === 0 ? (
            <Vazio>Nenhum pagamento com vencimento neste dia.</Vazio>
          ) : (
            <ul className="mt-3 divide-y divide-linha">
              {caixa.saidas.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-3 py-3">
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{p.descricao}</span>
                    <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-cacau-suave">
                      <FormaBadge forma={p.forma} />
                      {p.totalParcelas > 1 && <span>parcela {p.numero}/{p.totalParcelas}</span>}
                      {p.categoria && <span>{p.categoria}</span>}
                      {!p.pagoEm && <span className="font-semibold text-alerta">a pagar</span>}
                    </span>
                  </span>
                  <span className="tabular shrink-0 font-semibold text-saida">− {formatBRL(p.valorCentavos)}</span>
                </li>
              ))}
            </ul>
          )}
        </motion.section>
      </div>
    </motion.div>
  )
}

function Kpi({ label, cents, hint, tone }: { label: string; cents: number; hint?: string; tone?: string }) {
  return (
    <div className="cartao p-5">
      <p className="text-sm text-cacau-suave">{label}</p>
      <AnimatedBRL cents={cents} className={`mt-1 block font-display text-2xl font-bold tracking-tight ${tone ?? ''}`} />
      {hint && <p className="mt-1 text-xs text-cacau-suave">{hint}</p>}
    </div>
  )
}

/** Faixa empilhada com a participação de cada forma nas vendas — como bolas de sorvete lado a lado. */
function BarraSabores({ formas, total }: { formas: CaixaDia['formas']; total: number }) {
  const ordenadas = FORMAS_ENTRADA.map((f) => formas.find((x) => x.forma === f)).filter((x) => x && x.brutoCentavos > 0)
  return (
    <div className="mt-4">
      <div
        role="img"
        aria-label={ordenadas
          .map((r) => `${FORMA_LABEL[r!.forma]} ${Math.round((r!.brutoCentavos / total) * 100)}%`)
          .join(', ')}
        className="flex h-4 gap-1 overflow-hidden"
      >
        {ordenadas.map((r, i) => (
          <motion.span
            key={r!.forma}
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ duration: 0.6, delay: 0.15 + i * 0.08, ease: [0.22, 1, 0.36, 1] }}
            style={{ width: `${(r!.brutoCentavos / total) * 100}%`, originX: 0 }}
            className={`min-w-2 rounded-full ${FORMA_BAR[r!.forma]}`}
          />
        ))}
      </div>
      <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-cacau-suave" aria-hidden>
        {ordenadas.map((r) => (
          <span key={r!.forma}>
            {FORMA_LABEL[r!.forma]} {Math.round((r!.brutoCentavos / total) * 100)}%
          </span>
        ))}
      </p>
    </div>
  )
}

function ListaVendas({ entradas }: { entradas: CaixaDia['entradas'] }) {
  const toast = useToast()
  const [abertas, setAbertas] = useState<number | null>(null)
  return (
    <ul className="mt-3 divide-y divide-linha">
      <AnimatePresence initial={false}>
        {entradas.map((v) => (
          <motion.li key={v.id} layout exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
            <div className="flex items-center justify-between gap-3 py-3">
              <button
                type="button"
                onClick={() => setAbertas(abertas === v.id ? null : v.id)}
                aria-expanded={abertas === v.id}
                className="min-w-0 flex-1 rounded-lg text-left"
              >
                <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <FormaBadge forma={v.forma} parcelas={v.parcelas} />
                  <span className="text-xs text-cacau-suave">
                    {formatHora(new Date(v.criadoEm))}
                    {v.maquininhaNome ? ` · ${v.maquininhaNome}` : ''}
                  </span>
                </span>
                {v.descricao && <span className="mt-0.5 block truncate text-sm">{v.descricao}</span>}
              </button>
              <span className="shrink-0 text-right">
                <span className="tabular block font-semibold">{formatBRL(v.brutoCentavos)}</span>
                {v.taxaCentavos > 0 && (
                  <span className="tabular block text-xs text-cacau-suave">líq. {formatBRL(v.liquidoCentavos)}</span>
                )}
              </span>
            </div>
            <AnimatePresence initial={false}>
              {abertas === v.id && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-creme-fundo p-3 text-sm">
                    <span className="text-cacau-suave">
                      Venda #{v.id} · taxa {v.taxaPercentual.toFixed(2).replace('.', ',')}% · cai em{' '}
                      {formatDataCurta(v.dataRecebimento)}
                    </span>
                    <ConfirmButton
                      label="Excluir venda"
                      confirmLabel="Confirmar exclusão"
                      className="py-1.5!"
                      onConfirm={async () => {
                        const r = await deleteEntrada(v.id)
                        toast({ tone: r.ok ? 'sucesso' : 'erro', message: r.message })
                      }}
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.li>
        ))}
      </AnimatePresence>
    </ul>
  )
}

function Vazio({ children }: { children: React.ReactNode }) {
  return <p className="mt-4 rounded-xl bg-creme-fundo p-4 text-sm text-cacau-suave">{children}</p>
}
