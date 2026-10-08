'use client'

import { AnimatePresence, motion } from 'framer-motion'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useActionState, useEffect, useRef, useState } from 'react'
import { MoneyInput, Segmented, SubmitButton } from '@/components/ui'
import { useToast } from '@/components/toast'
import { createSaida, deleteSaida, updateSaida } from '@/lib/actions'
import { chaveCategoria } from '@/lib/categorias'
import type { Saida } from '@/lib/data'
import { addMonths, formatData } from '@/lib/dates'
import { FORMAS_SAIDA, FORMA_LABEL, MAX_PARCELAS_SAIDA, dividirParcelas, formatBRL, type FormaSaida } from '@/lib/money'

type Condicao = 'a_vista' | 'parcelado'

export function SaidaForm({
  hoje,
  categorias,
  edicao,
}: {
  hoje: string
  categorias: string[]
  /** Presente na tela de editar: a saída a mudar e para onde voltar depois de salvar. */
  edicao?: { saida: Saida; voltar: string }
}) {
  const [state, action] = useActionState(edicao ? updateSaida : createSaida, null)
  const toast = useToast()
  const router = useRouter()
  const descricaoRef = useRef<HTMLInputElement>(null)
  const original = edicao?.saida
  // Com parcelas já pagas, valor, número de parcelas e vencimento ficam travados (só o texto pode mudar).
  const travada = !!original && original.condicao === 'parcelado' && original.parcelas.some((p) => p.pagoEm)

  const [descricao, setDescricao] = useState(original?.descricao ?? '')
  const [categoria, setCategoria] = useState(original?.categoria ?? '')
  const [fornecedor, setFornecedor] = useState(original?.fornecedor ?? '')
  const [valor, setValor] = useState(original?.totalCentavos ?? 0)
  const [forma, setForma] = useState<FormaSaida>(original?.forma ?? 'pix')
  const [condicao, setCondicao] = useState<Condicao>(original?.condicao ?? 'a_vista')
  const [parcelas, setParcelas] = useState(original && original.numParcelas > 1 ? original.numParcelas : 2)
  const [data, setData] = useState(original?.data ?? hoje)
  // undefined = segue o padrão (à vista: data da compra; parcelado: um mês depois)
  const [primeiro, setPrimeiro] = useState<string | undefined>(original?.parcelas[0]?.vencimento)

  const n = condicao === 'parcelado' ? parcelas : 1
  const primeiroVenc = primeiro ?? (condicao === 'parcelado' ? addMonths(data, 1) : data)
  const preview =
    valor >= n
      ? dividirParcelas(valor, n).map((v, i) => ({ numero: i + 1, valor: v, vencimento: addMonths(primeiroVenc, i) }))
      : []

  const lastAt = useRef<number | undefined>(undefined)
  useEffect(() => {
    if (!state?.at || state.at === lastAt.current) return
    lastAt.current = state.at
    if (!state.ok) return
    if (edicao) {
      toast({ tone: 'sucesso', message: state.message })
      router.push(edicao.voltar)
      return
    }
    const id = state.id
    toast({
      tone: 'sucesso',
      message: state.message,
      action: id
        ? {
            label: 'Desfazer',
            onClick: async () => {
              const r = await deleteSaida(id)
              toast({ tone: r.ok ? 'sucesso' : 'erro', message: r.ok ? 'Saída desfeita.' : r.message })
            },
          }
        : undefined,
    })
    setDescricao('')
    setFornecedor('')
    setValor(0)
    setCondicao('a_vista')
    setPrimeiro(undefined)
    descricaoRef.current?.focus()
  }, [state, toast, edicao, router])

  const erro = state && !state.ok ? state : null

  return (
    <form action={action} className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
      {edicao && <input type="hidden" name="id" value={edicao.saida.id} />}
      <div className="cartao space-y-6 p-5 sm:p-7">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label htmlFor="descricao" className="rotulo">
              O que foi pago?
            </label>
            <input
              ref={descricaoRef}
              id="descricao"
              name="descricao"
              required
              maxLength={200}
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Ex.: Leite condensado (caixa com 27)"
              className="campo"
              autoFocus={!edicao}
            />
          </div>
          <div className="sm:col-span-2">
            <p id="categoria-titulo" className="rotulo">
              Categoria <span className="font-normal text-cacau-suave">(mostra no Resumo para onde vai o dinheiro)</span>
            </p>
            <div role="group" aria-labelledby="categoria-titulo" className="flex flex-wrap gap-2">
              {categorias.map((c) => {
                const escolhida = chaveCategoria(c) === chaveCategoria(categoria)
                return (
                  <button
                    key={c}
                    type="button"
                    aria-pressed={escolhida}
                    onClick={() => setCategoria(escolhida ? '' : c)}
                    className={`min-h-10 rounded-lg border px-3 text-sm font-medium transition-colors ${
                      escolhida
                        ? 'border-framboesa bg-framboesa-clara text-framboesa-escura'
                        : 'border-linha bg-superficie text-cacau hover:border-borda'
                    }`}
                  >
                    {c}
                  </button>
                )
              })}
            </div>
          </div>
          <div>
            <label htmlFor="categoria" className="rotulo">
              Outra categoria
            </label>
            <input
              id="categoria"
              name="categoria"
              maxLength={60}
              value={categoria}
              onChange={(e) => setCategoria(e.target.value)}
              placeholder="Escolha acima ou digite aqui"
              className="campo"
            />
          </div>
          <div>
            <label htmlFor="fornecedor" className="rotulo">
              Fornecedor <span className="font-normal text-cacau-suave">(opcional)</span>
            </label>
            <input
              id="fornecedor"
              name="fornecedor"
              maxLength={120}
              value={fornecedor}
              onChange={(e) => setFornecedor(e.target.value)}
              className="campo"
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="valor" className="rotulo">
              Valor total
            </label>
            {travada ? (
              <>
                <input type="hidden" name="valor" value={valor} />
                <p className="campo tabular bg-creme-fundo text-right">{formatBRL(valor)}</p>
              </>
            ) : (
              <MoneyInput id="valor" name="valor" value={valor} onChange={setValor} />
            )}
          </div>
          <div>
            <label htmlFor="data" className="rotulo">
              Data da compra
            </label>
            <input
              id="data"
              name="data"
              type="date"
              required
              value={data}
              onChange={(e) => setData(e.target.value || hoje)}
              className="campo"
            />
          </div>
        </div>

        <Segmented
          name="forma"
          legend="Forma de pagamento"
          layoutId="forma-saida"
          value={forma}
          onChange={setForma}
          columns="grid-cols-3 sm:grid-cols-5"
          options={FORMAS_SAIDA.map((f) => ({ value: f, label: FORMA_LABEL[f] }))}
        />

        {travada && (
          <p className="rounded-xl bg-alerta-fundo p-3.5 text-sm text-alerta">
            Esta saída já tem parcelas pagas, então valor, número de parcelas e vencimento ficam travados. Para mudar, desfaça os
            pagamentos antes (Histórico, aba Contas a pagar).
          </p>
        )}
        {travada ? <input type="hidden" name="condicao" value={condicao} /> : (
          <Segmented
            name="condicao"
            legend="Condição"
            layoutId="condicao-saida"
            value={condicao}
            onChange={(c) => {
              setCondicao(c)
              setPrimeiro(undefined)
            }}
            options={[
              { value: 'a_vista', label: 'À vista' },
              { value: 'parcelado', label: 'Parcelado' },
            ]}
          />
        )}

        {travada ? (
          <>
            <input type="hidden" name="parcelas" value={parcelas} />
            <input type="hidden" name="primeiro_vencimento" value={primeiroVenc} />
          </>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            <AnimatePresence initial={false}>
              {condicao === 'parcelado' && (
                <motion.div
                  key="parcelas"
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.2 }}
                >
                  <label htmlFor="parcelas" className="rotulo">
                    Número de parcelas
                  </label>
                  <select
                    id="parcelas"
                    name="parcelas"
                    value={parcelas}
                    onChange={(e) => setParcelas(Number(e.target.value))}
                    className="campo tabular"
                  >
                    {Array.from({ length: MAX_PARCELAS_SAIDA - 1 }, (_, i) => i + 2).map((k) => (
                      <option key={k} value={k}>
                        {k}x {valor >= k ? `de ${formatBRL(Math.round(valor / k))}` : ''}
                      </option>
                    ))}
                  </select>
                </motion.div>
              )}
            </AnimatePresence>
            <div>
              <label htmlFor="primeiro_vencimento" className="rotulo">
                {condicao === 'parcelado' ? '1º vencimento' : 'Vencimento'}
              </label>
              <input
                id="primeiro_vencimento"
                name="primeiro_vencimento"
                type="date"
                required
                value={primeiroVenc}
                onChange={(e) => setPrimeiro(e.target.value || undefined)}
                className="campo"
              />
            </div>
          </div>
        )}

        {erro && (
          <p key={erro.at} role="alert" className="rounded-xl bg-saida/10 p-3.5 text-sm font-medium text-saida">
            {erro.message}
          </p>
        )}

        <SubmitButton
          pendingLabel={edicao ? 'Salvando…' : 'Lançando…'}
          disabled={!valor || !descricao.trim()}
          className="w-full py-4 text-lg"
        >
          {edicao ? 'Salvar alterações' : `Lançar saída ${valor ? `de ${formatBRL(valor)}` : ''}`}
        </SubmitButton>
        {edicao && (
          <Link href={edicao.voltar} className="block text-center text-sm font-semibold text-cacau-suave hover:text-cacau">
            Cancelar e voltar
          </Link>
        )}
      </div>

      <aside aria-labelledby="parcelas-titulo" className="cartao h-fit p-5 lg:sticky lg:top-6">
        <h2 id="parcelas-titulo" className="font-display text-lg font-bold">
          {n > 1 ? `${n} parcelas` : 'Pagamento'}
        </h2>
        <p className="text-sm text-cacau-suave">
          {n > 1 ? 'Cada parcela entra como saída no dia do vencimento.' : 'Sai do caixa na data do vencimento.'}
        </p>
        {preview.length === 0 ? (
          <p className="mt-4 rounded-xl bg-creme-fundo p-4 text-sm text-cacau-suave">Digite o valor para ver as parcelas.</p>
        ) : (
          <ol className="mt-4 max-h-[420px] space-y-1.5 overflow-y-auto pr-1">
            <AnimatePresence initial={false}>
              {preview.map((p) => (
                <motion.li
                  key={p.numero}
                  layout
                  initial={{ opacity: 0, x: 12 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -12, transition: { duration: 0.12 } }}
                  transition={{ duration: 0.2, delay: Math.min(p.numero, 8) * 0.025 }}
                  className="flex items-center justify-between rounded-xl bg-creme-fundo px-3.5 py-2.5 text-sm"
                >
                  <span>
                    <span className="font-semibold">{n > 1 ? `${p.numero}/${n}` : 'Única'}</span>
                    <span className="ml-2 text-cacau-suave">{formatData(p.vencimento)}</span>
                  </span>
                  <span className="tabular font-semibold">{formatBRL(p.valor)}</span>
                </motion.li>
              ))}
            </AnimatePresence>
          </ol>
        )}
      </aside>
    </form>
  )
}
