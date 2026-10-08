'use client'

import { AnimatePresence, motion } from 'framer-motion'
import { CheckCircle2, ChevronLeft, ChevronRight, Circle, Download, Search } from 'lucide-react'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useCallback, useState, useTransition } from 'react'
import { DetailList, Drawer } from '@/components/drawer'
import { BotaoEditar, ConfirmButton, FormaBadge, Segmented } from '@/components/ui'
import { useToast } from '@/components/toast'
import { deleteEntrada, deleteSaida, setParcelaPaga } from '@/lib/actions'
import type { Entrada, Maquininha, Parcela, Saida, Totais } from '@/lib/data'
import { addDays, addMonths, formatData, formatDataCurta, formatHora, inicioDoMes } from '@/lib/dates'
import type { FiltroContas, FiltroSaidas, FiltroVendas } from '@/lib/filters'
import { FORMAS_ENTRADA, FORMAS_SAIDA, FORMA_LABEL, formatBRL } from '@/lib/money'
import { linkEditarSaida, linkEditarVenda } from '@/lib/voltar'

// ---------- Navegação por filtros (tudo fica na URL: dá para atualizar, voltar e compartilhar) ----------

function useFiltros() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [pending, startTransition] = useTransition()

  const aplicar = useCallback(
    (updates: Record<string, string | number | null>) => {
      const next = new URLSearchParams(searchParams.toString())
      if (!('pagina' in updates)) next.delete('pagina')
      for (const [k, v] of Object.entries(updates)) {
        if (v === null || v === '' || (k === 'pagina' && v === 1)) next.delete(k)
        else next.set(k, String(v))
      }
      const qs = next.toString()
      startTransition(() => router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false }))
    },
    [router, pathname, searchParams],
  )

  return { aplicar, pending, query: searchParams.toString() }
}

// ---------- Abas ----------

const ABAS = [
  { id: 'vendas', label: 'Vendas' },
  { id: 'saidas', label: 'Saídas' },
  { id: 'contas', label: 'Contas a pagar' },
] as const

