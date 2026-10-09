'use client'

import { useActionState, useEffect, useRef, useState } from 'react'
import { MoneyInput, SubmitButton } from '@/components/ui'
import { useToast } from '@/components/toast'
import { salvarSaldoInicial } from '@/lib/actions'
import { formatData } from '@/lib/dates'
import { formatBRL } from '@/lib/money'

export function SaldoForm({ hoje, atual }: { hoje: string; atual: { valorCentavos: number; data: string } | null }) {
  const [state, action] = useActionState(salvarSaldoInicial, null)
  const toast = useToast()
  const [valor, setValor] = useState(atual?.valorCentavos ?? 0)
  const [data, setData] = useState(atual?.data ?? hoje)
  const lastAt = useRef<number | undefined>(undefined)

  useEffect(() => {
    if (!state?.at || state.at === lastAt.current) return
    lastAt.current = state.at
    toast({ tone: state.ok ? 'sucesso' : 'erro', message: state.message })
  }, [state, toast])

  return (
    <section id="saldo" aria-labelledby="saldo-titulo" className="cartao scroll-mt-6 p-5">
      <h2 id="saldo-titulo" className="font-display text-lg font-bold">
        Saldo da empresa
      </h2>
      <p className="mt-1 text-sm text-cacau-suave">
        Quanto a empresa tem agora (caixa + conta). É o ponto de partida do saldo que aparece no Caixa: tudo o que for
        lançado <strong>depois de salvar</strong> (vendas e pagamentos, inclusive no mesmo dia) entra na conta sozinho.
        Não conta como venda e não mexe no resumo.
        {atual && ` Atual: ${formatBRL(atual.valorCentavos)} em ${formatData(atual.data)}.`}
      </p>
      <form action={action} className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="sm:w-56">
          <label htmlFor="saldo-valor" className="rotulo">
            Valor
          </label>
          <MoneyInput id="saldo-valor" name="valor" value={valor} onChange={setValor} />
        </div>
        <div className="sm:w-48">
          <label htmlFor="saldo-data" className="rotulo">
            Data do saldo
          </label>
          <input
            id="saldo-data"
            name="data"
            type="date"
            required
            max={hoje}
            value={data}
            onChange={(e) => setData(e.target.value || hoje)}
            className="campo"
          />
        </div>
        <SubmitButton pendingLabel="Salvando…" disabled={!valor} className="py-2.5!">
          Salvar saldo
        </SubmitButton>
      </form>
    </section>
  )
}
