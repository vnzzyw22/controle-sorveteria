import type { Metadata } from 'next'
import { mesDe } from '@/lib/analise'
import { getMaquininhas, getMeta, getSaldoEmpresa, getTaxas } from '@/lib/data'
import { hoje } from '@/lib/dates'
import { PageHeader } from '@/components/ui'
import { ConfigClient } from './config-client'
import { MercadoPagoPainel } from './mercadopago-painel'
import { MetaForm } from './meta-form'
import { SaldoForm } from './saldo-form'

export const metadata: Metadata = { title: 'Configurações' }

export default async function ConfigPage() {
  const today = hoje()
  const mes = mesDe(today)
  const [maquininhas, taxas, meta, saldo] = await Promise.all([
    getMaquininhas(),
    getTaxas(),
    getMeta(mes),
    getSaldoEmpresa(today),
  ])
  return (
    <>
      <PageHeader
        title="Configurações"
        description="Saldo da empresa, meta do mês e taxas de cada maquininha. Confira as taxas no app ou contrato de cada uma — mudam conforme o plano."
      />
      <div className="space-y-6">
        <SaldoForm hoje={today} atual={saldo ? { valorCentavos: saldo.inicialCentavos, data: saldo.data } : null} />
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
