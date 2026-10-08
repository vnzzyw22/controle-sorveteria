'use client'

import { AnimatePresence, motion } from 'framer-motion'
import { CheckCircle2, CircleAlert, Loader2, Smartphone } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useToast } from '@/components/toast'
import { acompanharCobranca, cancelarCobrancaMaquininha, cobrarNaMaquininha } from '@/lib/actions'
import { formatBRL, type FormaEntrada } from '@/lib/money'

type Etapa =
  | { tipo: 'parado' }
  | { tipo: 'enviando' }
  | { tipo: 'aguardando'; orderId: string; mensagem: string }
  | { tipo: 'fim'; ok: boolean; mensagem: string }

/**
 * Envia a venda para a maquininha Mercado Pago e acompanha até o cliente pagar.
 * Quem lança a venda é o servidor, quando o pagamento é aprovado (não este botão).
 */
export function CobrancaMaquininha({
  valor,
  forma,
  parcelas,
  onPaga,
}: {
  valor: number
  forma: FormaEntrada
  parcelas: number
  onPaga: () => void
}) {
  const [etapa, setEtapa] = useState<Etapa>({ tipo: 'parado' })
  const toast = useToast()
  const onPagaRef = useRef(onPaga)
  onPagaRef.current = onPaga

  // Consulta a cada 3 segundos enquanto a cobrança está na maquininha.
  const orderId = etapa.tipo === 'aguardando' ? etapa.orderId : null
  useEffect(() => {
    if (!orderId) return
    let vivo = true
    const timer = setInterval(async () => {
      const r = await acompanharCobranca(orderId)
      if (!vivo) return
      if (!r.ok) return setEtapa({ tipo: 'aguardando', orderId, mensagem: r.message })
      if (!r.final) return setEtapa({ tipo: 'aguardando', orderId, mensagem: r.message })
      const paga = r.status === 'processed'
      setEtapa({ tipo: 'fim', ok: paga, mensagem: r.message })
      if (paga) {
        toast({ tone: 'sucesso', message: `Venda de ${formatBRL(valor)} paga na maquininha e lançada.` })
        onPagaRef.current()
      }
    }, 3000)
    return () => {
      vivo = false
      clearInterval(timer)
    }
  }, [orderId, toast, valor])

  async function enviar() {
    setEtapa({ tipo: 'enviando' })
    const r = await cobrarNaMaquininha(valor, forma, parcelas)
    if (!r.ok || !r.orderId) return setEtapa({ tipo: 'fim', ok: false, mensagem: r.message })
    setEtapa({ tipo: 'aguardando', orderId: r.orderId, mensagem: 'Aguardando o cliente pagar na maquininha…' })
  }

  async function cancelar() {
    if (etapa.tipo !== 'aguardando') return
    const r = await cancelarCobrancaMaquininha(etapa.orderId)
    setEtapa({ tipo: 'fim', ok: false, mensagem: r.message })
  }

  const ocupado = etapa.tipo === 'enviando' || etapa.tipo === 'aguardando'

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={enviar}
        disabled={!valor || ocupado}
        className="inline-flex w-full items-center justify-center gap-2 rounded-xl border-2 border-framboesa bg-superficie px-5 py-3.5 font-semibold text-framboesa transition-colors hover:bg-framboesa-clara disabled:cursor-not-allowed disabled:opacity-55"
      >
        <Smartphone aria-hidden className="size-5" />
        Cobrar na maquininha {valor ? formatBRL(valor) : ''}
      </button>

      <AnimatePresence initial={false}>
        {etapa.tipo !== 'parado' && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            role="status"
            className={`flex items-start gap-3 rounded-xl p-3.5 text-sm ${
              etapa.tipo === 'fim' && !etapa.ok ? 'bg-saida/10 text-saida' : 'bg-creme-fundo text-cacau'
            }`}
          >
            {etapa.tipo === 'fim' ? (
              etapa.ok ? (
                <CheckCircle2 aria-hidden className="mt-0.5 size-5 shrink-0 text-entrada" />
              ) : (
                <CircleAlert aria-hidden className="mt-0.5 size-5 shrink-0" />
              )
            ) : (
              <Loader2 aria-hidden className="mt-0.5 size-5 shrink-0 animate-spin text-framboesa" />
            )}
            <span className="min-w-0 flex-1">
              {etapa.tipo === 'enviando' ? 'Enviando para a maquininha…' : etapa.mensagem}
            </span>
            {etapa.tipo === 'aguardando' && (
              <button type="button" onClick={cancelar} className="shrink-0 font-semibold underline underline-offset-2">
                Cancelar
              </button>
            )}
            {etapa.tipo === 'fim' && (
              <button
                type="button"
                onClick={() => setEtapa({ tipo: 'parado' })}
                className="shrink-0 font-semibold underline underline-offset-2"
              >
                Fechar
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
