'use client'

import { Loader2 } from 'lucide-react'
import { useState } from 'react'
import { useToast } from '@/components/toast'
import { buscarVendasDaMaquininha } from '@/lib/actions'

export function BuscarVendasBotao() {
  const [ocupado, setOcupado] = useState(false)
  const toast = useToast()
  return (
    <button
      type="button"
      disabled={ocupado}
      onClick={async () => {
        setOcupado(true)
        const r = await buscarVendasDaMaquininha()
        setOcupado(false)
        toast({ tone: r.ok ? 'sucesso' : 'erro', message: r.message })
      }}
      className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-linha bg-superficie px-4 py-2.5 text-sm font-semibold text-cacau transition-colors hover:border-borda disabled:opacity-60"
    >
      {ocupado && <Loader2 aria-hidden className="size-4 animate-spin" />}
      {ocupado ? 'Buscando…' : 'Buscar vendas da maquininha de hoje'}
    </button>
  )
}
