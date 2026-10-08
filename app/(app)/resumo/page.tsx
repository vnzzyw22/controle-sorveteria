import type { Metadata } from 'next'
import { getResumo } from '@/lib/data'
import { hoje } from '@/lib/dates'
import { resolverPeriodo } from '@/lib/periodos'
import { PageHeader } from '@/components/ui'
import { ResumoView } from './resumo-client'

export const metadata: Metadata = { title: 'Resumo' }

export default async function ResumoPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = await searchParams
  const bruto = Array.isArray(params.periodo) ? params.periodo[0] : params.periodo
  const today = hoje()
  const periodo = resolverPeriodo(bruto, today)
  const resumo = await getResumo(today, periodo.de, periodo.ate)

  return (
    <>
      <PageHeader title="Resumo" description="Como a sorveteria está indo: meses, dias da semana, pagamentos e despesas." />
      <ResumoView resumo={resumo} periodo={periodo} hoje={today} />
    </>
  )
}
