'use client'

import { useActionState, useEffect, useRef, useState } from 'react'
import { MoneyInput, SubmitButton } from '@/components/ui'
import { useToast } from '@/components/toast'
import { nomeDoMes } from '@/lib/analise'
import { saveMeta } from '@/lib/actions'
import { formatBRL } from '@/lib/money'

export function MetaForm({ mes, metaCentavos, desde }: { mes: string; metaCentavos: number | null; desde: string | null }) {
  const [state, action] = useActionState(saveMeta, null)
  const toast = useToast()
  const [valor, setValor] = useState(metaCentavos ?? 0)
  const lastAt = useRef<number | undefined>(undefined)

  useEffect(() => {
    if (!state?.at || state.at === lastAt.current) return
    lastAt.current = state.at
    toast({ tone: state.ok ? 'sucesso' : 'erro', message: state.message })
  }, [state, toast])

  const herdada = metaCentavos !== null && desde !== null && desde !== mes

  return (
    <section id="meta" aria-labelledby="meta-config-titulo" className="cartao scroll-mt-6 p-5">
      <h2 id="meta-config-titulo" className="font-display text-lg font-bold">
        Meta de vendas de {nomeDoMes(mes)}
      </h2>
      <p className="mt-1 text-sm text-cacau-suave">
        Quanto a loja quer vender no mês (valor bruto, antes das taxas). A meta vale também para os meses seguintes, até
        você mudar.
        {herdada && ` A atual (${formatBRL(metaCentavos)}) vem de ${nomeDoMes(desde)}.`}
      </p>
      <form action={action} className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="sm:w-64">
          <label htmlFor="meta-valor" className="rotulo">
            Meta do mês
          </label>
          <MoneyInput id="meta-valor" name="valor" value={valor} onChange={setValor} />
        </div>
        <SubmitButton pendingLabel="Salvando…" disabled={!valor || (valor === metaCentavos && !herdada)} className="py-2.5!">
          Salvar meta
        </SubmitButton>
      </form>
    </section>
  )
}
