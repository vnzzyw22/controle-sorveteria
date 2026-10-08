import type { Metadata } from 'next'
import { getMaquininhas, listContas, listSaidas, listVendas } from '@/lib/data'
import { hoje } from '@/lib/dates'
import { PAGE_SIZE, parseFiltroContas, parseFiltroSaidas, parseFiltroVendas } from '@/lib/filters'
import { PageHeader } from '@/components/ui'
import { Abas, ContasView, SaidasView, VendasView } from './historico-client'

export const metadata: Metadata = { title: 'Histórico' }

type SearchParams = Promise<Record<string, string | string[] | undefined>>

export default async function HistoricoPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams
  const aba = params.aba === 'saidas' || params.aba === 'contas' ? params.aba : 'vendas'

  return (
    <>
      <PageHeader title="Histórico" description="Consulte, filtre e exporte todos os lançamentos." />
      <Abas aba={aba} />
      {aba === 'vendas' && <Vendas params={params} />}
      {aba === 'saidas' && <Saidas params={params} />}
      {aba === 'contas' && <Contas params={params} />}
    </>
  )
}

async function Vendas({ params }: { params: Awaited<SearchParams> }) {
  const filtro = parseFiltroVendas(params)
  const [{ vendas, totais }, maquininhas] = await Promise.all([listVendas(filtro), getMaquininhas()])
  return (
    <VendasView
      filtro={filtro}
      vendas={vendas}
      totais={totais}
      maquininhas={maquininhas}
      hoje={hoje()}
      paginas={Math.max(1, Math.ceil(totais.quantidade / PAGE_SIZE))}
    />
  )
}

async function Saidas({ params }: { params: Awaited<SearchParams> }) {
  const filtro = parseFiltroSaidas(params)
  const { saidas, totais } = await listSaidas(filtro)
  return (
    <SaidasView
      filtro={filtro}
      saidas={saidas}
      totais={totais}
      hoje={hoje()}
      paginas={Math.max(1, Math.ceil(totais.quantidade / PAGE_SIZE))}
    />
  )
}

async function Contas({ params }: { params: Awaited<SearchParams> }) {
  const filtro = parseFiltroContas(params)
  const { parcelas, totais } = await listContas(filtro)
  return (
    <ContasView
      filtro={filtro}
      parcelas={parcelas}
      totais={totais}
      hoje={hoje()}
      paginas={Math.max(1, Math.ceil(totais.quantidade / PAGE_SIZE))}
    />
  )
}
