import type { Metadata } from 'next'
import { sugestoesCategorias } from '@/lib/categorias'
import { getCategoriasUsadas } from '@/lib/data'
import { hoje } from '@/lib/dates'
import { PageHeader } from '@/components/ui'
import { SaidaForm } from './saida-form'

export const metadata: Metadata = { title: 'Lançar saída' }

export default async function NovaSaidaPage() {
  const categorias = sugestoesCategorias(await getCategoriasUsadas())
  return (
    <>
      <PageHeader
        title="Lançar saída"
        description="Compras e despesas. Parcelado vira uma conta a pagar por mês."
      />
      <SaidaForm hoje={hoje()} categorias={categorias} />
    </>
  )
}
