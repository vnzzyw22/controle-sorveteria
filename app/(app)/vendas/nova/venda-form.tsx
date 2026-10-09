'use client'

import { AnimatePresence, motion } from 'framer-motion'
import { AlertTriangle, Banknote, CreditCard, Pencil, QrCode, Wallet } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useActionState, useEffect, useRef, useState } from 'react'
import { AnimatedBRL, FormaBadge, MoneyInput, Segmented, SubmitButton } from '@/components/ui'
import { useToast } from '@/components/toast'
import { PRAZO_PADRAO } from '@/lib/taxas'
import { createEntrada, deleteEntrada, updateEntrada } from '@/lib/actions'
import type { Entrada, Maquininha, Taxa, Totais } from '@/lib/data'
import { addDays, formatData, formatDataCurta, formatHora } from '@/lib/dates'
import { FORMA_LABEL, MAX_PARCELAS_CREDITO, calcularTaxa, formatBRL, type FormaEntrada } from '@/lib/money'
import { linkEditarVenda } from '@/lib/voltar'
import { PRODUTOS, nomeProduto, produtoPeloValor, type ProdutoId } from '@/lib/produtos'
import { CobrancaMaquininha } from './cobranca-maquininha'
import { BuscarVendasBotao } from '@/components/buscar-vendas-botao'

const ULTIMA_MAQ = 'sorveteria:ultima-maquininha'

const FORMAS: { value: FormaEntrada; label: string; icon: typeof Banknote; tone: string }[] = [
  { value: 'dinheiro', label: 'Dinheiro', icon: Banknote, tone: 'text-dinheiro' },
  { value: 'pix', label: 'Pix', icon: QrCode, tone: 'text-pix' },
  { value: 'debito', label: 'Débito', icon: Wallet, tone: 'text-debito' },
  { value: 'credito', label: 'Crédito', icon: CreditCard, tone: 'text-credito' },
]

