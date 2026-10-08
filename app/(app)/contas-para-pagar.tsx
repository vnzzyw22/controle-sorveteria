'use client'

import { motion } from 'framer-motion'
import { CircleCheck, TriangleAlert } from 'lucide-react'
import Link from 'next/link'
import { useState } from 'react'
import { FormaBadge } from '@/components/ui'
import { useToast } from '@/components/toast'
import { setParcelaPaga } from '@/lib/actions'
import type { ContasAlerta, Parcela } from '@/lib/data'
import { formatData, formatDataCurta } from '@/lib/dates'
import { formatBRL } from '@/lib/money'
import { linkEditarSaida } from '@/lib/voltar'

const soma = (xs: Parcela[]) => xs.reduce((a, p) => a + p.valorCentavos, 0)

/** Aviso da tela inicial: o que já venceu e o que vence hoje e amanhã, com "Paguei" em cada conta. */
export function ContasParaPagar({ contas }: { contas: ContasAlerta }) {
  const { vencidas, hoje, amanha } = contas
  const total = vencidas.quantidade + hoje.length + amanha.length

  if (total === 0) {
    return (
      <p className="mb-5 flex items-center gap-2 text-sm text-cacau-suave">
        <CircleCheck aria-hidden className="size-4 shrink-0 text-entrada" />
        Nenhuma conta vencida e nada vence hoje nem amanhã.
      </p>
    )
  }

  const restantesVencidas = vencidas.quantidade - vencidas.itens.length
  const aPagarEmBreve = soma(hoje) + soma(amanha)

  return (
    <motion.section
      aria-labelledby="contas-titulo"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="mb-5 rounded-2xl bg-alerta-fundo p-4 text-cacau sm:p-5"
    >
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <h2 id="contas-titulo" className="flex items-center gap-2 font-display text-lg font-bold">
          <TriangleAlert aria-hidden className="size-5 shrink-0 text-alerta" />
          Contas para pagar
        </h2>
        <Link href="/historico?aba=contas" className="text-sm font-semibold text-alerta underline underline-offset-2">
          Ver todas as contas
        </Link>
      </div>

      <div className="mt-3 space-y-4">
        {vencidas.quantidade > 0 && (
          <Grupo
            titulo={vencidas.quantidade === 1 ? '1 conta vencida' : `${vencidas.quantidade} contas vencidas`}
            totalCentavos={vencidas.totalCentavos}
            tom="text-saida"
            itens={vencidas.itens}
            mostrarVencimento
          >
            {restantesVencidas > 0 && (
              <p className="pt-2 text-sm">
                e mais {restantesVencidas} {restantesVencidas === 1 ? 'conta vencida' : 'contas vencidas'}.{' '}
                <Link href="/historico?aba=contas" className="font-semibold underline underline-offset-2">
                  Ver todas
                </Link>
              </p>
            )}
          </Grupo>
        )}
        {hoje.length > 0 && <Grupo titulo="Vencem hoje" totalCentavos={soma(hoje)} tom="text-alerta" itens={hoje} />}
        {amanha.length > 0 && (
          <Grupo titulo="Vencem amanhã" totalCentavos={soma(amanha)} tom="text-cacau-suave" itens={amanha} />
        )}
      </div>
      {aPagarEmBreve > 0 && vencidas.quantidade > 0 && (
        <p className="mt-3 border-t border-alerta/20 pt-3 text-sm text-cacau-suave">
          Entre hoje e amanhã: {formatBRL(aPagarEmBreve)}. Mais as vencidas: {formatBRL(vencidas.totalCentavos)}.
        </p>
      )}
    </motion.section>
  )
}

function Grupo({
  titulo,
  totalCentavos,
  tom,
  itens,
  mostrarVencimento,
  children,
}: {
  titulo: string
  totalCentavos: number
  tom: string
  itens: Parcela[]
  mostrarVencimento?: boolean
  children?: React.ReactNode
}) {
  return (
    <div>
      <h3 className="flex items-baseline justify-between gap-3 text-sm font-semibold">
        <span className={tom}>{titulo}</span>
        <span className="tabular text-cacau-suave">{formatBRL(totalCentavos)}</span>
      </h3>
      <ul className="mt-1 divide-y divide-alerta/15">
        {itens.map((p) => (
          <Linha key={p.id} parcela={p} mostrarVencimento={mostrarVencimento} />
        ))}
      </ul>
      {children}
    </div>
  )
}

function Linha({ parcela: p, mostrarVencimento }: { parcela: Parcela; mostrarVencimento?: boolean }) {
  const toast = useToast()
  const [ocupada, setOcupada] = useState(false)

  async function pagar() {
    setOcupada(true)
    const r = await setParcelaPaga(p.id, true)
    setOcupada(false)
    if (!r.ok) return toast({ tone: 'erro', message: r.message })
    toast({
      tone: 'sucesso',
      message: `${p.descricao} marcada como paga.`,
      action: {
        label: 'Desfazer',
        onClick: async () => {
          const d = await setParcelaPaga(p.id, false)
          if (!d.ok) toast({ tone: 'erro', message: d.message })
        },
      },
    })
  }

  return (
    // Celular: nome em cima (quebra em vez de ser cortado), valor ao lado e o botão embaixo, junto dos detalhes.
    // Tela larga: nome + detalhes à esquerda, valor e botão à direita, centralizados.
    <li className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-1.5 py-3 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:gap-x-5">
      <span className="col-start-1 row-start-1 min-w-0 break-words font-medium">{p.descricao}</span>
      <span className="col-start-1 row-start-2 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-xs text-cacau-suave">
        <FormaBadge forma={p.forma} />
        {p.totalParcelas > 1 && (
          <span>
            parcela {p.numero}/{p.totalParcelas}
          </span>
        )}
        {mostrarVencimento && (
          <span title={`Venceu em ${formatData(p.vencimento)}`}>venceu {formatDataCurta(p.vencimento)}</span>
        )}
        <Link
          href={linkEditarSaida(p.saidaId, '/')}
          aria-label={`Editar conta: ${p.descricao}`}
          className="font-semibold text-alerta underline underline-offset-2"
        >
          Editar
        </Link>
      </span>
      <span className="tabular col-start-2 row-start-1 justify-self-end font-semibold sm:row-span-2 sm:self-center">
        {formatBRL(p.valorCentavos)}
      </span>
      <button
        type="button"
        onClick={pagar}
        disabled={ocupada}
        aria-label={`Marcar como paga: ${p.descricao}, ${formatBRL(p.valorCentavos)}`}
        className="col-start-2 row-start-2 min-h-10 justify-self-end rounded-xl border border-alerta/35 bg-superficie px-4 text-sm font-semibold text-cacau transition-colors hover:border-alerta hover:bg-white disabled:opacity-50 sm:col-start-3 sm:row-span-2 sm:row-start-1 sm:self-center"
      >
        {ocupada ? 'Salvando…' : 'Paguei'}
      </button>
    </li>
  )
}
