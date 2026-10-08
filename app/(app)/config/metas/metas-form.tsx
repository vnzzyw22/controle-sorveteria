'use client'

import { useActionState, useEffect, useRef, useState } from 'react'
import { MoneyInput, SubmitButton } from '@/components/ui'
import { useToast } from '@/components/toast'
import { nomeDoMes } from '@/lib/analise'
import { saveMetas } from '@/lib/actions'
import { formatBRL } from '@/lib/money'

const MESES = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0'))

export function MetasForm({
  ano,
  metas,
  vendas,
  mesAtual,
}: {
  ano: number
  metas: { mes: string; valorCentavos: number }[]
  vendas: Record<string, number>
  mesAtual: string
}) {
  const [state, action] = useActionState(saveMetas, null)
  const toast = useToast()
  const lastAt = useRef<number | undefined>(undefined)

  // O que está digitado em cada mês (0 = em branco). Começa com as metas já salvas deste ano.
  const [valores, setValores] = useState<Record<string, number>>(() =>
    Object.fromEntries(MESES.map((m) => [`${ano}-${m}`, metas.find((x) => x.mes === `${ano}-${m}`)?.valorCentavos ?? 0])),
  )

  useEffect(() => {
    if (!state?.at || state.at === lastAt.current) return
    lastAt.current = state.at
    toast({ tone: state.ok ? 'sucesso' : 'erro', message: state.message })
  }, [state, toast])

  // Meta que vale em cada mês: a própria, ou a mais recente antes dele (inclusive de anos anteriores).
  const anteriores = metas.filter((x) => x.mes < `${ano}-01`)
  let corrente = anteriores.length ? { valor: anteriores[anteriores.length - 1].valorCentavos, de: anteriores[anteriores.length - 1].mes } : null
  const efetiva: Record<string, { valor: number; de: string } | null> = {}
  for (const m of MESES) {
    const mes = `${ano}-${m}`
    if (valores[mes] > 0) corrente = { valor: valores[mes], de: mes }
    efetiva[mes] = corrente
  }

  return (
    <form action={action} className="cartao p-4 sm:p-6">
      <input type="hidden" name="ano" value={ano} />
      <ul className="divide-y divide-linha">
        {MESES.map((m) => {
          const mes = `${ano}-${m}`
          const nome = nomeDoMes(mes)
          const ehAtual = mes === mesAtual
          const futuro = mes > mesAtual
          const vendido = vendas[mes] ?? 0
          const vale = efetiva[mes]
          const pct = vale && vendido > 0 ? Math.round((vendido / vale.valor) * 100) : null
          return (
            <li key={mes} className="grid grid-cols-1 gap-2 py-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,16rem)] sm:items-start sm:gap-6">
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-2 font-semibold capitalize">
                  {nome}
                  {ehAtual && (
                    <span className="rounded-full bg-framboesa-clara px-2.5 py-0.5 text-xs font-semibold normal-case text-framboesa-escura">
                      mês atual
                    </span>
                  )}
                </p>
                {!futuro && (
                  <p className="tabular mt-0.5 text-sm text-cacau-suave">
                    {vendido > 0
                      ? `Vendeu ${formatBRL(vendido)}${pct !== null ? ` (${pct}% da meta)` : ''}`
                      : 'Sem vendas lançadas'}
                  </p>
                )}
              </div>
              <div>
                <label htmlFor={`meta-${mes}`} className="sr-only">
                  Meta de {nome} de {ano}
                </label>
                <MoneyInput id={`meta-${mes}`} name={`meta_${mes}`} value={valores[mes]} onChange={(v) => setValores((s) => ({ ...s, [mes]: v }))} />
                <p className="mt-1 text-xs text-cacau-suave">
                  {valores[mes] > 0
                    ? 'Meta própria deste mês.'
                    : vale
                      ? `Em branco: vale ${formatBRL(vale.valor)} (de ${nomeDoMes(vale.de)}${vale.de.slice(0, 4) !== String(ano) ? ` de ${vale.de.slice(0, 4)}` : ''}).`
                      : 'Em branco: sem meta neste mês.'}
                </p>
              </div>
            </li>
          )
        })}
      </ul>
      <div className="mt-4 flex flex-col gap-3 border-t border-linha pt-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-cacau-suave">Para tirar uma meta, apague o valor do mês e salve.</p>
        <SubmitButton pendingLabel="Salvando…">Salvar metas de {ano}</SubmitButton>
      </div>
    </form>
  )
}
