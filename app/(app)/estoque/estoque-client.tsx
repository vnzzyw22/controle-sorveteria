'use client'

import { AnimatePresence, motion } from 'framer-motion'
import { Minus, PackagePlus, Plus } from 'lucide-react'
import { useActionState, useEffect, useRef, useState } from 'react'
import { Segmented, SubmitButton } from '@/components/ui'
import { useToast } from '@/components/toast'
import { movimentarEstoque } from '@/lib/actions'
import type { ItemEstoque, MovimentoEstoque } from '@/lib/data'
import { formatDataCurta, formatHora, hoje } from '@/lib/dates'

const SITUACAO = {
  ok: { texto: 'Em dia', classe: 'bg-dinheiro-fundo text-dinheiro' },
  baixo: { texto: 'Acabando', classe: 'bg-alerta-fundo text-alerta' },
  acabou: { texto: 'Acabou', classe: 'bg-saida/10 text-saida' },
} as const

const MOTIVO = { venda: 'Venda', entrada: 'Chegou', ajuste: 'Contagem' } as const

export function EstoqueClient({ itens, movimentos }: { itens: ItemEstoque[]; movimentos: MovimentoEstoque[] }) {
  const [aberto, setAberto] = useState<string | null>(null)
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
      <ul className="space-y-3">
        {itens.map((item) => (
          <li key={item.produto} className="cartao overflow-hidden">
            <button
              type="button"
              onClick={() => setAberto(aberto === item.produto ? null : item.produto)}
              aria-expanded={aberto === item.produto}
              className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
            >
              <span>
                <span className="block font-display text-lg font-bold">{item.nome}</span>
                <span className={`mt-1 inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${SITUACAO[item.situacao].classe}`}>
                  {SITUACAO[item.situacao].texto}
                </span>
                <span className="ml-2 text-xs text-cacau-suave">
                  {item.minimo === 0 ? 'sem aviso' : `aviso com ${item.minimo} ou menos`}
                </span>
              </span>
              <span className="text-right">
                <span className="tabular block font-display text-3xl font-bold leading-none">{item.quantidade}</span>
                <span className="text-xs text-cacau-suave">unidades</span>
              </span>
            </button>
            <AnimatePresence initial={false}>
              {aberto === item.produto && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                  className="overflow-hidden"
                >
                  <Movimentar item={item} />
                </motion.div>
              )}
            </AnimatePresence>
          </li>
        ))}
      </ul>

      <aside aria-labelledby="mov-titulo" className="cartao h-fit p-5">
        <h2 id="mov-titulo" className="font-display text-lg font-bold">
          Últimos movimentos
        </h2>
        {movimentos.length === 0 ? (
          <p className="mt-3 text-sm text-cacau-suave">Nada ainda. Comece registrando o que tem em cada bebida.</p>
        ) : (
          <ul className="mt-3 divide-y divide-linha text-sm">
            {movimentos.map((m) => {
              const d = new Date(m.criadoEm)
              const dia = hoje(d)
              return (
                <li key={m.id} className="flex items-center justify-between gap-3 py-2.5">
                  <span>
                    <span className="block font-medium">{m.nome}</span>
                    <span className="text-xs text-cacau-suave">
                      {MOTIVO[m.motivo]} · {dia === hoje() ? 'hoje' : formatDataCurta(dia)} {formatHora(d)}
                    </span>
                  </span>
                  <span className={`tabular font-semibold ${m.quantidade > 0 ? 'text-entrada' : 'text-saida'}`}>
                    {m.quantidade > 0 ? `+${m.quantidade}` : m.quantidade}
                  </span>
                </li>
              )
            })}
          </ul>
        )}
      </aside>
    </div>
  )
}

type Tipo = 'entrada' | 'ajuste' | 'minimo'

function Movimentar({ item }: { item: ItemEstoque }) {
  const [state, action] = useActionState(movimentarEstoque, null)
  const toast = useToast()
  const [tipo, setTipo] = useState<Tipo>('entrada')
  const [qtd, setQtd] = useState(tipo === 'entrada' ? 12 : item.quantidade)
  const lastAt = useRef<number | undefined>(undefined)

  useEffect(() => {
    if (!state?.at || state.at === lastAt.current) return
    lastAt.current = state.at
    toast({ tone: state.ok ? 'sucesso' : 'erro', message: state.message })
  }, [state, toast])

  function escolher(t: Tipo) {
    setTipo(t)
    setQtd(t === 'entrada' ? 12 : t === 'ajuste' ? Math.max(item.quantidade, 0) : item.minimo)
  }

  const rotulo = {
    entrada: 'Quantas chegaram?',
    ajuste: 'Quantas tem agora?',
    minimo: 'Avisar quando tiver (0 = não avisar)',
  }[tipo]
  const botao = { entrada: `Adicionar ${qtd}`, ajuste: `Corrigir para ${qtd}`, minimo: 'Salvar aviso' }[tipo]

  return (
    <form action={action} className="space-y-4 border-t border-linha px-5 pb-5 pt-4">
      <input type="hidden" name="produto" value={item.produto} />
      <Segmented
        name="tipo"
        legend="O que você quer fazer?"
        hideLegend
        layoutId={`tipo-estoque-${item.produto}`}
        value={tipo}
        onChange={escolher}
        options={[
          { value: 'entrada', label: (<><PackagePlus aria-hidden className="size-4" /> Chegou</>) },
          { value: 'ajuste', label: 'Contei' },
          { value: 'minimo', label: 'Aviso' },
        ]}
      />
      <div>
        <label htmlFor={`qtd-${item.produto}`} className="rotulo">
          {rotulo}
        </label>
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label="Diminuir"
            onClick={() => setQtd((q) => Math.max(0, q - 1))}
            className="grid size-12 place-items-center rounded-xl border border-linha bg-superficie hover:border-borda"
          >
            <Minus aria-hidden className="size-5" />
          </button>
          <input
            id={`qtd-${item.produto}`}
            name="quantidade"
            inputMode="numeric"
            value={qtd}
            onChange={(e) => setQtd(Math.min(10_000, Number(e.target.value.replace(/\D/g, '')) || 0))}
            className="campo tabular w-24 text-center text-xl font-bold"
          />
          <button
            type="button"
            aria-label="Aumentar"
            onClick={() => setQtd((q) => Math.min(10_000, q + 1))}
            className="grid size-12 place-items-center rounded-xl border border-linha bg-superficie hover:border-borda"
          >
            <Plus aria-hidden className="size-5" />
          </button>
        </div>
      </div>
      <SubmitButton pendingLabel="Salvando…" disabled={tipo === 'entrada' && qtd < 1} className="w-full">
        {botao}
      </SubmitButton>
    </form>
  )
}
