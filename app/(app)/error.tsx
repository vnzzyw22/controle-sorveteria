'use client'

import { RotateCcw } from 'lucide-react'
import Link from 'next/link'

export default function Erro({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div role="alert" className="cartao mx-auto mt-10 max-w-lg p-8 text-center">
      <h1 className="font-display text-2xl font-bold">Não foi possível carregar</h1>
      <p className="mt-2 text-cacau-suave">
        O banco pode estar &quot;acordando&quot; ou a internet oscilou. Tente de novo; se continuar, abra o diagnóstico.
      </p>
      <button
        type="button"
        onClick={reset}
        className="mt-6 inline-flex items-center gap-2 rounded-xl bg-framboesa px-5 py-3 font-semibold text-white hover:bg-framboesa-escura"
      >
        <RotateCcw aria-hidden className="size-4" />
        Tentar de novo
      </button>
      <Link href="/diagnostico" className="mt-4 block text-sm font-semibold text-framboesa underline">
        Ver diagnóstico do banco
      </Link>
      {error.digest && <p className="mt-3 text-xs text-cacau-suave">Código do erro: {error.digest}</p>}
    </div>
  )
}
