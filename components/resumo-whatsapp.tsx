'use client'

import { Copy, MessageCircle } from 'lucide-react'
import { useToast } from './toast'

/** Manda o fechamento do dia no WhatsApp (ou copia o texto). */
export function ResumoWhatsApp({ texto }: { texto: string }) {
  const toast = useToast()
  return (
    <div className="flex items-center gap-1.5">
      <a
        href={`https://wa.me/?text=${encodeURIComponent(texto)}`}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-2 rounded-xl bg-[#1f7a4d] px-3.5 py-2.5 text-sm font-semibold text-white hover:bg-[#186440]"
      >
        <MessageCircle aria-hidden className="size-4" />
        Resumo no WhatsApp
      </a>
      <button
        type="button"
        aria-label="Copiar resumo do dia"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(texto)
            toast({ tone: 'sucesso', message: 'Resumo copiado. É só colar no WhatsApp.' })
          } catch {
            toast({ tone: 'erro', message: 'Não deu para copiar neste aparelho.' })
          }
        }}
        className="rounded-xl border border-linha bg-superficie p-2.5 text-cacau-suave hover:border-borda hover:text-cacau"
      >
        <Copy aria-hidden className="size-4" />
      </button>
    </div>
  )
}
