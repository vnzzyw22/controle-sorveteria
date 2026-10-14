'use client'

import { useActionState, useEffect, useRef, useState } from 'react'
import { MoneyInput, SubmitButton } from '@/components/ui'
import { useToast } from '@/components/toast'
import { salvarSaldoInicial } from '@/lib/actions'
import { CONTAS, CONTA_LABEL, type Conta } from '@/lib/contas'
import { formatData } from '@/lib/dates'
import { formatBRL } from '@/lib/money'

type Atual = { valorCentavos: number; data: string } | null

export function SaldoForm({ hoje, atual }: { hoje: string; atual: Record<Conta, Atual> }) {
  return (
    <section id="saldo" aria-labelledby="saldo-titulo" className="cartao scroll-mt-6 p-5">
      <h2 id="saldo-titulo" className="font-display text-lg font-bold">
        Saldo da empresa
      </h2>
      <p className="mt-1 text-sm text-cacau-suave">
        Quanto tem agora em cada lugar. É o ponto de partida do saldo que aparece no Caixa: tudo o que for lançado{' '}
        <strong>depois de salvar</strong> entra na conta sozinho. Vendas e pagamentos em dinheiro mexem no dinheiro em
        espécie; Pix, cartão e boleto mexem no banco. Não conta como venda e não mexe no resumo.
      </p>
      <div className="mt-4 divide-y divide-linha">
        {CONTAS.map((c) => (
          <SaldoContaForm key={c} conta={c} hoje={hoje} atual={atual[c]} />
        ))}
      </div>
    </section>
  )
}

function SaldoContaForm({ conta, hoje, atual }: { conta: Conta; hoje: string; atual: Atual }) {
  const [state, action] = useActionState(salvarSaldoInicial, null)
  const toast = useToast()
  const [valor, setValor] = useState(atual?.valorCentavos ?? 0)
  // O saldo novo é "quanto tem agora": a data começa sempre em hoje.
  const [data, setData] = useState(hoje)
  const lastAt = useRef<number | undefined>(undefined)

  useEffect(() => {
    if (!state?.at || state.at === lastAt.current) return
    lastAt.current = state.at
    toast({ tone: state.ok ? 'sucesso' : 'erro', message: state.message })
  }, [state, toast])

  return (
    <form action={action} className="py-4 first:pt-0 last:pb-0">
      <input type="hidden" name="conta" value={conta} />
      <h3 className="font-semibold">{CONTA_LABEL[conta]}</h3>
      <p className="text-xs text-cacau-suave">
        {atual ? `Salvo: ${formatBRL(atual.valorCentavos)} em ${formatData(atual.data)}.` : 'Ainda não informado.'}
      </p>
      <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="sm:w-56">
          <label htmlFor={`saldo-valor-${conta}`} className="rotulo">
            Valor
          </label>
          <MoneyInput id={`saldo-valor-${conta}`} name="valor" value={valor} onChange={setValor} />
        </div>
        <div className="sm:w-48">
          <label htmlFor={`saldo-data-${conta}`} className="rotulo">
            Data do saldo
          </label>
          <input
            id={`saldo-data-${conta}`}
            name="data"
            type="date"
            required
            max={hoje}
            value={data}
            onChange={(e) => setData(e.target.value || hoje)}
            className="campo"
          />
        </div>
        <SubmitButton pendingLabel="Salvando…" className="py-2.5!">
          Salvar
        </SubmitButton>
      </div>
    </form>
  )
}
