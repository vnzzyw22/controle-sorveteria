'use client'

import { AnimatePresence, motion } from 'framer-motion'
import { ChevronDown, Plus } from 'lucide-react'
import { useActionState, useEffect, useRef, useState } from 'react'
import { SubmitButton } from '@/components/ui'
import { useToast } from '@/components/toast'
import { addMaquininha, saveTaxas, setMaquininhaAtiva, type ActionResult } from '@/lib/actions'
import type { Maquininha, Taxa } from '@/lib/data'
import { MAX_PARCELAS_CREDITO } from '@/lib/money'
import { PRAZO_PADRAO } from '@/lib/taxas'

const LINHAS = [
  { key: 'debito', forma: 'debito', parcelas: 1, label: 'Débito' },
  { key: 'pix', forma: 'pix', parcelas: 1, label: 'Pix na maquininha' },
  ...Array.from({ length: MAX_PARCELAS_CREDITO }, (_, i) => ({
    key: `credito_${i + 1}`,
    forma: 'credito' as const,
    parcelas: i + 1,
    label: i === 0 ? 'Crédito à vista' : `Crédito ${i + 1}x`,
  })),
] as const

const TOTAL_LINHAS = LINHAS.length

/** Mostra um aviso quando chega uma resposta nova da Server Action. */
function useResultToast(state: ActionResult | null, onOk?: () => void) {
  const toast = useToast()
  const lastAt = useRef<number | undefined>(undefined)
  useEffect(() => {
    if (!state?.at || state.at === lastAt.current) return
    lastAt.current = state.at
    toast({ tone: state.ok ? 'sucesso' : 'erro', message: state.message })
    if (state.ok) onOk?.()
  }, [state, toast, onOk])
}

export function ConfigClient({ maquininhas, taxas }: { maquininhas: Maquininha[]; taxas: Taxa[] }) {
  const [aberta, setAberta] = useState<number | null>(() => {
    // Abre a primeira maquininha que ainda não tem taxa nenhuma.
    const semTaxa = maquininhas.find((m) => m.ativa && !taxas.some((t) => t.maquininhaId === m.id))
    return semTaxa?.id ?? null
  })

  return (
    <div className="space-y-4">
      {maquininhas.map((m) => {
        const minhas = taxas.filter((t) => t.maquininhaId === m.id)
        const open = aberta === m.id
        return (
          <section key={m.id} className={`cartao overflow-hidden ${m.ativa ? '' : 'opacity-70'}`}>
            <h2>
              <button
                type="button"
                onClick={() => setAberta(open ? null : m.id)}
                aria-expanded={open}
                aria-controls={`taxas-${m.id}`}
                className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
              >
                <span>
                  <span className="block font-display text-lg font-bold">
                    {m.nome}
                    {!m.ativa && <span className="ml-2 text-sm font-medium text-cacau-suave">(inativa)</span>}
                  </span>
                  <span
                    className={`text-sm ${minhas.length === 0 ? 'font-semibold text-alerta' : 'text-cacau-suave'}`}
                  >
                    {minhas.length === 0
                      ? 'Nenhuma taxa cadastrada'
                      : `${minhas.length} de ${TOTAL_LINHAS} taxas cadastradas`}
                  </span>
                </span>
                <motion.span animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.2 }}>
                  <ChevronDown aria-hidden className="size-5 text-cacau-suave" />
                </motion.span>
              </button>
            </h2>
            <AnimatePresence initial={false}>
              {open && (
                <motion.div
                  id={`taxas-${m.id}`}
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                  className="overflow-hidden"
                >
                  <TaxasForm maquininha={m} taxas={minhas} />
                </motion.div>
              )}
            </AnimatePresence>
          </section>
        )
      })}
      <NovaMaquininha onCriada={(id) => setAberta(id)} />
    </div>
  )
}

