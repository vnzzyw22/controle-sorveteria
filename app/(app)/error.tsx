'use client'

import { RotateCcw } from 'lucide-react'

export default function Erro({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const semBanco = error.message.includes('DATABASE_URL')
  return (
    <div role="alert" className="cartao mx-auto mt-10 max-w-lg p-8 text-center">
      <h1 className="font-display text-2xl font-bold">Não foi possível carregar</h1>
      <p className="mt-2 text-cacau-suave">
        {semBanco
          ? 'O banco de dados ainda não foi conectado. Configure DATABASE_URL (veja o README).'
          : 'O banco pode estar "acordando" ou a internet oscilou. Seus lançamentos estão salvos.'}
      </p>
      <button
        type="button"
        onClick={reset}
        className="mt-6 inline-flex items-center gap-2 rounded-xl bg-framboesa px-5 py-3 font-semibold text-white hover:bg-framboesa-escura"
      >
        <RotateCcw aria-hidden className="size-4" />
        Tentar de novo
      </button>
    </div>
  )
}
