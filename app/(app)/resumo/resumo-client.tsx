'use client'

import { motion } from 'framer-motion'
import { ArrowDownRight, ArrowUpRight } from 'lucide-react'
import Link from 'next/link'
import { FORMA_BAR } from '@/components/ui'
import {
  DIAS_SEMANA,
  mediaPorDia,
  nomeDoMes,
  rotuloMes,
  semanaCompleta,
  variacaoPct,
} from '@/lib/analise'
import type { getResumo } from '@/lib/data'
import { formatDataCurta } from '@/lib/dates'
import { FORMA_LABEL, formatBRL } from '@/lib/money'
import { OPCOES_PERIODO, type resolverPeriodo } from '@/lib/periodos'
import { BarraSabores } from '../caixa-do-dia'

type Resumo = Awaited<ReturnType<typeof getResumo>>
type Periodo = ReturnType<typeof resolverPeriodo>

/** Valor curto para caber em cima de cada coluna do gráfico: 850, 4,9 mil, 14 mil, 1,2 mi (sempre em reais). */
function curto(centavos: number): string {
  const reais = centavos / 100
  const um = (n: number) => n.toFixed(1).replace('.', ',').replace(',0', '')
  if (reais >= 1_000_000) return `${um(reais / 1_000_000)} mi`
  if (reais >= 10_000) return `${Math.round(reais / 1000)} mil`
  if (reais >= 1_000) return `${um(reais / 1000)} mil`
  return String(Math.round(reais))
}

const decimal1 = (n: number) => n.toFixed(1).replace('.', ',')

const entrada = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] as const } },
}

// Um destaque por gráfico: a barra que conta a história em framboesa, o resto em cinza quente.
const BARRA_DESTAQUE = 'bg-framboesa'
const BARRA_COMUM = 'bg-borda'

export function ResumoView({ resumo, periodo, hoje }: { resumo: Resumo; periodo: Periodo; hoje: string }) {
  return (
    <motion.div initial="hidden" animate="show" transition={{ staggerChildren: 0.07 }} className="space-y-8">
      <motion.section variants={entrada} aria-labelledby="meses-titulo">
        <h2 id="meses-titulo" className="mb-3 font-display text-xl font-bold">
          Mês contra mês
        </h2>
        <MesContraMes resumo={resumo} hoje={hoje} />
      </motion.section>

      <div className="space-y-6">
        <motion.div variants={entrada} className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-xl font-bold">Olhando {periodo.frase}</h2>
          <SeletorPeriodo atual={periodo.chave} />
        </motion.div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <motion.section variants={entrada} aria-labelledby="semana-titulo" className="cartao p-5 sm:p-6">
            <DiasDaSemana resumo={resumo} frase={periodo.frase} />
          </motion.section>
          <motion.section variants={entrada} aria-labelledby="formas-resumo-titulo" className="cartao p-5 sm:p-6">
            <FormasDePagamento resumo={resumo} frase={periodo.frase} />
          </motion.section>
        </div>

        <motion.section variants={entrada} aria-labelledby="categorias-titulo" className="cartao p-5 sm:p-6">
          <Categorias resumo={resumo} frase={periodo.frase} />
        </motion.section>
      </div>
    </motion.div>
  )
}

function SeletorPeriodo({ atual }: { atual: string }) {
  return (
    <nav
      aria-label="Período analisado"
      className="grid w-full grid-cols-4 gap-1 rounded-2xl bg-creme-fundo p-1.5 sm:inline-grid sm:w-auto"
    >
      {OPCOES_PERIODO.map((o) => {
        const ativo = o.chave === atual
        return (
          <Link
            key={o.chave}
            href={`/resumo?periodo=${o.chave}`}
            aria-current={ativo ? 'page' : undefined}
            scroll={false}
            className={`flex min-h-10 items-center justify-center whitespace-nowrap rounded-xl px-1.5 text-sm font-semibold transition-colors sm:px-4 ${
              ativo ? 'bg-superficie text-framboesa shadow-sm ring-1 ring-linha' : 'text-cacau-suave hover:text-cacau'
            }`}
          >
            {o.rotulo}
          </Link>
        )
      })}
    </nav>
  )
}