export function VendaForm({
  hoje,
  maquininhas,
  taxas,
  recentes,
  totalHoje,
  edicao,
  maquininhaMP = false,
}: {
  hoje: string
  maquininhas: Maquininha[]
  taxas: Taxa[]
  recentes: Entrada[]
  totalHoje: Totais
  /** Presente na tela de editar: a venda a mudar e para onde voltar depois de salvar. */
  edicao?: { entrada: Entrada; voltar: string }
  /** Integração com a maquininha Mercado Pago configurada (token presente). */
  maquininhaMP?: boolean
}) {
  const [state, action] = useActionState(edicao ? updateEntrada : createEntrada, null)
  const toast = useToast()
  const router = useRouter()
  const valorRef = useRef<HTMLInputElement>(null)
  const original = edicao?.entrada

  const [valor, setValor] = useState(original?.brutoCentavos ?? 0)
  const [forma, setForma] = useState<FormaEntrada>(original?.forma ?? 'debito')
  const [maquininha, setMaquininha] = useState<string>(
    original ? String(original.maquininhaId ?? '') : maquininhas[0] ? String(maquininhas[0].id) : '',
  )
  const [parcelas, setParcelas] = useState(original?.parcelas ?? 1)
  const [data, setData] = useState(original?.data ?? hoje)
  const [descricao, setDescricao] = useState(original?.descricao ?? '')
  // Produto: segue o valor (preço fixo ou self-service) até alguém escolher outro na mão.
  const [produto, setProduto] = useState<ProdutoId>(original?.produto ?? 'self_service')
  const [produtoManual, setProdutoManual] = useState(
    original ? original.produto !== produtoPeloValor(original.brutoCentavos) : false,
  )

  function mudarValor(centavos: number) {
    setValor(centavos)
    if (!produtoManual) setProduto(produtoPeloValor(centavos))
  }

  function escolherProduto(id: ProdutoId) {
    const p = PRODUTOS.find((x) => x.id === id)
    setProduto(id)
    if (p?.precoCentavos != null) {
      setValor(p.precoCentavos)
      setProdutoManual(false)
    } else {
      setProdutoManual(true)
      valorRef.current?.focus()
    }
  }

  // Lembra a última maquininha usada neste aparelho.
  useEffect(() => {
    if (original) return
    try {
      const saved = localStorage.getItem(ULTIMA_MAQ)
      if (saved && maquininhas.some((m) => String(m.id) === saved)) setMaquininha(saved)
    } catch {}
  }, [maquininhas, original])

  const precisaMaquininha = forma === 'debito' || forma === 'credito'
  const usaMaquininha = precisaMaquininha || (forma === 'pix' && maquininha !== '')
  const maqId = usaMaquininha ? Number(maquininha) : null
  const parcelasEfetivas = forma === 'credito' ? parcelas : 1
  const taxa = maqId
    ? taxas.find((t) => t.maquininhaId === maqId && t.forma === forma && t.parcelas === parcelasEfetivas)
    : undefined
  // Ao editar sem mudar a forma de pagamento, vale a taxa que estava gravada na venda (igual ao servidor).
  const mantemTaxa =
    !!original && original.forma === forma && original.maquininhaId === maqId && original.parcelas === parcelasEfetivas
  const taxaFaltando = usaMaquininha && !taxa && !mantemTaxa
  const percentual = mantemTaxa ? original.taxaPercentual : (taxa?.percentual ?? 0)
  const { taxaCentavos, liquidoCentavos } = calcularTaxa(valor, percentual)
  const prazoPadrao = forma === 'dinheiro' ? 0 : PRAZO_PADRAO[forma]
  const prazoOriginal = original ? Math.round((Date.parse(original.dataRecebimento) - Date.parse(original.data)) / 86_400_000) : 0
  const recebimento = addDays(data, mantemTaxa ? prazoOriginal : usaMaquininha ? (taxa?.prazoDias ?? prazoPadrao) : 0)
  const maqNome = maquininhas.find((m) => m.id === maqId)?.nome

  function escolherForma(f: FormaEntrada) {
    setForma(f)
    if (f !== 'credito') setParcelas(1)
    if (f === 'pix') setMaquininha('')
    if ((f === 'debito' || f === 'credito') && !maquininha) {
      let saved: string | null = null
      try {
        saved = localStorage.getItem(ULTIMA_MAQ)
      } catch {}
      setMaquininha(saved && maquininhas.some((m) => String(m.id) === saved) ? saved : String(maquininhas[0]?.id ?? ''))
    }
  }

  function escolherMaquininha(id: string) {
    setMaquininha(id)
    try {
      if (id) localStorage.setItem(ULTIMA_MAQ, id)
    } catch {}
  }

  // Depois de salvar: avisa, oferece desfazer e deixa o formulário pronto para a próxima venda.
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
              const r = await deleteEntrada(id)
              toast({ tone: r.ok ? 'sucesso' : 'erro', message: r.ok ? 'Venda desfeita.' : r.message })
            },
          }
        : undefined,
    })
    setValor(0)
    setDescricao('')
    setProduto('self_service')
    setProdutoManual(false)
    valorRef.current?.focus()
  }, [state, toast, edicao, router])

  const erro = state && !state.ok ? state : null

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
      <form action={action} className="cartao space-y-6 p-5 sm:p-7">
        {edicao && <input type="hidden" name="id" value={edicao.entrada.id} />}
        <div>
          <label htmlFor="valor" className="rotulo">
            Valor da venda
          </label>
          <MoneyInput id="valor" name="valor" value={valor} onChange={mudarValor} large autoFocus={!edicao} inputRef={valorRef} />
        </div>

        <div>
          <Segmented
            name="produto"
            legend="O que foi vendido?"
            layoutId="produto-venda"
            value={produto}
            onChange={escolherProduto}
            columns="grid-cols-2 sm:grid-cols-4"
            options={PRODUTOS.map((p) => ({
              value: p.id,
              tone: 'text-framboesa',
              label: (
                <span className="flex flex-col py-1 leading-tight">
                  <span>{p.nome}</span>
                  <span className="tabular text-xs font-normal opacity-75">
                    {p.precoCentavos === null ? 'valor da balança' : formatBRL(p.precoCentavos)}
                  </span>
                </span>
              ),
            }))}
          />
          <p className="mt-1.5 text-xs text-cacau-suave">
            Escolhido sozinho pelo valor: {formatBRL(799)} é cascão de 1 bola, {formatBRL(1199)} é de 2 bolas, bebidas pelo
            preço e o resto é self-service. Toque para trocar.
          </p>
        </div>

        <Segmented
          name="forma"
          legend="Forma de pagamento"
          layoutId="forma-venda"
          value={forma}
          onChange={escolherForma}
          size="lg"
          columns="grid-cols-2 sm:grid-cols-4"
          options={FORMAS.map((f) => ({
            value: f.value,
            tone: f.tone,
            label: (
              <>
                <f.icon aria-hidden className="size-5" />
                {f.label}
              </>
            ),
          }))}
        />

        <AnimatePresence initial={false}>
          {forma !== 'dinheiro' && (
            <motion.div
              key="maquininha"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
              className="overflow-hidden"
            >
              {maquininhas.length === 0 ? (
                <p className="rounded-xl bg-alerta-fundo p-3.5 text-sm text-alerta">
                  Nenhuma maquininha ativa. <Link href="/config" className="font-semibold underline">Cadastre em Configurações</Link>.
                </p>
              ) : (
                <Segmented
                  name="maquininha"
                  legend={forma === 'pix' ? 'Recebido onde?' : 'Maquininha'}
                  layoutId="maquininha-venda"
                  value={maquininha}
                  onChange={escolherMaquininha}
                  columns={`grid-cols-2 ${forma === 'pix' ? 'sm:grid-cols-4' : 'sm:grid-cols-3'}`}
                  options={[
                    ...(forma === 'pix' ? [{ value: '', label: 'Direto na conta' }] : []),
                    ...maquininhas.map((m) => ({ value: String(m.id), label: m.nome })),
                  ]}
                />
              )}
            </motion.div>
          )}
        </AnimatePresence>
        {forma === 'dinheiro' && <input type="hidden" name="maquininha" value="" />}

        <AnimatePresence initial={false}>
          {forma === 'credito' && (
            <motion.div
              key="parcelas"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
              className="overflow-hidden"
            >
              <label htmlFor="parcelas" className="rotulo">
                Parcelas
              </label>
              <select
                id="parcelas"
                name="parcelas"
                value={parcelas}
                onChange={(e) => setParcelas(Number(e.target.value))}
                className="campo sm:max-w-48"
              >
                {Array.from({ length: MAX_PARCELAS_CREDITO }, (_, i) => i + 1).map((n) => (
                  <option key={n} value={n}>
                    {n === 1 ? 'À vista (1x)' : `${n}x de ${formatBRL(Math.round(valor / n))}`}
                  </option>
                ))}
              </select>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="grid gap-4 sm:grid-cols-[180px_1fr]">
          <div>
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
          <div>
            <label htmlFor="descricao" className="rotulo">
              Observação <span className="font-normal text-cacau-suave">(opcional)</span>
            </label>
            <input
              id="descricao"
              name="descricao"
              maxLength={200}
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Ex.: encomenda de açaí"
              className="campo"
            />
          </div>
        </div>

        {/* Resumo do cálculo: no celular aparece aqui, logo antes do botão */}
        <div className="lg:hidden">
          <Resumo
            valor={valor}
            percentual={percentual}
            taxaCentavos={taxaCentavos}
            liquidoCentavos={liquidoCentavos}
            recebimento={recebimento}
            hoje={hoje}
            usaMaquininha={usaMaquininha}
            maqNome={maqNome}
          />
        </div>

        <AnimatePresence>
          {taxaFaltando && (
            <motion.p
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="flex gap-2.5 rounded-xl bg-alerta-fundo p-3.5 text-sm text-alerta"
            >
              <AlertTriangle aria-hidden className="mt-0.5 size-4 shrink-0" />
              <span>
                A taxa de {forma === 'credito' ? `crédito ${parcelasEfetivas}x` : FORMA_LABEL[forma].toLowerCase()} da{' '}
                {maqNome} ainda não foi cadastrada. A venda será lançada sem desconto de taxa.{' '}
                <Link href="/config" className="font-semibold underline">
                  Cadastrar taxa
                </Link>
              </span>
            </motion.p>
          )}
        </AnimatePresence>

        {erro && (
          <p key={erro.at} role="alert" className="rounded-xl bg-saida/10 p-3.5 text-sm font-medium text-saida">
            {erro.message}
          </p>
        )}

        <SubmitButton pendingLabel={edicao ? 'Salvando…' : 'Lançando…'} disabled={!valor} className="w-full py-4 text-lg">
          {edicao ? 'Salvar alterações' : `Lançar venda ${valor ? `de ${formatBRL(valor)}` : ''}`}
        </SubmitButton>
        {maquininhaMP && !edicao && usaMaquininha && maqNome === 'Mercado Pago' && (
          <CobrancaMaquininha
            valor={valor}
            forma={forma}
            parcelas={parcelasEfetivas}
            onPaga={() => {
              setValor(0)
              setDescricao('')
            }}
          />
        )}
        {maquininhaMP && !edicao && <BuscarVendasBotao className="w-full" />}
        {edicao && (
          <Link href={edicao.voltar} className="block text-center text-sm font-semibold text-cacau-suave hover:text-cacau">
            Cancelar e voltar
          </Link>
        )}
      </form>

      <aside className="space-y-6">
        <div className="sticky top-6 hidden lg:block">
          <Resumo
            valor={valor}
            percentual={percentual}
            taxaCentavos={taxaCentavos}
            liquidoCentavos={liquidoCentavos}
            recebimento={recebimento}
            hoje={hoje}
            usaMaquininha={usaMaquininha}
            maqNome={maqNome}
          />
        </div>
        {original ? (
          <section className="cartao p-5 text-sm text-cacau-suave">
            <h2 className="font-display text-lg font-bold text-cacau">Venda #{original.id}</h2>
            <p className="mt-1">
              Lançada em {formatData(original.data)} às {formatHora(new Date(original.criadoEm))}.
            </p>
          </section>
        ) : (
          <Recentes recentes={recentes} totalHoje={totalHoje} hoje={hoje} />
        )}
      </aside>
    </div>
  )
}

