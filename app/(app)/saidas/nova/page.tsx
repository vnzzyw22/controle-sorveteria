import type { Metadata } from 'next'
import { getCategorias } from '@/lib/data'
import { hoje } from '@/lib/dates'
import { PageHeader } from '@/components/ui'
import { SaidaForm } from './saida-form'

export const metadata: Metadata = { title: 'Lançar saída' }

const CATEGORIAS_PADRAO = [
  'Insumos',
  'Embalagens',
  'Aluguel',
  'Energia',
  'Água',
  'Internet',
  'Funcionários',
  'Manutenção',
  'Impostos',
  'Taxas bancárias',
  'Outros',
]

export default async function NovaSaidaPage() {
  const usadas = await getCategorias()
  const categorias = Array.from(new Set([...usadas, ...CATEGORIAS_PADRAO]))
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
