import type { Metadata } from 'next'
import { getMaquininhas, getTaxas, listVendas } from '@/lib/data'
import { hoje } from '@/lib/dates'
import { mpPronto } from '@/lib/mercadopago'
import { PageHeader } from '@/components/ui'
import { VendaForm } from './venda-form'

export const metadata: Metadata = { title: 'Lançar venda' }

export default async function NovaVendaPage() {
  const today = hoje()
  const [maquininhas, taxas, recentes] = await Promise.all([
    getMaquininhas(),
    getTaxas(),
    listVendas({ de: today, ate: today, forma: '', maquininha: '', q: '', pagina: 1 }),
  ])
  return (
    <>
      <PageHeader title="Lançar venda" description="O sistema calcula a taxa da maquininha e o valor líquido." />
      <VendaForm
        hoje={today}
        maquininhas={maquininhas.filter((m) => m.ativa)}
        taxas={taxas}
        recentes={recentes.vendas.slice(0, 6)}
        totalHoje={recentes.totais}
        maquininhaMP={mpPronto()}
      />
    </>
  )
}
