import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { isAuthenticated } from '@/lib/auth'
import { LoginForm } from './login-form'

export const metadata: Metadata = { title: 'Entrar' }
export const dynamic = 'force-dynamic'

export default async function LoginPage() {
  if (await isAuthenticated()) redirect('/')
  return (
    <main className="grid min-h-dvh place-items-center px-4 py-10">
      <LoginForm semSenha={!process.env.APP_PASSWORD} />
    </main>
  )
}
