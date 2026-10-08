import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { mesDe } from '@/lib/analise'
import { getTodasMetas, getVendasPorMes } from '@/lib/data'
import { hoje } from '@/lib/dates'
import { PageHeader } from '@/components/ui'
import { MetasForm } from './metas-form'

export const metadata: Metadata = { title: 'Metas' }

export default async function MetasPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = await searchParams
  const today = hoje()
  const anoAtual = Number(today.slice(0, 4))
  const bruto = Array.isArray(params.ano) ? params.ano[0] : params.ano
  const pedido = Number(bruto)
  const ano = Number.isInteger(pedido) && pedido >= 2020 && pedido <= 2100 ? pedido : anoAtual

  const [metas, vendas] = await Promise.all([getTodasMetas(), getVendasPorMes(ano)])

  return (
    <>
      <PageHeader
        title="Metas de vendas"
        description="Defina a meta de cada mês. Mês em branco usa a meta do mês anterior."
      >
        <nav aria-label="Ano" className="flex items-center rounded-xl border border-linha bg-superficie">
          <Link
            href={`/config/metas?ano=${ano - 1}`}
            aria-label={`Ano ${ano - 1}`}
            className="rounded-l-xl p-2.5 text-cacau-suave hover:bg-creme-fundo hover:text-cacau"
          >
            <ChevronLeft aria-hidden className="size-5" />
          </Link>
          <span className="tabular border-x border-linha px-4 py-2 text-sm font-semibold">{ano}</span>
          <Link
            href={`/config/metas?ano=${ano + 1}`}
            aria-label={`Ano ${ano + 1}`}
            className="rounded-r-xl p-2.5 text-cacau-suave hover:bg-creme-fundo hover:text-cacau"
          >
            <ChevronRight aria-hidden className="size-5" />
          </Link>
        </nav>
      </PageHeader>
      <MetasForm key={ano} ano={ano} metas={metas} vendas={vendas} mesAtual={mesDe(today)} />
      <p className="mt-4 text-sm">
        <Link href="/config" className="font-semibold text-framboesa hover:underline">
          Voltar para Configurações
        </Link>
      </p>
    </>
  )
}
