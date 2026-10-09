'use client'

import { AnimatePresence, motion } from 'framer-motion'
import { useActionState, useEffect, useRef, useState } from 'react'
import { ConfirmButton, MoneyInput, SubmitButton } from '@/components/ui'
import { useToast } from '@/components/toast'
import { createOutraEntrada, deleteOutraEntrada } from '@/lib/actions'
import type { OutraEntrada } from '@/lib/data'
import { formatData } from '@/lib/dates'
import { formatBRL } from '@/lib/money'

const SUGESTOES = ['Renda extra', 'Aporte dos sócios', 'Empréstimo', 'Devolução', 'Outros']

export function EntradaValorForm({ hoje, recentes }: { hoje: string; recentes: OutraEntrada[] }) {
  const [state, action] = useActionState(createOutraEntrada, null)
  const toast = useToast()
  const [valor, setValor] = useState(0)
  const [descricao, setDescricao] = useState('')
  const [data, setData] = useState(hoje)
  const valorRef = useRef<HTMLInputElement>(null)
  const lastAt = useRef<number | undefined>(undefined)

  useEffect(() => {
    if (!state?.at || state.at === lastAt.current) return
    lastAt.current = state.at
    toast({ tone: state.ok ? 'sucesso' : 'erro', message: state.message })
    if (state.ok) {
      setValor(0)
      setDescricao('')
      valorRef.current?.focus()
    }
  }, [state, toast])

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
      <form action={action} className="cartao space-y-6 p-5 sm:p-7">
        <div>
          <label htmlFor="valor" className="rotulo">
            Valor que entrou
          </label>
          <MoneyInput id="valor" name="valor" value={valor} onChange={setValor} large autoFocus inputRef={valorRef} />
        </div>

        <fieldset>
          <legend className="rotulo">De onde veio?</legend>
          <div className="mb-2 flex flex-wrap gap-1.5">
            {SUGESTOES.map((s) => (
              <button
                key={s}
                type="button"
                aria-pressed={descricao === s}
                onClick={() => setDescricao(s)}
                className={`rounded-full px-3.5 py-1.5 text-sm font-semibold transition-colors ${
                  descricao === s
                    ? 'bg-framboesa text-white'
                    : 'border border-linha bg-superficie text-cacau-suave hover:border-borda hover:text-cacau'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
          <label htmlFor="descricao" className="sr-only">
            Descrição
          </label>
          <input
            id="descricao"
            name="descricao"
            required
            maxLength={120}
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            placeholder="Ou escreva: ex.: venda de equipamento usado"
            className="campo"
          />
        </fieldset>

        <div className="sm:w-56">
          <label htmlFor="data" className="rotulo">
            Data
          </label>
          <input
            id="data"
            name="data"
            type="date"
            required
            max={hoje}
            value={data}
            onChange={(e) => setData(e.target.value || hoje)}
            className="campo"
          />
        </div>

        <SubmitButton pendingLabel="Lançando…" disabled={!valor || !descricao.trim()} className="w-full py-4 text-lg">
          Lançar entrada {valor ? `de ${formatBRL(valor)}` : ''}
        </SubmitButton>
      </form>

      <aside aria-labelledby="outras-titulo" className="cartao h-fit p-5">
        <h2 id="outras-titulo" className="font-display text-lg font-bold">
          Últimas entradas de valor
        </h2>
        {recentes.length === 0 ? (
          <p className="mt-3 text-sm text-cacau-suave">Nenhuma ainda.</p>
        ) : (
          <ul className="mt-3 divide-y divide-linha">
            <AnimatePresence initial={false}>
              {recentes.map((e) => (
                <motion.li key={e.id} layout exit={{ opacity: 0, height: 0 }} className="overflow-hidden py-3">
                  <div className="flex items-start justify-between gap-3">
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{e.descricao}</span>
                      <span className="tabular text-xs text-cacau-suave">{formatData(e.data)}</span>
                    </span>
                    <span className="tabular shrink-0 font-semibold text-entrada">+ {formatBRL(e.valorCentavos)}</span>
                  </div>
                  <ConfirmButton
                    label="Excluir"
                    confirmLabel="Toque de novo para excluir"
                    className="mt-2 px-3! py-1! text-xs"
                    onConfirm={async () => {
                      const r = await deleteOutraEntrada(e.id)
                      toast({ tone: r.ok ? 'sucesso' : 'erro', message: r.message })
                    }}
                  />
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        )}
      </aside>
    </div>
  )
}
