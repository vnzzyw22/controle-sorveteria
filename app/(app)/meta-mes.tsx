'use client'

import { motion } from 'framer-motion'
import { TriangleAlert } from 'lucide-react'
import Link from 'next/link'
import { AnimatedBRL } from '@/components/ui'
import { nomeDoMes, type PainelMeta } from '@/lib/analise'
import { formatBRL } from '@/lib/money'

const pctTexto = (bp: number) => `${(bp / 100).toFixed(1).replace('.', ',').replace(',0', '')}%`

/** Posição do rótulo junto ao traço: centralizado, mas sem sair do cartão nas pontas. */
function posicao(pct: number): React.CSSProperties {
  if (pct < 14) return { left: `${pct}%` }
  if (pct > 86) return { right: `${100 - pct}%` }
  return { left: `${pct}%`, transform: 'translateX(-50%)' }
}

/**
 * Quanto já foi vendido no mês, contra a meta e contra o ponto de equilíbrio.
 * A barra termina no maior dos três valores, então os dois traços sempre aparecem.
 */
export function MetaMes({ painel: p }: { painel: PainelMeta }) {
  const escala = Math.max(p.metaCentavos ?? 0, p.equilibrioCentavos, p.vendidoCentavos, 1)
  const pctVendido = (p.vendidoCentavos / escala) * 100
  const pctMeta = p.metaCentavos ? (p.metaCentavos / escala) * 100 : null
  const pctEquilibrio = p.equilibrioCentavos > 0 ? (p.equilibrioCentavos / escala) * 100 : null
  const metaBatida = p.metaCentavos !== null && p.vendidoCentavos >= p.metaCentavos
  const mes = nomeDoMes(p.mes)

  return (
    <section aria-labelledby="meta-titulo" className="cartao p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
        <div>
          <h2 id="meta-titulo" className="text-sm font-medium text-cacau-suave">
            {p.metaCentavos ? `Meta de ${mes}` : `Vendas de ${mes}`}
          </h2>
          <p className="mt-0.5 flex flex-wrap items-baseline gap-x-2">
            <AnimatedBRL cents={p.vendidoCentavos} className="font-display text-[32px] font-bold leading-tight tracking-tight" />
            {p.metaCentavos && <span className="text-cacau-suave">de {formatBRL(p.metaCentavos)}</span>}
          </p>
        </div>
        <div className="flex items-center gap-3 pt-1">
          {p.pctMeta !== null && (
            <span
              className={`rounded-full px-3 py-1 text-sm font-semibold ${
                metaBatida ? 'bg-dinheiro-fundo text-dinheiro' : 'bg-framboesa-clara text-framboesa-escura'
              }`}
            >
              {metaBatida ? 'Meta batida' : `${p.pctMeta}% da meta`}
            </span>
          )}
          <Link href="/config#meta" className="text-sm font-semibold text-framboesa hover:underline">
            {p.metaCentavos ? 'Alterar meta' : 'Definir meta'}
          </Link>
        </div>
      </div>

      {/* Barra: o que já foi vendido; traços marcam o ponto de equilíbrio (em cima) e a meta (embaixo). */}
      <div className={`relative ${pctEquilibrio !== null ? 'mt-9' : 'mt-5'} ${pctMeta !== null ? 'mb-9' : 'mb-2'}`}>
        {pctEquilibrio !== null && (
          <span
            aria-hidden
            style={posicao(pctEquilibrio)}
            className="absolute -top-7 whitespace-nowrap text-xs font-semibold text-cacau"
          >
            Equilíbrio {formatBRL(p.equilibrioCentavos)}
          </span>
        )}
        <div
          role="img"
          aria-label={`Vendido ${formatBRL(p.vendidoCentavos)}${
            p.metaCentavos ? ` de uma meta de ${formatBRL(p.metaCentavos)}` : ''
          }${p.equilibrioCentavos ? `. Ponto de equilíbrio em ${formatBRL(p.equilibrioCentavos)}` : ''}`}
          className="relative h-3.5 rounded-full bg-framboesa-clara"
        >
          <motion.div
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            style={{ width: `${Math.max(pctVendido, p.vendidoCentavos > 0 ? 1.5 : 0)}%`, originX: 0 }}
            className={`h-full rounded-full ${metaBatida ? 'bg-entrada' : 'bg-framboesa'}`}
          />
          {pctEquilibrio !== null && (
            <span
              aria-hidden
              style={{ left: `${pctEquilibrio}%` }}
              className="absolute -top-2 h-[calc(100%+1rem)] w-[3px] -translate-x-1/2 rounded-full bg-cacau ring-2 ring-superficie"
            />
          )}
        </div>
        {pctMeta !== null && (
          <span
            aria-hidden
            style={posicao(pctMeta)}
            className="absolute top-full mt-2 whitespace-nowrap text-xs font-semibold text-framboesa-escura"
          >
            Meta {formatBRL(p.metaCentavos!)}
          </span>
        )}
      </div>

      {p.metaAbaixoDoEquilibrio && (
        <p className="mb-4 flex gap-2 rounded-xl bg-alerta-fundo p-3 text-sm text-alerta">
          <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
          <span>
            <strong className="font-semibold">A meta está abaixo do ponto de equilíbrio.</strong> Mesmo batendo{' '}
            {formatBRL(p.metaCentavos!)}, as contas do mês ({formatBRL(p.equilibrioCentavos)} em vendas) não fecham.
          </span>
        </p>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="rounded-xl bg-creme-fundo p-4">
          <h3 className="text-sm font-semibold text-cacau-suave">Para bater a meta</h3>
          {p.metaCentavos === null ? (
            <p className="mt-1 text-[15px]">
              Defina quanto quer vender neste mês e acompanhe o quanto falta, dia a dia.
            </p>
          ) : metaBatida ? (
            <>
              <p className="mt-1 font-display text-lg font-bold text-entrada">Meta batida</p>
              <p className="mt-0.5 text-sm text-cacau-suave">
                Passou {formatBRL(p.vendidoCentavos - p.metaCentavos)} da meta.
              </p>
            </>
          ) : (
            <>
              <p className="tabular mt-1 font-display text-lg font-bold">Faltam {formatBRL(p.faltaMetaCentavos!)}</p>
              <p className="mt-0.5 text-sm text-cacau-suave">
                Dá {formatBRL(p.porDiaParaMetaCentavos!)} por dia
                {p.diasRestantes > 1 ? `, nos ${p.diasRestantes} dias que restam (contando hoje).` : ': hoje é o último dia.'}
              </p>
            </>
          )}
          {p.projecaoCentavos !== null && (
            <p className="mt-2 border-t border-linha pt-2 text-sm text-cacau-suave">
              No ritmo de agora, o mês fecha perto de {formatBRL(p.projecaoCentavos)}.
            </p>
          )}
        </div>

        <div className="rounded-xl bg-creme-fundo p-4">
          <h3 className="text-sm font-semibold text-cacau-suave">Para pagar as contas do mês</h3>
          {p.contasCentavos === 0 ? (
            <p className="mt-1 text-[15px]">
              Nenhuma conta lançada para {mes} ainda. Lance as saídas (aluguel, funcionários, compras) para ver quanto
              precisa vender.
            </p>
          ) : p.equilibrioAtingido ? (
            <>
              <p className="mt-1 font-display text-lg font-bold text-entrada">Contas do mês cobertas</p>
              <p className="tabular mt-0.5 text-sm text-cacau-suave">
                Precisava vender {formatBRL(p.equilibrioCentavos)}; já passou disso.
              </p>
            </>
          ) : (
            <>
              <p className="tabular mt-1 font-display text-lg font-bold">
                Precisa vender {formatBRL(p.equilibrioCentavos)}
              </p>
              <p className="tabular mt-0.5 text-sm text-cacau-suave">Faltam {formatBRL(p.faltaEquilibrioCentavos)}.</p>
            </>
          )}
          {p.contasCentavos > 0 && (
            <p className="mt-2 border-t border-linha pt-2 text-sm text-cacau-suave">
              Contas lançadas para {mes}: {formatBRL(p.contasCentavos)}
              {p.taxaMediaBp > 0 ? `, mais a taxa das maquininhas (em média ${pctTexto(p.taxaMediaBp)}).` : '.'}
            </p>
          )}
        </div>
      </div>
    </section>
  )
}
