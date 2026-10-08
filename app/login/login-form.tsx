'use client'

import { motion } from 'framer-motion'
import { useActionState } from 'react'
import { LogoMark } from '@/components/logo'
import { SubmitButton } from '@/components/ui'
import { login } from '@/lib/actions'

export function LoginForm({ semSenha }: { semSenha: boolean }) {
  const [state, action] = useActionState(login, null)
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className="w-full max-w-sm"
    >
      <div className="mb-8 flex flex-col items-center text-center">
        <motion.div
          initial={{ scale: 0.6, rotate: -12 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 16, delay: 0.1 }}
        >
          <LogoMark className="size-16" />
        </motion.div>
        <h1 className="mt-4 font-display text-3xl font-bold tracking-tight">Caixa da Sorveteria</h1>
        <p className="mt-1 text-cacau-suave">Entre com a senha da loja.</p>
      </div>

      <form action={action} className="cartao space-y-4 p-6 shadow-sm">
        {semSenha && (
          <p className="rounded-xl bg-alerta-fundo px-3.5 py-3 text-sm text-alerta">
            Senha ainda não configurada. Defina <code className="font-semibold">APP_PASSWORD</code> no servidor.
          </p>
        )}
        <div>
          <label htmlFor="senha" className="rotulo">
            Senha
          </label>
          <input
            id="senha"
            name="senha"
            type="password"
            autoComplete="current-password"
            required
            autoFocus
            aria-invalid={state?.ok === false || undefined}
            aria-describedby={state?.ok === false ? 'senha-erro' : undefined}
            className="campo"
          />
          {state?.ok === false && (
            <motion.p
              key={state.at}
              id="senha-erro"
              role="alert"
              initial={{ x: -6 }}
              animate={{ x: [6, -4, 2, 0] }}
              transition={{ duration: 0.3 }}
              className="mt-2 text-sm font-medium text-saida"
            >
              {state.message}
            </motion.p>
          )}
        </div>
        <SubmitButton pendingLabel="Entrando…" className="w-full">
          Entrar
        </SubmitButton>
      </form>
    </motion.div>
  )
}
