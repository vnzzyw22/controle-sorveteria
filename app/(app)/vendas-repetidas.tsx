'use client'

import { AnimatePresence, motion } from 'framer-motion'
import { CopyX } from 'lucide-react'
import { ConfirmButton, FormaBadge } from '@/components/ui'
import { useToast } from '@/components/toast'
import { juntarVendaRepetida, marcarNaoRepetida } from '@/lib/actions'
import type { VendaRepetida } from '@/lib/data'
import { formatBRL } from '@/lib/money'

/** Aviso no Caixa: vendas que entraram duas vezes (à mão ou pela cobrança, e também pela maquininha). */
export function VendasRepetidas({ pares }: { pares: VendaRepetida[] }) {
  const toast = useToast()
  if (!pares.length) return null
  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      aria-labelledby="repetidas-titulo"
      className="mb-5 rounded-2xl bg-alerta-fundo p-5 text-alerta"
    >
      <h2 id="repetidas-titulo" className="flex items-center gap-2 font-display text-lg font-bold">
        <CopyX aria-hidden className="size-5" />
        {pares.length === 1 ? '1 venda parece repetida' : `${pares.length} vendas parecem repetidas`}
      </h2>
      <p className="mt-1 text-sm">
        A mesma venda entrou duas vezes. Ao juntar, fica a que veio da maquininha (com a taxa real) e a outra é apagada.
      </p>
      <ul className="mt-3 divide-y divide-alerta/15">
        <AnimatePresence initial={false}>
          {pares.map((p) => (
            <motion.li
              key={p.repetidaId}
              exit={{ opacity: 0, height: 0 }}
              className="flex flex-wrap items-center justify-between gap-3 py-2.5 text-sm text-cacau"
            >
              <span className="flex flex-wrap items-center gap-2">
                <strong className="tabular">{formatBRL(p.valorCentavos)}</strong>
                <FormaBadge forma={p.forma} />
                <span className="text-cacau-suave">
                  {p.comoEntrou === 'manual' ? 'lançada à mão' : 'cobrança'} às {p.horaRepetida} · maquininha às {p.horaMaquininha}
                </span>
              </span>
              <span className="flex gap-2">
                <button
                  type="button"
                  onClick={async () => {
                    const r = await marcarNaoRepetida(p.repetidaId)
                    toast({ tone: r.ok ? 'sucesso' : 'erro', message: r.message })
                  }}
                  className="rounded-xl px-3 py-2.5 text-sm font-semibold text-cacau-suave hover:bg-superficie hover:text-cacau"
                >
                  Não é repetida
                </button>
                <ConfirmButton
                  label="Juntar"
                  confirmLabel="Toque de novo para juntar"
                  onConfirm={async () => {
                    const r = await juntarVendaRepetida(p.repetidaId, p.ficaId)
                    toast({ tone: r.ok ? 'sucesso' : 'erro', message: r.message })
                  }}
                />
              </span>
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>
    </motion.section>
  )
}