function Resumo({
  valor,
  percentual,
  taxaCentavos,
  liquidoCentavos,
  recebimento,
  hoje,
  usaMaquininha,
  maqNome,
}: {
  valor: number
  percentual: number
  taxaCentavos: number
  liquidoCentavos: number
  recebimento: string
  hoje: string
  usaMaquininha: boolean
  maqNome?: string
}) {
  return (
    <section aria-label="Cálculo da venda" className="overflow-hidden rounded-2xl bg-cacau text-creme">
      <div className="p-5">
        <p className="text-sm text-creme/70">Você recebe (líquido)</p>
        <AnimatedBRL cents={liquidoCentavos} className="mt-1 block font-display text-4xl font-bold tracking-tight" />
        <p className="mt-2 text-sm text-creme/70">
          {recebimento === hoje ? 'Cai hoje' : `Cai em ${formatDataCurta(recebimento)}`}
          {usaMaquininha && maqNome ? ` · ${maqNome}` : ''}
        </p>
      </div>
      <dl className="grid grid-cols-2 gap-px bg-white/10 text-sm">
        <div className="bg-cacau p-4">
          <dt className="text-creme/70">Valor bruto</dt>
          <dd className="tabular mt-0.5 font-semibold">{formatBRL(valor)}</dd>
        </div>
        <div className="bg-cacau p-4">
          <dt className="text-creme/70">Taxa {percentual ? `(${percentual.toFixed(2).replace('.', ',')}%)` : ''}</dt>
          <dd className="tabular mt-0.5 font-semibold text-[#f4a5b9]">
            {taxaCentavos ? `− ${formatBRL(taxaCentavos)}` : formatBRL(0)}
          </dd>
        </div>
      </dl>
    </section>
  )
}

