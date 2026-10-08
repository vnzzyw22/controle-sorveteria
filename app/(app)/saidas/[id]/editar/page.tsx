import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { sugestoesCategorias } from '@/lib/categorias'
import { getCategoriasUsadas, getSaida } from '@/lib/data'
import { hoje } from '@/lib/dates'
import { voltarSeguro } from '@/lib/voltar'
import { PageHeader } from '@/components/ui'
import { SaidaForm } from '../../nova/saida-form'

export const metadata: Metadata = { title: 'Editar saída' }

export default async function EditarSaidaPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { id } = await params
  const numero = Number(id)
  if (!Number.isInteger(numero) || numero < 1) notFound()

  const [saida, usadas, sp] = await Promise.all([getSaida(numero), getCategoriasUsadas(), searchParams])
  if (!saida) notFound()

  return (
    <>
      <PageHeader title="Editar saída" description={saida.descricao} />
      <SaidaForm
        hoje={hoje()}
        categorias={sugestoesCategorias(usadas)}
        edicao={{ saida, voltar: voltarSeguro(sp.voltar, '/historico?aba=saidas') }}
      />
    </>
  )
}
