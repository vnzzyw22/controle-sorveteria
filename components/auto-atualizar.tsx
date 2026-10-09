'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useRef } from 'react'
import { verificarVendasNovas } from '@/lib/actions'

const INTERVALO = 15_000
const PRIMEIRA = 1_500

/**
 * Fica no layout de todas as telas: logo ao abrir, ao voltar para o app e a cada 15 s (só com a tela visível)
 * busca vendas novas da maquininha e recarrega os dados quando aparece venda nova, lançada por outro
 * aparelho, pelo aviso ou pela busca. O servidor limita a busca no Mercado Pago a uma a cada 10 s.
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
    const primeira = setTimeout(verificar, PRIMEIRA)
    const timer = setInterval(verificar, INTERVALO)
    const aoVoltar = () => document.visibilityState === 'visible' && verificar()
    document.addEventListener('visibilitychange', aoVoltar)
    window.addEventListener('focus', aoVoltar)
    return () => {
      parado = true
      clearTimeout(primeira)
      clearInterval(timer)
      document.removeEventListener('visibilitychange', aoVoltar)
      window.removeEventListener('focus', aoVoltar)
    }
  }, [router])

  return null
}