function TaxasForm({ maquininha, taxas }: { maquininha: Maquininha; taxas: Taxa[] }) {
  const [state, action] = useActionState(saveTaxas, null)
  useResultToast(state)
  const toast = useToast()
  const [mudandoStatus, setMudandoStatus] = useState(false)

  const valorDe = (forma: string, parcelas: number) =>
    taxas.find((t) => t.forma === forma && t.parcelas === parcelas)

  return (
    <form action={action} className="border-t border-linha px-5 pb-5 pt-4">
      <input type="hidden" name="maquininha" value={maquininha.id} />
      <p className="mb-3 text-sm text-cacau-suave">
        Deixe a taxa em branco para as opções que vocês não usam. “Recebe em” é quantos dias o dinheiro leva para cair
        na conta (0 = no mesmo dia).
      </p>
      {/* Celular: cada tipo vira um bloco (nome em cima, campos lado a lado). Tela larga: tabela de 3 colunas. */}
      <div>
        <div
          aria-hidden
          className="hidden grid-cols-[minmax(0,1fr)_8rem_9rem] gap-3 pb-2 text-xs font-medium uppercase tracking-wide text-cacau-suave sm:grid"
        >
          <span>Tipo</span>
          <span>Taxa (%)</span>
          <span>Recebe em (dias)</span>
        </div>
        <div className="divide-y divide-linha">
          {LINHAS.map((l) => {
            const t = valorDe(l.forma, l.parcelas)
            const idPct = `${maquininha.id}-${l.key}-pct`
            const idPrazo = `${maquininha.id}-${l.key}-prazo`
            return (
              <div
                key={l.key}
                className="grid grid-cols-2 gap-x-3 gap-y-1.5 py-3 sm:grid-cols-[minmax(0,1fr)_8rem_9rem] sm:items-center sm:py-2"
              >
                <p className="col-span-2 text-sm font-semibold sm:col-span-1 sm:font-medium">{l.label}</p>
                <div>
                  <span aria-hidden className="mb-1 block text-xs text-cacau-suave sm:hidden">
                    Taxa (%)
                  </span>
                  <label className="sr-only" htmlFor={idPct}>
                    Taxa de {l.label} (%)
                  </label>
                  <input
                    id={idPct}
                    name={`${l.key}_pct`}
                    inputMode="decimal"
                    autoComplete="off"
                    defaultValue={t ? t.percentual.toFixed(2).replace('.', ',') : ''}
                    placeholder="—"
                    pattern="\d{1,2}([.,]\d{1,2})?"
                    title="Use até duas casas decimais, por exemplo 3,15"
                    className="campo tabular py-2! text-right"
                  />
                </div>
                <div>
                  <span aria-hidden className="mb-1 block text-xs text-cacau-suave sm:hidden">
                    Recebe em (dias)
                  </span>
                  <label className="sr-only" htmlFor={idPrazo}>
                    Dias para receber {l.label}
                  </label>
                  <input
                    id={idPrazo}
                    name={`${l.key}_prazo`}
                    type="number"
                    inputMode="numeric"
                    min={0}
                    max={365}
                    defaultValue={t ? t.prazoDias : ''}
                    placeholder={String(PRAZO_PADRAO[l.forma])}
                    className="campo tabular py-2! text-right"
                  />
                </div>
              </div>
            )
          })}
        </div>
      </div>
      <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
        <button
          type="button"
          disabled={mudandoStatus}
          onClick={async () => {
            setMudandoStatus(true)
            const r = await setMaquininhaAtiva(maquininha.id, !maquininha.ativa)
            setMudandoStatus(false)
            toast({ tone: r.ok ? 'sucesso' : 'erro', message: r.message })
          }}
          className="rounded-xl px-4 py-2.5 text-sm font-semibold text-cacau-suave hover:bg-creme-fundo hover:text-cacau disabled:opacity-50"
        >
          {maquininha.ativa ? 'Desativar maquininha' : 'Reativar maquininha'}
        </button>
        <SubmitButton pendingLabel="Salvando…">Salvar taxas da {maquininha.nome}</SubmitButton>
      </div>
    </form>
  )
}

function NovaMaquininha({ onCriada }: { onCriada: (id: number) => void }) {
  const [state, action] = useActionState(addMaquininha, null)
  const formRef = useRef<HTMLFormElement>(null)
  const [aberto, setAberto] = useState(false)
  const lastAt = useRef<number | undefined>(undefined)
  const toast = useToast()

  useEffect(() => {
    if (!state?.at || state.at === lastAt.current) return
    lastAt.current = state.at
    toast({ tone: state.ok ? 'sucesso' : 'erro', message: state.message })
    if (state.ok) {
      formRef.current?.reset()
      setAberto(false)
      if (state.id) onCriada(state.id)
    }
  }, [state, toast, onCriada])

  if (!aberto) {
    return (
      <button
        type="button"
        onClick={() => setAberto(true)}
        className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-borda px-5 py-4 font-semibold text-cacau-suave hover:bg-superficie hover:text-cacau"
      >
        <Plus aria-hidden className="size-5" />
        Adicionar outra maquininha
      </button>
    )
  }
  return (
    <motion.form
      ref={formRef}
      action={action}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="cartao flex flex-col gap-3 p-5 sm:flex-row sm:items-end"
    >
      <div className="flex-1">
        <label htmlFor="nova-maq" className="rotulo">
          Nome da maquininha
        </label>
        <input id="nova-maq" name="nome" required maxLength={60} autoFocus placeholder="Ex.: InfinitePay" className="campo" />
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setAberto(false)}
          className="rounded-xl px-4 py-3 font-semibold text-cacau-suave hover:bg-creme-fundo"
        >
          Cancelar
        </button>
        <SubmitButton pendingLabel="Adicionando…">Adicionar</SubmitButton>
      </div>
    </motion.form>
  )
}
