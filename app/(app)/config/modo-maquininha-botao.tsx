'use client'

import { Loader2 } from 'lucide-react'
import { useState } from 'react'
import { useToast } from '@/components/toast'
import { trocarModoMaquininha } from '@/lib/actions'

/** Liga/desliga o modo PDV da maquininha, com confirmação em dois toques. */
export function ModoMaquininhaBotao({ pdv }: { pdv: boolean }) {
  const [confirmar, setConfirmar] = useState(false)
  const [ocupado, setOcupado] = useState(false)
  const toast = useToast()
  const destino = pdv ? 'STANDALONE' : 'PDV'

  return (
    <div className="mt-3 space-y-2">
      {confirmar && (
        <p className="rounded-xl bg-alerta-fundo p-3 text-sm text-alerta">
          {pdv
            ? 'A maquininha volta ao uso normal: vocês digitam o valor nela e o botão "Cobrar na maquininha" do site para de funcionar.'
            : 'No modo PDV a maquininha passa a esperar as cobranças enviadas pelo site (botão "Cobrar na maquininha"). Depois de ativar, desligue e ligue a maquininha.'}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={ocupado}
          onClick={async () => {
            if (!confirmar) return setConfirmar(true)
            setOcupado(true)
            const r = await trocarModoMaquininha(destino)
            setOcupado(false)
            setConfirmar(false)
            toast({ tone: r.ok ? 'sucesso' : 'erro', message: r.message })
          }}
          className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors disabled:opacity-60 ${
            confirmar ? 'bg-framboesa text-white hover:bg-framboesa-escura' : 'border border-linha bg-superficie text-cacau hover:border-borda'
          }`}
        >
          {ocupado && <Loader2 aria-hidden className="size-4 animate-spin" />}
          {confirmar ? 'Confirmar' : pdv ? 'Voltar ao modo normal' : 'Ativar modo PDV (integrado)'}
        </button>
        {confirmar && !ocupado && (
          <button
            type="button"
            onClick={() => setConfirmar(false)}
            className="rounded-xl px-4 py-2.5 text-sm font-semibold text-cacau-suave hover:bg-creme-fundo"
          >
            Cancelar
          </button>
        )}
      </div>
    </div>
  )
}
