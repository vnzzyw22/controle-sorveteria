import type { Metadata } from 'next'
import { mesDe } from '@/lib/analise'
import { getMaquininhas, getMeta, getTaxas } from '@/lib/data'
import { hoje } from '@/lib/dates'
import { PageHeader } from '@/components/ui'
import { ConfigClient } from './config-client'
import { MercadoPagoPainel } from './mercadopago-painel'
import { MetaForm } from './meta-form'

export const metadata: Metadata = { title: 'Configurações' }

export default async function ConfigPage() {
  const mes = mesDe(hoje())
  const [maquininhas, taxas, meta] = await Promise.all([getMaquininhas(), getTaxas(), getMeta(mes)])
  return (
    <>
      <PageHeader
        title="Configurações"
        description="Meta do mês e taxas de cada maquininha. Confira as taxas no app ou contrato de cada uma — mudam conforme o plano."
      />
      <div className="space-y-6">
        <MetaForm mes={mes} metaCentavos={meta?.valorCentavos ?? null} desde={meta?.desde ?? null} />
        <div>
          <h2 className="mb-3 font-display text-lg font-bold">Taxas das maquininhas</h2>
          <ConfigClient maquininhas={maquininhas} taxas={taxas} />
        </div>
        <MercadoPagoPainel />
      </div>
    </>
  )
}