// ---------- Mês contra mês ----------

function MesContraMes({ resumo, hoje }: { resumo: Resumo; hoje: string }) {
  const { atual, mesmoPeriodoAnterior: ant, periodoAnterior, serie, mesAtual } = resumo
  const ticket = (p: { brutoCentavos: number; quantidade: number }) =>
    p.quantidade > 0 ? Math.round(p.brutoCentavos / p.quantidade) : 0
  const rotuloAnterior = `${formatDataCurta(periodoAnterior.de)} a ${formatDataCurta(periodoAnterior.ate)}`
  const mes = nomeDoMes(mesAtual)

  const linhas = [
    {
      nome: 'Vendas (bruto)',
      valor: formatBRL(atual.brutoCentavos),
      pct: variacaoPct(atual.brutoCentavos, ant.brutoCentavos),
    },
    {
      nome: 'Vendas lançadas',
      valor: String(atual.quantidade),
      pct: variacaoPct(atual.quantidade, ant.quantidade),
    },
    {
      nome: 'Ticket médio',
      valor: atual.quantidade ? formatBRL(ticket(atual)) : '—',
      pct: variacaoPct(ticket(atual), ticket(ant)),
    },
  ]

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
      <div className="cartao p-5 sm:p-6">
        <p className="text-sm text-cacau-suave">
          {mes[0].toUpperCase() + mes.slice(1)} até dia {Number(hoje.slice(8, 10))}, contra o mesmo período do mês
          anterior ({rotuloAnterior}).
        </p>
        <dl className="mt-3 divide-y divide-linha">
          {linhas.map((l) => (
            <div key={l.nome} className="flex items-center justify-between gap-3 py-3">
              <div>
                <dt className="text-sm text-cacau-suave">{l.nome}</dt>
                <dd className="tabular font-display text-2xl font-bold tracking-tight">{l.valor}</dd>
              </div>
              <Variacao pct={l.pct} />
            </div>
          ))}
        </dl>
      </div>

      <div className="cartao p-5 sm:p-6">
        <h3 className="font-semibold">Vendas dos últimos 6 meses</h3>
        <p className="text-sm text-cacau-suave">
          Valor bruto, em reais. {mes[0].toUpperCase() + mes.slice(1)} ainda está em andamento.
        </p>
        <GraficoMeses serie={serie} mesAtual={mesAtual} />
      </div>
    </div>
  )
}

