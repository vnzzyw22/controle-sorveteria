import type { Metadata } from 'next'
import { CheckCircle2, CircleAlert } from 'lucide-react'
import { diagnosticoBanco } from '@/lib/db'
import { PageHeader } from '@/components/ui'

export const metadata: Metadata = { title: 'Diagnóstico' }

export default async function DiagnosticoPage() {
  const banco = await diagnosticoBanco()
  return (
    <>
      <PageHeader title="Diagnóstico" description="Mostra se o site consegue falar com o banco de dados." />
      <div className="cartao flex gap-3 p-5">
        {banco.ok ? (
          <>
            <CheckCircle2 aria-hidden className="size-6 shrink-0 text-entrada" />
            <p>
              <strong>Banco conectado.</strong> Usando a variável <code>{banco.variavel}</code>.
            </p>
          </>
        ) : (
          <>
            <CircleAlert aria-hidden className="size-6 shrink-0 text-saida" />
            <div>
              <p className="font-semibold">O banco não respondeu.</p>
              <p className="mt-1 break-words text-sm text-cacau-suave">{banco.erro}</p>
            </div>
          </>
        )}
      </div>
    </>
  )
}
