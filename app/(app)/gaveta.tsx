'use client'

import { motion } from 'framer-motion'
import { CheckCircle2, Wallet } from 'lucide-react'
import { useActionState, useState } from 'react'
import { ConfirmButton, MoneyInput, SubmitButton } from '@/components/ui'
import { useToast } from '@/components/toast'
import { abrirGaveta, fecharGaveta, reabrirGaveta, type ActionResult } from '@/lib/actions'
import type { Gaveta } from '@/lib/data'
import { formatBRL } from '@/lib/money'

/**
 * Ação com aviso: o formulário de abrir/fechar some assim que o caixa muda de estado,
 * então o aviso é mostrado dentro da própria ação, antes de a tela trocar.
 */
function useAcaoComAviso(acao: (prev: ActionResult | null, fd: FormData) => Promise<ActionResult>) {
  const toast = useToast()
  return useActionState(async (prev: ActionResult | null, fd: FormData) => {
    const r = await acao(prev, fd)
    toast({ tone: r.ok ? 'sucesso' : 'erro', message: r.message })
    return r
  }, null)
}

/** Fechamento de caixa da gaveta: troco na abertura, contagem no fim do dia e a diferença. */
export function GavetaCartao({ gaveta, data, ehHoje }: { gaveta: Gaveta | null; data: string; ehHoje: boolean }) {
  if (!gaveta) return ehHoje ? <AbrirGaveta data={data} /> : null
  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      aria-labelledby="gaveta-titulo"
      className="cartao mb-5 p-5"
    >
      <div className="flex items-center gap-3">
        <span className="grid size-10 place-items-center rounded-full bg-dinheiro-fundo text-dinheiro">
          <Wallet aria-hidden className="size-5" />
        </span>
        <h2 id="gaveta-titulo" className="font-display text-lg font-bold">
          {gaveta.aberta ? 'Caixa aberto' : 'Caixa fechado'}
        </h2>
      </div>

      <dl className="mt-4 grid gap-x-8 gap-y-1.5 text-sm sm:grid-cols-2">
        <Linha rotulo="Troco da abertura" valor={formatBRL(gaveta.aberturaCentavos)} />
        <Linha rotulo="+ vendas em dinheiro" valor={formatBRL(gaveta.vendasDinheiroCentavos)} tom="text-entrada" />
        <Linha rotulo="− pagamentos em dinheiro" valor={formatBRL(gaveta.saidasDinheiroCentavos)} tom="text-saida" />
        <Linha rotulo="Deveria ter na gaveta" valor={formatBRL(gaveta.esperadoCentavos)} forte />
      </dl>

      {gaveta.aberta ? <FecharGaveta data={data} /> : <Resultado gaveta={gaveta} data={data} />}
    </motion.section>
  )
}

function Linha({ rotulo, valor, tom, forte }: { rotulo: string; valor: string; tom?: string; forte?: boolean }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className={forte ? 'font-semibold' : 'text-cacau-suave'}>{rotulo}</dt>
      <dd className={`tabular ${forte ? 'font-bold' : ''} ${tom ?? ''}`}>{valor}</dd>
    </div>
  )
}

function AbrirGaveta({ data }: { data: string }) {
  const [, action] = useAcaoComAviso(abrirGaveta)
  const [troco, setTroco] = useState(0)
  return (
    <section aria-labelledby="abrir-titulo" className="cartao mb-5 p-5">
      <h2 id="abrir-titulo" className="flex items-center gap-2 font-display text-lg font-bold">
        <Wallet aria-hidden className="size-5 text-dinheiro" />
        Abrir o caixa
      </h2>
      <p className="mt-1 text-sm text-cacau-suave">
        Quanto tem de troco na gaveta agora? No fim do dia você conta e o site mostra se sobrou ou faltou.
      </p>
      <form action={action} className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end">
        <input type="hidden" name="data" value={data} />
        <div className="sm:w-56">
          <label htmlFor="troco" className="rotulo">
            Troco na gaveta
          </label>
          <MoneyInput id="troco" name="valor" value={troco} onChange={setTroco} />
        </div>
        <SubmitButton pendingLabel="Abrindo…" className="py-2.5!">
          Abrir caixa
        </SubmitButton>
      </form>
    </section>
  )
}

function FecharGaveta({ data }: { data: string }) {
  const [, action] = useAcaoComAviso(fecharGaveta)
  const [contado, setContado] = useState(0)
  const [mexeu, setMexeu] = useState(false)
  return (
    <form action={action} className="mt-4 flex flex-col gap-3 border-t border-linha pt-4 sm:flex-row sm:items-end">
      <input type="hidden" name="data" value={data} />
      <div className="sm:w-56">
        <label htmlFor="contado" className="rotulo">
          Contei na gaveta
        </label>
        <MoneyInput
          id="contado"
          name="valor"
          value={contado}
          onChange={(v) => {
            setContado(v)
            setMexeu(true)
          }}
        />
      </div>
      <SubmitButton pendingLabel="Fechando…" disabled={!mexeu} className="py-2.5!">
        Fechar caixa
      </SubmitButton>
    </form>
  )
}

function Resultado({ gaveta, data }: { gaveta: Gaveta; data: string }) {
  const toast = useToast()
  const dif = gaveta.diferencaCentavos ?? 0
  const texto = dif === 0 ? 'Bateu certinho' : dif > 0 ? `Sobrou ${formatBRL(dif)}` : `Faltou ${formatBRL(-dif)}`
  const tom = dif === 0 ? 'bg-dinheiro-fundo text-dinheiro' : dif > 0 ? 'bg-alerta-fundo text-alerta' : 'bg-saida/10 text-saida'
  return (
    <div className="mt-4 flex flex-col gap-3 border-t border-linha pt-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <span>
          Contado: <strong className="tabular">{formatBRL(gaveta.contadoCentavos ?? 0)}</strong>
        </span>
        <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-semibold ${tom}`}>
          {dif === 0 && <CheckCircle2 aria-hidden className="size-4" />}
          {texto}
        </span>
      </div>
      <ConfirmButton
        label="Reabrir caixa"
        confirmLabel="Toque de novo para reabrir"
        onConfirm={async () => {
          const r = await reabrirGaveta(data)
          toast({ tone: r.ok ? 'sucesso' : 'erro', message: r.message })
        }}
      />
    </div>
  )
}
