import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getEntrada, getMaquininhas, getTaxas } from '@/lib/data'
import { hoje } from '@/lib/dates'
import { voltarSeguro } from '@/lib/voltar'
import { PageHeader } from '@/components/ui'
import { VendaForm } from '../../nova/venda-form'

export const metadata: Metadata = { title: 'Editar venda' }

export default async function EditarVendaPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { id } = await params
  const numero = Number(id)
  if (!Number.isInteger(numero) || numero < 1) notFound()

  const [entrada, maquininhas, taxas, sp] = await Promise.all([
    getEntrada(numero),
    getMaquininhas(),
    getTaxas(),
    searchParams,
  ])
  if (!entrada) notFound()

  return (
    <>
      <PageHeader
        title={`Editar venda #${entrada.id}`}
        description="Mude o que precisar. Se a forma de pagamento não mudar, a taxa fica como era no dia da venda."
      />
      <VendaForm
        hoje={hoje()}
        // A maquininha da venda aparece mesmo que tenha sido desativada depois.
        maquininhas={maquininhas.filter((m) => m.ativa || m.id === entrada.maquininhaId)}
        taxas={taxas}
        recentes={[]}
        totalHoje={{ quantidade: 0, brutoCentavos: 0, taxaCentavos: 0, liquidoCentavos: 0 }}
        edicao={{ entrada, voltar: voltarSeguro(sp.voltar, '/historico') }}
      />
    </>
  )
}
