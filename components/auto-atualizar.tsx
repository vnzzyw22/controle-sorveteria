'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useRef } from 'react'
import { verificarVendasNovas } from '@/lib/actions'

const INTERVALO = 30_000

/**
 * Mantém a tela em dia sozinha: a cada 30 s (só com a aba visível) busca vendas novas da maquininha
 * e recarrega os dados quando aparece venda nova, lançada por outro aparelho, pelo aviso ou pela busca.
 */
export function AutoAtualizar({ ultimaId }: { ultimaId: number }) {
  const router = useRouter()
  const conhecida = useRef(ultimaId)
  conhecida.current = Math.max(conhecida.current, ultimaId)

  useEffect(() => {
    let parado = false
    async function verificar() {
      if (document.visibilityState !== 'visible') return
      try {
        const r = await verificarVendasNovas()
        if (!parado && r.ultimaId !== conhecida.current) {
          conhecida.current = r.ultimaId
          router.refresh()
        }
      } catch {
        // Sem internet ou banco acordando: tenta de novo na próxima volta.
      }
    }
    const timer = setInterval(verificar, INTERVALO)
    const aoVoltar = () => document.visibilityState === 'visible' && verificar()
    document.addEventListener('visibilitychange', aoVoltar)
    return () => {
      parado = true
      clearInterval(timer)
      document.removeEventListener('visibilitychange', aoVoltar)
    }
  }, [router])

  return null
}
