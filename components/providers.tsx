'use client'

import { MotionConfig } from 'framer-motion'
import { ToastProvider } from './toast'

export function Providers({ children }: { children: React.ReactNode }) {
  // reducedMotion="user": quem pediu menos movimento no sistema vê só trocas de opacidade.
  return (
    <MotionConfig reducedMotion="user">
      <ToastProvider>{children}</ToastProvider>
    </MotionConfig>
  )
}
