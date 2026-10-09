import type { Metadata } from 'next'
import { listOutrasEntradas } from '@/lib/data'
import { hoje } from '@/lib/dates'
import { PageHeader } from '@/components/ui'
import { EntradaValorForm } from './entrada-valor-form'

export const metadata: Metadata = { title: 'Entrada de valor' }

export default async function NovaEntradaValorPage() {
  const recentes = await listOutrasEntradas()
  return (
    <>
      <PageHeader
        title="Entrada de valor"
        description="Dinheiro que entra sem ser venda: renda extra, aporte dos sócios, empréstimo… Soma no saldo da empresa, mas não conta como venda."
      />
      <EntradaValorForm hoje={hoje()} recentes={recentes} />
    </>
  )
}
