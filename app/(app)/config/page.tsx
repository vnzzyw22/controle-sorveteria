import type { Metadata } from 'next'
import { getMaquininhas, getTaxas } from '@/lib/data'
import { PageHeader } from '@/components/ui'
import { ConfigClient } from './config-client'

export const metadata: Metadata = { title: 'Configurações' }

export default async function ConfigPage() {
  const [maquininhas, taxas] = await Promise.all([getMaquininhas(), getTaxas()])
  return (
    <>
      <PageHeader
        title="Configurações"
        description="Taxas de cada maquininha. Confira os valores no app ou contrato de cada uma — mudam conforme o plano."
      />
      <ConfigClient maquininhas={maquininhas} taxas={taxas} />
    </>
  )
}