function Recentes({ recentes, totalHoje, hoje }: { recentes: Entrada[]; totalHoje: Totais; hoje: string }) {
  return (
    <section aria-labelledby="recentes-titulo" className="cartao p-5">
      <div className="flex items-baseline justify-between gap-2">
        <h2 id="recentes-titulo" className="font-display text-lg font-bold">
          Vendas de hoje
        </h2>
        <span className="tabular text-sm text-cacau-suave">
          {totalHoje.quantidade} · {formatBRL(totalHoje.brutoCentavos)}
        </span>
      </div>
      {recentes.length === 0 ? (
        <p className="mt-3 text-sm text-cacau-suave">Nenhuma venda lançada hoje ainda.</p>
      ) : (
        <ul className="mt-3 divide-y divide-linha">
          <AnimatePresence initial={false}>
            {recentes.map((v) => (
              <motion.li
                key={v.id}
                layout
                initial={{ opacity: 0, backgroundColor: 'rgba(163,22,74,0.08)' }}
                animate={{ opacity: 1, backgroundColor: 'rgba(163,22,74,0)' }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.6 }}
                className="flex items-center justify-between gap-3 py-2.5"
              >
                <span className="min-w-0">
                  <span className="mr-2 font-medium">{nomeProduto(v.produto)}</span>
                  <FormaBadge forma={v.forma} parcelas={v.parcelas} />
                  <span className="ml-2 text-xs text-cacau-suave">
                    {formatHora(new Date(v.criadoEm))}
                    {v.maquininhaNome ? ` · ${v.maquininhaNome}` : ''}
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-2">
                  <span className="tabular font-semibold">{formatBRL(v.brutoCentavos)}</span>
                  <Link
                    href={linkEditarVenda(v.id, '/vendas/nova')}
                    aria-label={`Editar venda de ${formatBRL(v.brutoCentavos)}`}
                    className="rounded-lg p-2 text-cacau-suave hover:bg-creme-fundo hover:text-framboesa"
                  >
                    <Pencil aria-hidden className="size-4" />
                  </Link>
                </span>
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      )}
      <Link href={`/historico?de=${hoje}&ate=${hoje}`} className="mt-3 inline-block text-sm font-semibold text-framboesa hover:underline">
        Ver tudo no histórico
      </Link>
    </section>
  )
}