export function Abas({ aba }: { aba: (typeof ABAS)[number]['id'] }) {
  return (
    <nav aria-label="Tipo de lançamento" className="mb-5 border-b border-linha">
      <ul className="-mb-px flex gap-1 overflow-x-auto">
        {ABAS.map((a) => {
          const active = a.id === aba
          return (
            <li key={a.id}>
              <Link
                href={a.id === 'vendas' ? '/historico' : `/historico?aba=${a.id}`}
                aria-current={active ? 'page' : undefined}
                className={`relative block whitespace-nowrap px-3 py-3 text-sm sm:px-4 sm:text-[15px] font-semibold transition-colors ${
                  active ? 'text-framboesa' : 'text-cacau-suave hover:text-cacau'
                }`}
              >
                {a.label}
                {active && (
                  <motion.span
                    layoutId="aba-historico"
                    transition={{ type: 'spring', stiffness: 500, damping: 40 }}
                    className="absolute inset-x-2 bottom-0 h-[3px] rounded-t-full bg-framboesa"
                  />
                )}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}

// ---------- Peças comuns ----------

function presets(hoje: string) {
  const inicioMes = inicioDoMes(hoje)
  const inicioMesPassado = addMonths(inicioMes, -1)
  return [
    { label: 'Hoje', de: hoje, ate: hoje },
    { label: '7 dias', de: addDays(hoje, -6), ate: hoje },
    { label: 'Este mês', de: inicioMes, ate: hoje },
    { label: 'Mês passado', de: inicioMesPassado, ate: addDays(inicioMes, -1) },
    { label: '90 dias', de: addDays(hoje, -89), ate: hoje },
  ]
}

function Periodo({
  de,
  ate,
  hoje,
  aplicar,
}: {
  de: string
  ate: string
  hoje: string
  aplicar: (u: Record<string, string | null>) => void
}) {
  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Períodos rápidos">
        {presets(hoje).map((p) => {
          const active = p.de === de && p.ate === ate
          return (
            <button
              key={p.label}
              type="button"
              aria-pressed={active}
              onClick={() => aplicar({ de: p.de, ate: p.ate })}
              className={`rounded-full px-3.5 py-1.5 text-sm font-semibold transition-colors ${
                active
                  ? 'bg-cacau text-creme'
                  : 'border border-linha bg-superficie text-cacau-suave hover:border-borda hover:text-cacau'
              }`}
            >
              {p.label}
            </button>
          )
        })}
      </div>
      <div className="flex items-end gap-2 lg:ml-auto">
        <div className="min-w-0 flex-1">
          <label htmlFor="f-de" className="mb-1 block text-xs font-medium text-cacau-suave">
            De
          </label>
          <input
            id="f-de"
            type="date"
            value={de}
            max={ate}
            onChange={(e) => e.target.value && aplicar({ de: e.target.value })}
            className="campo min-w-0 py-2! text-sm"
          />
        </div>
        <div className="min-w-0 flex-1">
          <label htmlFor="f-ate" className="mb-1 block text-xs font-medium text-cacau-suave">
            Até
          </label>
          <input
            id="f-ate"
            type="date"
            value={ate}
            min={de}
            onChange={(e) => e.target.value && aplicar({ ate: e.target.value })}
            className="campo min-w-0 py-2! text-sm"
          />
        </div>
      </div>
    </div>
  )
}

function Busca({
  inicial,
  placeholder,
  aplicar,
}: {
  inicial: string
  placeholder: string
  aplicar: (u: Record<string, string | null>) => void
}) {
  const [q, setQ] = useState(inicial)
  return (
    <form
      role="search"
      onSubmit={(e) => {
        e.preventDefault()
        aplicar({ q: q.trim() || null })
      }}
      className="relative flex-1"
    >
      <label htmlFor="f-q" className="sr-only">
        Buscar
      </label>
      <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-cacau-suave" />
      <input
        id="f-q"
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={placeholder}
        className="campo py-2! pl-9! text-sm"
      />
    </form>
  )
}

function FiltroSelect({
  id,
  label,
  value,
  onChange,
  children,
}: {
  id: string
  label: string
  value: string
  onChange: (v: string) => void
  children: React.ReactNode
}) {
  return (
    <div className="min-w-36">
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <select id={id} value={value} onChange={(e) => onChange(e.target.value)} className="campo py-2! text-sm">
        {children}
      </select>
    </div>
  )
}

function Totalizador({ items }: { items: { label: string; value: string; tone?: string }[] }) {
  return (
    <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-linha bg-linha sm:grid-cols-4">
      {items.map((i) => (
        <div key={i.label} className="bg-superficie px-4 py-3">
          <dt className="text-xs text-cacau-suave">{i.label}</dt>
          <dd className={`tabular mt-0.5 font-display text-lg font-bold ${i.tone ?? ''}`}>{i.value}</dd>
        </div>
      ))}
    </dl>
  )
}

function Exportar({ href }: { href: string }) {
  return (
    <a
      href={href}
      className="inline-flex items-center gap-2 rounded-xl border border-linha bg-superficie px-3.5 py-2 text-sm font-semibold text-cacau hover:border-borda"
    >
      <Download aria-hidden className="size-4" />
      Exportar planilha
    </a>
  )
}

function Paginacao({
  pagina,
  paginas,
  aplicar,
}: {
  pagina: number
  paginas: number
  aplicar: (u: Record<string, number>) => void
}) {
  if (paginas <= 1) return null
  return (
    <nav aria-label="Páginas" className="mt-4 flex items-center justify-center gap-2">
      <button
        type="button"
        disabled={pagina <= 1}
        onClick={() => aplicar({ pagina: pagina - 1 })}
        aria-label="Página anterior"
        className="rounded-xl border border-linha bg-superficie p-2 disabled:opacity-40"
      >
        <ChevronLeft aria-hidden className="size-5" />
      </button>
      <span className="tabular px-2 text-sm text-cacau-suave">
        Página {pagina} de {paginas}
      </span>
      <button
        type="button"
        disabled={pagina >= paginas}
        onClick={() => aplicar({ pagina: pagina + 1 })}
        aria-label="Próxima página"
        className="rounded-xl border border-linha bg-superficie p-2 disabled:opacity-40"
      >
        <ChevronRight aria-hidden className="size-5" />
      </button>
    </nav>
  )
}

function Vazio({ filtrado, limpar, children }: { filtrado: boolean; limpar: () => void; children: React.ReactNode }) {
  return (
    <div className="cartao px-6 py-12 text-center">
      <p className="font-medium">{children}</p>
      {filtrado && (
        <button type="button" onClick={limpar} className="mt-3 text-sm font-semibold text-framboesa hover:underline">
          Limpar filtros
        </button>
      )}
    </div>
  )
}

function Resultados({ pending, children }: { pending: boolean; children: React.ReactNode }) {
  return (
    <div aria-busy={pending} className={`transition-opacity duration-200 ${pending ? 'opacity-50' : ''}`}>
      {children}
    </div>
  )
}

const pct = (n: number) => `${n.toFixed(2).replace('.', ',')}%`

// ---------- Vendas ----------

export function VendasView({
  filtro,
  vendas,
  totais,
  maquininhas,
  hoje,
  paginas,
}: {
  filtro: FiltroVendas
  vendas: Entrada[]
  totais: Totais
  maquininhas: Maquininha[]
  hoje: string
  paginas: number
}) {
  const { aplicar, pending, query } = useFiltros()
  const [aberta, setAberta] = useState<Entrada | null>(null)
  const fechar = useCallback(() => setAberta(null), [])
  const toast = useToast()
  const filtrado = Boolean(filtro.forma || filtro.maquininha || filtro.q)

  return (
    <div className="space-y-4">
      <div className="cartao space-y-3 p-4">
        <Periodo de={filtro.de} ate={filtro.ate} hoje={hoje} aplicar={aplicar} />
        <div className="flex flex-col gap-2 sm:flex-row">
          <FiltroSelect id="f-forma" label="Forma de pagamento" value={filtro.forma} onChange={(v) => aplicar({ forma: v })}>
            <option value="">Todas as formas</option>
            {FORMAS_ENTRADA.map((f) => (
              <option key={f} value={f}>
                {FORMA_LABEL[f]}
              </option>
            ))}
          </FiltroSelect>
          <FiltroSelect
            id="f-maq"
            label="Maquininha"
            value={String(filtro.maquininha)}
            onChange={(v) => aplicar({ maquininha: v })}
          >
            <option value="">Todas as maquininhas</option>
            <option value="nenhuma">Sem maquininha</option>
            {maquininhas.map((m) => (
              <option key={m.id} value={m.id}>
                {m.nome}
                {m.ativa ? '' : ' (inativa)'}
              </option>
            ))}
          </FiltroSelect>
          <Busca key={filtro.q} inicial={filtro.q} placeholder="Buscar observação ou nº da venda" aplicar={aplicar} />
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-cacau-suave">
          {formatData(filtro.de)} a {formatData(filtro.ate)}
        </p>
        <Exportar href={`/api/exportar?aba=vendas&${query}`} />
      </div>

      <Totalizador
        items={[
          { label: 'Vendas', value: String(totais.quantidade) },
          { label: 'Bruto', value: formatBRL(totais.brutoCentavos) },
          { label: 'Taxas', value: `− ${formatBRL(totais.taxaCentavos)}`, tone: 'text-saida' },
          { label: 'Líquido', value: formatBRL(totais.liquidoCentavos), tone: 'text-entrada' },
        ]}
      />

      <Resultados pending={pending}>
        {vendas.length === 0 ? (
          <Vazio filtrado={filtrado} limpar={() => aplicar({ forma: null, maquininha: null, q: null })}>
            {filtrado ? 'Nenhuma venda com esses filtros.' : 'Nenhuma venda neste período.'}
          </Vazio>
        ) : (
          <>
            {/* Tabela no computador */}
            <div className="cartao hidden overflow-x-auto xl:block">
              <table className="w-full text-sm">
                <thead className="border-b border-linha bg-creme-fundo/60 text-left text-xs uppercase tracking-wide text-cacau-suave">
                  <tr>
                    <th scope="col" className="px-4 py-3 font-medium">Nº</th>
                    <th scope="col" className="px-4 py-3 font-medium">Data</th>
                    <th scope="col" className="px-4 py-3 font-medium">Forma</th>
                    <th scope="col" className="px-4 py-3 font-medium">Maquininha</th>
                    <th scope="col" className="px-4 py-3 font-medium">Observação</th>
                    <th scope="col" className="px-4 py-3 text-right font-medium">Bruto</th>
                    <th scope="col" className="px-4 py-3 text-right font-medium">Taxa</th>
                    <th scope="col" className="px-4 py-3 text-right font-medium">Líquido</th>
                    <th scope="col" className="px-4 py-3 font-medium">Recebe</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-linha">
                  {vendas.map((v) => (
                    <tr
                      key={v.id}
                      onClick={() => setAberta(v)}
                      className="cursor-pointer transition-colors hover:bg-creme-fundo/70"
                    >
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            setAberta(v)
                          }}
                          className="tabular rounded font-semibold text-framboesa hover:underline"
                          aria-label={`Ver venda ${v.id}`}
                        >
                          #{v.id}
                        </button>
                      </td>
                      <td className="tabular whitespace-nowrap px-4 py-3">{formatData(v.data)}</td>
                      <td className="px-4 py-3">
                        <FormaBadge forma={v.forma} parcelas={v.parcelas} />
                      </td>
                      <td className="px-4 py-3 text-cacau-suave">{v.maquininhaNome ?? '—'}</td>
                      <td className="max-w-56 truncate px-4 py-3 text-cacau-suave">{v.descricao ?? ''}</td>
                      <td className="tabular whitespace-nowrap px-4 py-3 text-right font-medium">{formatBRL(v.brutoCentavos)}</td>
                      <td className="tabular whitespace-nowrap px-4 py-3 text-right text-saida">
                        {v.taxaCentavos ? `− ${formatBRL(v.taxaCentavos)}` : '—'}
                      </td>
                      <td className="tabular whitespace-nowrap px-4 py-3 text-right font-semibold">
                        {formatBRL(v.liquidoCentavos)}
                      </td>
                      <td className="tabular whitespace-nowrap px-4 py-3 text-cacau-suave">
                        {formatDataCurta(v.dataRecebimento)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Lista no celular */}
            <ul className="cartao divide-y divide-linha xl:hidden">
              {vendas.map((v) => (
                <li key={v.id}>
                  <button
                    type="button"
                    onClick={() => setAberta(v)}
                    className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left"
                  >
                    <span className="min-w-0">
                      <span className="flex flex-wrap items-center gap-2">
                        <FormaBadge forma={v.forma} parcelas={v.parcelas} />
                        <span className="tabular text-xs text-cacau-suave">
                          {formatData(v.data)} · #{v.id}
                        </span>
                      </span>
                      <span className="mt-1 block break-words text-sm text-cacau-suave">
                        {[v.maquininhaNome, v.descricao].filter(Boolean).join(' · ') || ' '}
                      </span>
                    </span>
                    <span className="shrink-0 text-right">
                      <span className="tabular block font-semibold">{formatBRL(v.brutoCentavos)}</span>
                      {v.taxaCentavos > 0 && (
                        <span className="tabular block text-xs text-cacau-suave">líq. {formatBRL(v.liquidoCentavos)}</span>
                      )}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
        <Paginacao pagina={filtro.pagina} paginas={paginas} aplicar={aplicar} />
      </Resultados>

      <Drawer open={aberta !== null} onClose={fechar} title={aberta ? `Venda #${aberta.id}` : ''}>
        {aberta && (
          <div className="space-y-5">
            <div className="rounded-2xl bg-cacau p-5 text-creme">
              <p className="text-sm text-creme/70">Líquido</p>
              <p className="tabular font-display text-3xl font-bold">{formatBRL(aberta.liquidoCentavos)}</p>
            </div>
            <DetailList
              items={[
                ['Data da venda', formatData(aberta.data)],
                ['Lançada às', formatHora(new Date(aberta.criadoEm))],
                ['Forma', <FormaBadge key="f" forma={aberta.forma} parcelas={aberta.parcelas} />],
                ['Maquininha', aberta.maquininhaNome ?? (aberta.forma === 'pix' ? 'Direto na conta' : '—')],
                ['Valor bruto', formatBRL(aberta.brutoCentavos)],
                ['Taxa', `${pct(aberta.taxaPercentual)} · − ${formatBRL(aberta.taxaCentavos)}`],
                ['Valor líquido', formatBRL(aberta.liquidoCentavos)],
                ['Recebimento', formatData(aberta.dataRecebimento)],
                ...(aberta.descricao ? [['Observação', aberta.descricao] as [string, string]] : []),
              ]}
            />
            <p className="text-xs text-cacau-suave">
              A taxa fica gravada como era no dia da venda. Mudar as taxas em Configurações não altera vendas antigas.
            </p>
            <BotaoEditar href={linkEditarVenda(aberta.id, `/historico${query ? `?${query}` : ''}`)} label="Editar venda" className="w-full" />
            <ConfirmButton
              label="Excluir venda"
              confirmLabel="Toque de novo para excluir"
              className="w-full"
              onConfirm={async () => {
                const r = await deleteEntrada(aberta.id)
                toast({ tone: r.ok ? 'sucesso' : 'erro', message: r.message })
                if (r.ok) setAberta(null)
              }}
            />
          </div>
        )}
      </Drawer>
    </div>
  )
}

// ---------- Saídas ----------

export function SaidasView({
  filtro,
  saidas,
  totais,
  hoje,
  paginas,
}: {
  filtro: FiltroSaidas
  saidas: Saida[]
  totais: { quantidade: number; totalCentavos: number }
  hoje: string
  paginas: number
}) {
  const { aplicar, pending, query } = useFiltros()
  const [abertaId, setAbertaId] = useState<number | null>(null)
  const fechar = useCallback(() => setAbertaId(null), [])
  // Lê sempre da lista atual para refletir pagamentos marcados no painel.
  const aberta = saidas.find((s) => s.id === abertaId) ?? null
  const toast = useToast()
  const filtrado = Boolean(filtro.forma || filtro.condicao || filtro.categoria || filtro.q)

  return (
    <div className="space-y-4">
      <div className="cartao space-y-3 p-4">
        <Periodo de={filtro.de} ate={filtro.ate} hoje={hoje} aplicar={aplicar} />
        <div className="flex flex-col gap-2 sm:flex-row">
          <FiltroSelect id="f-forma" label="Forma de pagamento" value={filtro.forma} onChange={(v) => aplicar({ forma: v })}>
            <option value="">Todas as formas</option>
            {FORMAS_SAIDA.map((f) => (
              <option key={f} value={f}>
                {FORMA_LABEL[f]}
              </option>
            ))}
          </FiltroSelect>
          <FiltroSelect id="f-cond" label="Condição" value={filtro.condicao} onChange={(v) => aplicar({ condicao: v })}>
            <option value="">À vista e parcelado</option>
            <option value="a_vista">À vista</option>
            <option value="parcelado">Parcelado</option>
          </FiltroSelect>
          <Busca key={filtro.q} inicial={filtro.q} placeholder="Buscar descrição, fornecedor ou categoria" aplicar={aplicar} />
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-cacau-suave">
          Compras de {formatData(filtro.de)} a {formatData(filtro.ate)}
        </p>
        <Exportar href={`/api/exportar?aba=saidas&${query}`} />
      </div>

      <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-linha bg-linha">
        <div className="bg-superficie px-4 py-3">
          <dt className="text-xs text-cacau-suave">Saídas</dt>
          <dd className="tabular mt-0.5 font-display text-lg font-bold">{totais.quantidade}</dd>
        </div>
        <div className="bg-superficie px-4 py-3">
          <dt className="text-xs text-cacau-suave">Total</dt>
          <dd className="tabular mt-0.5 font-display text-lg font-bold text-saida">{formatBRL(totais.totalCentavos)}</dd>
        </div>
      </dl>

      <Resultados pending={pending}>
        {saidas.length === 0 ? (
          <Vazio filtrado={filtrado} limpar={() => aplicar({ forma: null, condicao: null, categoria: null, q: null })}>
            {filtrado ? 'Nenhuma saída com esses filtros.' : 'Nenhuma saída neste período.'}
          </Vazio>
        ) : (
          <ul className="cartao divide-y divide-linha">
            {saidas.map((s) => {
              const pagas = s.parcelas.filter((p) => p.pagoEm).length
              return (
                <li key={s.id}>
                  <button
                    type="button"
                    onClick={() => setAbertaId(s.id)}
                    className="grid w-full grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1 px-4 py-3.5 text-left transition-colors hover:bg-creme-fundo/70 md:grid-cols-[110px_1fr_auto_auto]"
                  >
                    <span className="tabular hidden text-sm text-cacau-suave md:block">{formatData(s.data)}</span>
                    <span className="min-w-0">
                      <span className="block break-words font-medium">{s.descricao}</span>
                      <span className="mt-1 flex flex-wrap items-center gap-2 text-xs text-cacau-suave">
                        <span className="tabular md:hidden">{formatData(s.data)}</span>
                        <FormaBadge forma={s.forma} />
                        <span>{s.condicao === 'parcelado' ? `${s.numParcelas}x` : 'À vista'}</span>
                        {s.categoria && <span>· {s.categoria}</span>}
                        {s.fornecedor && <span>· {s.fornecedor}</span>}
                      </span>
                    </span>
                    <span
                      className={`row-start-2 text-xs font-semibold md:row-start-auto ${
                        pagas === s.numParcelas ? 'text-entrada' : 'text-alerta'
                      }`}
                    >
                      {pagas === s.numParcelas ? 'Pago' : `${pagas}/${s.numParcelas} pagas`}
                    </span>
                    <span className="tabular row-span-2 font-semibold text-saida md:row-span-1">
                      − {formatBRL(s.totalCentavos)}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
        <Paginacao pagina={filtro.pagina} paginas={paginas} aplicar={aplicar} />
      </Resultados>

      <Drawer open={aberta !== null} onClose={fechar} title={aberta?.descricao ?? ''}>
        {aberta && (
          <div className="space-y-5">
            <DetailList
              items={[
                ['Data da compra', formatData(aberta.data)],
                ['Valor total', formatBRL(aberta.totalCentavos)],
                ['Forma', <FormaBadge key="f" forma={aberta.forma} />],
                ['Condição', aberta.condicao === 'parcelado' ? `Parcelado em ${aberta.numParcelas}x` : 'À vista'],
                ...(aberta.categoria ? [['Categoria', aberta.categoria] as [string, string]] : []),
                ...(aberta.fornecedor ? [['Fornecedor', aberta.fornecedor] as [string, string]] : []),
              ]}
            />
            <div>
              <h3 className="mb-2 font-semibold">{aberta.numParcelas > 1 ? 'Parcelas' : 'Pagamento'}</h3>
              <ul className="space-y-1.5">
                {aberta.parcelas.map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-3 rounded-xl bg-creme-fundo px-3.5 py-2.5 text-sm">
                    <span>
                      <span className="font-semibold">
                        {aberta.numParcelas > 1 ? `${p.numero}/${aberta.numParcelas}` : 'Única'}
                      </span>
                      <span className="tabular ml-2 text-cacau-suave">vence {formatData(p.vencimento)}</span>
                    </span>
                    <span className="flex items-center gap-2">
                      <span className="tabular font-semibold">{formatBRL(p.valorCentavos)}</span>
                      <TogglePago id={p.id} pagoEm={p.pagoEm} />
                    </span>
                  </li>
                ))}
              </ul>
            </div>
            <BotaoEditar
              href={linkEditarSaida(aberta.id, `/historico${query ? `?${query}` : ''}`)}
              label="Editar saída"
              className="w-full"
            />
            <ConfirmButton
              label="Excluir saída"
              confirmLabel="Toque de novo para excluir"
              className="w-full"
              onConfirm={async () => {
                const r = await deleteSaida(aberta.id)
                toast({ tone: r.ok ? 'sucesso' : 'erro', message: r.message })
                if (r.ok) setAbertaId(null)
              }}
            />
          </div>
        )}
      </Drawer>
    </div>
  )
}

function TogglePago({ id, pagoEm }: { id: number; pagoEm: string | null }) {
  const [busy, setBusy] = useState(false)
  const toast = useToast()
  const pago = Boolean(pagoEm)
  return (
    <motion.button
      type="button"
      disabled={busy}
      whileTap={{ scale: 0.92 }}
      onClick={async () => {
        setBusy(true)
        const r = await setParcelaPaga(id, !pago)
        setBusy(false)
        if (!r.ok) toast({ tone: 'erro', message: r.message })
      }}
      aria-pressed={pago}
      aria-label={pago ? `Paga em ${formatData(pagoEm!)}. Desmarcar` : 'Marcar como paga'}
      className={`inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-semibold transition-colors disabled:opacity-50 ${
        pago ? 'text-entrada hover:bg-entrada/10' : 'text-cacau-suave hover:bg-superficie hover:text-cacau'
      }`}
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={pago ? 'pago' : 'aberto'}
          initial={{ scale: 0.4, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.4, opacity: 0 }}
          transition={{ duration: 0.15 }}
        >
          {pago ? <CheckCircle2 aria-hidden className="size-5" /> : <Circle aria-hidden className="size-5" />}
        </motion.span>
      </AnimatePresence>
      {pago ? 'Paga' : 'Pagar'}
    </motion.button>
  )
}

// ---------- Contas a pagar ----------

export function ContasView({
  filtro,
  parcelas,
  totais,
  hoje,
  paginas,
}: {
  filtro: FiltroContas
  parcelas: Parcela[]
  totais: { quantidade: number; totalCentavos: number }
  hoje: string
  paginas: number
}) {
  const { aplicar, pending, query } = useFiltros()

  // Agrupa por vencimento, preservando a ordem do banco.
  const grupos: { vencimento: string; itens: Parcela[] }[] = []
  for (const p of parcelas) {
    const last = grupos[grupos.length - 1]
    if (last && last.vencimento === p.vencimento) last.itens.push(p)
    else grupos.push({ vencimento: p.vencimento, itens: [p] })
  }

  return (
    <div className="space-y-4">
      <div className="cartao flex flex-col gap-3 p-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="sm:w-96">
          <Segmented
            name="status"
            legend="Situação"
            hideLegend
            layoutId="status-contas"
            value={filtro.status}
            onChange={(v) => aplicar({ status: v === 'pendentes' ? null : v })}
            options={[
              { value: 'pendentes', label: 'A pagar' },
              { value: 'pagas', label: 'Pagas' },
              { value: 'todas', label: 'Todas' },
            ]}
          />
        </div>
        <div>
          <label htmlFor="c-ate" className="mb-1 block text-xs font-medium text-cacau-suave">
            Vencimento até
          </label>
          <input
            id="c-ate"
            type="date"
            value={filtro.ate}
            onChange={(e) => e.target.value && aplicar({ ate: e.target.value })}
            className="campo min-w-0 py-2! text-sm"
          />
        </div>
      </div>

      <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-linha bg-linha">
        <div className="bg-superficie px-4 py-3">
          <dt className="text-xs text-cacau-suave">Parcelas</dt>
          <dd className="tabular mt-0.5 font-display text-lg font-bold">{totais.quantidade}</dd>
        </div>
        <div className="bg-superficie px-4 py-3">
          <dt className="text-xs text-cacau-suave">Total</dt>
          <dd className="tabular mt-0.5 font-display text-lg font-bold text-saida">{formatBRL(totais.totalCentavos)}</dd>
        </div>
      </dl>

      <Resultados pending={pending}>
        {grupos.length === 0 ? (
          <div className="cartao px-6 py-12 text-center font-medium">
            {filtro.status === 'pendentes' ? 'Nenhuma conta a pagar até essa data.' : 'Nada encontrado.'}
          </div>
        ) : (
          <div className="space-y-4">
            {grupos.map((g) => {
              const vencida = g.vencimento < hoje
              const ehHoje = g.vencimento === hoje
              return (
                <section key={g.vencimento} aria-label={`Vencimento ${formatData(g.vencimento)}`}>
                  <h3
                    className={`mb-2 flex items-center gap-2 text-sm font-semibold ${
                      vencida && filtro.status !== 'pagas' ? 'text-saida' : 'text-cacau-suave'
                    }`}
                  >
                    <span className="tabular">{formatData(g.vencimento)}</span>
                    {ehHoje && <span className="rounded-full bg-framboesa px-2 py-0.5 text-xs text-white">hoje</span>}
                    {vencida && filtro.status !== 'pagas' && <span>· vencida</span>}
                  </h3>
                  <ul className="cartao divide-y divide-linha">
                    <AnimatePresence initial={false}>
                      {g.itens.map((p) => (
                        <motion.li
                          key={p.id}
                          layout
                          exit={{ opacity: 0, x: 24 }}
                          className="flex items-center justify-between gap-3 px-4 py-3"
                        >
                          <span className="min-w-0">
                            <span className="block break-words font-medium">{p.descricao}</span>
                            <span className="mt-1 flex flex-wrap items-center gap-2 text-xs text-cacau-suave">
                              <FormaBadge forma={p.forma} />
                              {p.totalParcelas > 1 && (
                                <span>
                                  parcela {p.numero}/{p.totalParcelas}
                                </span>
                              )}
                              {p.fornecedor && <span>· {p.fornecedor}</span>}
                              {p.pagoEm && <span className="text-entrada">paga em {formatData(p.pagoEm)}</span>}
                              <Link
                                href={linkEditarSaida(p.saidaId, `/historico${query ? `?${query}` : ''}`)}
                                className="font-semibold text-framboesa underline underline-offset-2"
                              >
                                Editar
                              </Link>
                            </span>
                          </span>
                          <span className="flex shrink-0 items-center gap-2">
                            <span className="tabular font-semibold">{formatBRL(p.valorCentavos)}</span>
                            <TogglePago id={p.id} pagoEm={p.pagoEm} />
                          </span>
                        </motion.li>
                      ))}
                    </AnimatePresence>
                  </ul>
                </section>
              )
            })}
          </div>
        )}
        <Paginacao pagina={filtro.pagina} paginas={paginas} aplicar={aplicar} />
      </Resultados>
    </div>
  )
}

