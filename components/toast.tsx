'use client'

import { AnimatePresence, motion } from 'framer-motion'
import { CheckCircle2, CircleAlert, X } from 'lucide-react'
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'

interface ToastAction {
  label: string
  onClick: () => void | Promise<void>
}

interface Toast {
  id: number
  message: string
  tone: 'sucesso' | 'erro'
  action?: ToastAction
}

type Show = (t: Omit<Toast, 'id'>) => void

const ToastContext = createContext<Show>(() => {})

export function useToast(): Show {
  return useContext(ToastContext)
}

const DURATION = 6000

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const nextId = useRef(1)

  const dismiss = useCallback((id: number) => setToasts((ts) => ts.filter((t) => t.id !== id)), [])

  const show = useCallback<Show>((t) => {
    const id = nextId.current++
    // Mantém no máximo 3 avisos na tela.
    setToasts((ts) => [...ts.slice(-2), { ...t, id }])
  }, [])

  return (
    <ToastContext.Provider value={show}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-50 flex flex-col items-center gap-2 px-4 lg:bottom-6 lg:left-auto lg:right-6 lg:items-end"
      >
        <AnimatePresence initial={false}>
          {toasts.map((t) => (
            <ToastItem key={t.id} toast={t} dismiss={dismiss} />
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  )
}

function ToastItem({ toast, dismiss }: { toast: Toast; dismiss: (id: number) => void }) {
  const [paused, setPaused] = useState(false)
  const onDismiss = () => dismiss(toast.id)
  useEffect(() => {
    if (paused) return
    const timer = setTimeout(() => dismiss(toast.id), DURATION)
    return () => clearTimeout(timer)
  }, [paused, dismiss, toast.id])

  const Icon = toast.tone === 'sucesso' ? CheckCircle2 : CircleAlert
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 16, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 8, transition: { duration: 0.15 } }}
      transition={{ type: 'spring', stiffness: 500, damping: 34 }}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      role={toast.tone === 'erro' ? 'alert' : 'status'}
      className="pointer-events-auto flex w-full max-w-sm items-center gap-3 rounded-2xl bg-cacau py-3 pl-4 pr-2 text-sm text-creme shadow-lg shadow-cacau/20"
    >
      <Icon
        aria-hidden
        className={`size-5 shrink-0 ${toast.tone === 'sucesso' ? 'text-[#9fd4a7]' : 'text-[#f4a5b9]'}`}
      />
      <p className="flex-1">{toast.message}</p>
      {toast.action && (
        <button
          type="button"
          onClick={async () => {
            onDismiss()
            await toast.action!.onClick()
          }}
          className="rounded-lg px-2.5 py-1.5 font-semibold text-[#f8c9d6] hover:bg-white/10"
        >
          {toast.action.label}
        </button>
      )}
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Fechar aviso"
        className="rounded-lg p-1.5 text-creme/70 hover:bg-white/10 hover:text-creme"
      >
        <X aria-hidden className="size-4" />
      </button>
    </motion.div>
  )
}