function Variacao({ pct }: { pct: number | null }) {
  if (pct === null) return <span className="text-sm text-cacau-suave">sem base para comparar</span>
  if (pct === 0) return <span className="text-sm font-medium text-cacau-suave">igual ao mês anterior</span>
  const subiu = pct > 0
  const Icone = subiu ? ArrowUpRight : ArrowDownRight
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 text-sm font-semibold ${
        subiu ? 'bg-dinheiro-fundo text-dinheiro' : 'bg-saida/10 text-saida'
      }`}
    >
      <Icone aria-hidden className="size-4" />
      <span className="sr-only">{subiu ? 'Subiu' : 'Caiu'}</span>
      {subiu ? '+' : '−'}
      {Math.abs(pct)}%
    </span>
  )
}

function GraficoMeses({ serie, mesAtual }: { serie: Resumo['serie']; mesAtual: string }) {
  const max = Math.max(...serie.map((s) => s.brutoCentavos), 1)
  if (serie.every((s) => s.brutoCentavos === 0)) return <Vazio>Nenhuma venda lançada nos últimos 6 meses.</Vazio>
  return (
    <ol className="mt-4 flex gap-1.5 sm:gap-4">
      {serie.map((s, i) => {
        const ehAtual = s.mes === mesAtual
        // A barra mais alta ocupa 82% da coluna; o resto da altura é para o valor escrito em cima dela.
        const altura = s.brutoCentavos > 0 ? Math.max((s.brutoCentavos / max) * 82, 1.5) : 0
        return (
          <li
            key={s.mes}
            aria-label={`${rotuloMes(s.mes)}: ${s.brutoCentavos ? formatBRL(s.brutoCentavos) : 'sem vendas'}`}
            className="flex min-w-0 flex-1 flex-col items-center"
          >
            <div aria-hidden className="flex h-44 w-full flex-col items-center justify-end">
              <span
                className={`tabular mb-1.5 whitespace-nowrap text-[11px] sm:text-xs ${ehAtual ? 'font-bold' : 'font-medium text-cacau-suave'}`}
              >
                {s.brutoCentavos ? curto(s.brutoCentavos) : '—'}
              </span>
              {altura > 0 && (
                <motion.div
                  initial={{ scaleY: 0 }}
                  animate={{ scaleY: 1 }}
                  transition={{ duration: 0.6, delay: 0.1 + i * 0.06, ease: [0.22, 1, 0.36, 1] }}
                  style={{ height: `${altura}%`, originY: 1 }}
                  className={`w-full max-w-6 rounded-t-[4px] ${ehAtual ? BARRA_DESTAQUE : BARRA_COMUM}`}
                />
              )}
            </div>
            <span aria-hidden className="mt-2 h-px w-full bg-linha" />
            <span aria-hidden className={`mt-2 text-xs ${ehAtual ? 'font-bold' : 'text-cacau-suave'}`}>
              {rotuloMes(s.mes)}
            </span>
          </li>
        )
      })}
    </ol>
  )
}

// ---------- Linhas de barra horizontal (dias da semana e categorias) ----------

function LinhaBarra({
  nome,
  valor,
  detalhe,
  pct,
  destaque,
  apagada,
}: {
  nome: React.ReactNode
  valor: string
  detalhe?: string
  /** Largura da barra, de 0 a 100. */
  pct: number
  destaque?: boolean
  apagada?: boolean
}) {
  return (
    <li className="py-2">
      <div className="flex items-baseline justify-between gap-3">
        <span className={`min-w-0 break-words ${destaque ? 'font-semibold' : ''} ${apagada ? 'text-cacau-suave' : ''}`}>
          {nome}
        </span>
        <span className="tabular shrink-0 text-right">
          <span className={apagada ? 'text-cacau-suave' : 'font-semibold'}>{valor}</span>
          {detalhe && <span className="text-xs text-cacau-suave"> · {detalhe}</span>}
        </span>
      </div>
      <div aria-hidden className="mt-1.5 h-3 rounded-[4px] bg-creme-fundo">
        {pct > 0 && (
          <motion.div
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ duration: 0.6, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
            style={{ width: `${Math.max(pct, 1.5)}%`, originX: 0 }}
            className={`h-full rounded-r-[4px] ${destaque ? BARRA_DESTAQUE : BARRA_COMUM}`}
          />
        )}
      </div>
    </li>
  )
}

function Vazio({ children }: { children: React.ReactNode }) {
  return <p className="mt-4 rounded-xl bg-creme-fundo p-4 text-sm text-cacau-suave">{children}</p>
}

// ---------- Dias da semana ----------

function DiasDaSemana({ resumo, frase }: { resumo: Resumo; frase: string }) {
  const semana = semanaCompleta(resumo.diasDaSemana)
  const comVenda = semana.filter((d) => d.dias > 0)
  const maior = Math.max(...semana.map(mediaPorDia), 0)
  const melhor = comVenda.length ? comVenda.reduce((a, b) => (mediaPorDia(b) > mediaPorDia(a) ? b : a)) : null
  const pior = comVenda.length > 1 ? comVenda.reduce((a, b) => (mediaPorDia(b) < mediaPorDia(a) ? b : a)) : null
  const razao = melhor && pior && mediaPorDia(pior) > 0 ? mediaPorDia(melhor) / mediaPorDia(pior) : null

  return (
    <>
      <h3 id="semana-titulo" className="font-display text-lg font-bold">
        Dias da semana
      </h3>
      <p className="text-sm text-cacau-suave">
        Média vendida por dia em que a loja vendeu, {frase}. Mostra quais dias merecem mais gente ou horário maior.
      </p>
      {melhor ? (
        <>
          <p className="mt-3 rounded-xl bg-creme-fundo p-3 text-[15px]">
            <strong className="font-semibold">{DIAS_SEMANA[melhor.dow]}</strong> é o dia mais forte: média de{' '}
            {formatBRL(mediaPorDia(melhor))}
            {razao && razao >= 1.25 && pior
              ? `, ${decimal1(razao)} vezes a de ${DIAS_SEMANA[pior.dow].toLowerCase()}.`
              : '.'}
            {razao && razao < 1.25 && ' Os dias da semana vendem de forma parecida.'}
          </p>
          <ul className="mt-3 divide-y divide-linha">
            {semana.map((d) => (
              <LinhaBarra
                key={d.dow}
                nome={DIAS_SEMANA[d.dow]}
                valor={d.dias ? formatBRL(mediaPorDia(d)) : 'sem vendas'}
                detalhe={d.dias ? `${d.dias} ${d.dias === 1 ? 'dia' : 'dias'}` : undefined}
                pct={maior ? (mediaPorDia(d) / maior) * 100 : 0}
                destaque={d.dow === melhor.dow}
                apagada={d.dias === 0}
              />
            ))}
          </ul>
        </>
      ) : (
        <Vazio>Nenhuma venda {frase}.</Vazio>
      )}
    </>
  )
}

// ---------- Formas de pagamento ----------

function FormasDePagamento({ resumo, frase }: { resumo: Resumo; frase: string }) {
  const { formas } = resumo
  const total = formas.reduce((a, f) => a + f.brutoCentavos, 0)
  const taxas = formas.reduce((a, f) => a + f.taxaCentavos, 0)

  return (
    <>
      <h3 id="formas-resumo-titulo" className="font-display text-lg font-bold">
        Formas de pagamento
      </h3>
      <p className="text-sm text-cacau-suave">Como os clientes pagaram {frase}.</p>
      {total === 0 ? (
        <Vazio>Nenhuma venda {frase}.</Vazio>
      ) : (
        <>
          <BarraSabores formas={formas} total={total} />
          <table className="mt-5 w-full text-[13px] sm:text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-cacau-suave">
                <th className="pb-2 font-medium">Forma</th>
                <th className="pb-2 text-right font-medium">Vendas</th>
                <th className="pb-2 text-right font-medium">%</th>
                <th className="pb-2 text-right font-medium">Taxa</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-linha">
              {formas.map((f) => (
                <tr key={f.forma}>
                  <td className="py-2.5">
                    <span className="flex items-center gap-2">
                      <span aria-hidden className={`size-2.5 rounded-full ${FORMA_BAR[f.forma]}`} />
                      {FORMA_LABEL[f.forma]}
                      <span className="hidden text-xs text-cacau-suave sm:inline">({f.quantidade})</span>
                    </span>
                  </td>
                  <td className="tabular py-2.5 text-right font-semibold">{formatBRL(f.brutoCentavos)}</td>
                  <td className="tabular py-2.5 text-right">{Math.round((f.brutoCentavos / total) * 100)}%</td>
                  <td className="tabular py-2.5 text-right text-saida">
                    {f.taxaCentavos ? `− ${formatBRL(f.taxaCentavos)}` : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-4 rounded-xl bg-creme-fundo p-3 text-sm">
            {taxas > 0 ? (
              <>
                As maquininhas ficaram com <strong className="font-semibold">{formatBRL(taxas)}</strong> (
                {decimal1((taxas / total) * 100)}% do que foi vendido).
              </>
            ) : (
              'Nenhuma taxa descontada. Cadastre as taxas em Configurações para ver quanto as maquininhas custam.'
            )}
          </p>
          {resumo.maquininhas.length > 0 && (
            <>
              <h4 className="mt-5 text-sm font-semibold text-cacau-suave">Por maquininha</h4>
              <ul className="mt-2 divide-y divide-linha">
                {resumo.maquininhas.map((m) => (
                  <li key={m.nome} className="flex items-baseline justify-between gap-3 py-2.5 text-sm">
                    <span className="min-w-0">
                      <span className="font-semibold">{m.nome}</span>{' '}
                      <span className="text-cacau-suave">
                        ({m.quantidade} {m.quantidade === 1 ? 'venda' : 'vendas'})
                      </span>
                    </span>
                    <span className="tabular shrink-0 text-right">
                      <span className="font-semibold">{formatBRL(m.brutoCentavos)}</span>
                      <span className="text-saida">
                        {' '}
                        · taxa {m.brutoCentavos ? decimal1((m.taxaCentavos / m.brutoCentavos) * 100) : '0,0'}%
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </>
      )}
    </>
  )
}

// ---------- Para onde vai o dinheiro ----------

const MAX_CATEGORIAS = 7

function Categorias({ resumo, frase }: { resumo: Resumo; frase: string }) {
  const { categorias } = resumo
  const total = categorias.reduce((a, c) => a + c.totalCentavos, 0)
  const nomeadas = categorias.filter((c) => c.categoria)
  const semCategoria = categorias.find((c) => !c.categoria)?.totalCentavos ?? 0

  // As maiores aparecem; o resto vira "Outras categorias" para a lista não crescer sem fim.
  const visiveis = nomeadas.slice(0, MAX_CATEGORIAS)
  const resto = nomeadas.slice(MAX_CATEGORIAS)
  const restoTotal = resto.reduce((a, c) => a + c.totalCentavos, 0)
  const linhas = [
    ...visiveis.map((c) => ({ nome: c.categoria!, total: c.totalCentavos, apagada: false })),
    ...(resto.length ? [{ nome: `Outras categorias (${resto.length})`, total: restoTotal, apagada: false }] : []),
    ...(semCategoria ? [{ nome: 'Sem categoria', total: semCategoria, apagada: true }] : []),
  ]
  const maior = Math.max(...linhas.map((l) => l.total), 1)
  const maiorNomeada = Math.max(...nomeadas.map((c) => c.totalCentavos), 0)

  return (
    <>
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h3 id="categorias-titulo" className="font-display text-lg font-bold">
          Para onde vai o dinheiro
        </h3>
        {total > 0 && (
          <p className="tabular text-sm text-cacau-suave">
            Saídas {frase}: <strong className="font-semibold text-cacau">{formatBRL(total)}</strong>
          </p>
        )}
      </div>
      <p className="text-sm text-cacau-suave">
        Cada conta entra no dia do vencimento, como no caixa. Uma compra parcelada pesa só a parcela de cada mês.
      </p>
      {total === 0 ? (
        <Vazio>Nenhuma saída com vencimento {frase}.</Vazio>
      ) : (
        <>
          <ul className="mt-3 grid gap-x-10 divide-y divide-linha lg:grid-cols-2 lg:divide-y-0">
            {linhas.map((l) => (
              <LinhaBarra
                key={l.nome}
                nome={l.nome}
                valor={formatBRL(l.total)}
                detalhe={`${Math.round((l.total / total) * 100)}%`}
                pct={(l.total / maior) * 100}
                destaque={!l.apagada && l.total === maiorNomeada}
                apagada={l.apagada}
              />
            ))}
          </ul>
          {semCategoria / total >= 0.3 && (
            <p className="mt-3 rounded-xl bg-alerta-fundo p-3 text-sm text-alerta">
              Boa parte das saídas ({Math.round((semCategoria / total) * 100)}%) está sem categoria. Escolha uma categoria
              ao lançar a saída para este quadro ficar completo.
            </p>
          )}
        </>
      )}
    </>
  )
}
