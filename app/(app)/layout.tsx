import { BottomNav, MobileHeader, Sidebar } from '@/components/nav'
import { AutoAtualizar } from '@/components/auto-atualizar'
import { requireAuth } from '@/lib/auth'
import { ultimaEntradaId } from '@/lib/data'
import { databaseEnvName } from '@/lib/db'
import { SemBanco } from './sem-banco'

// Tudo aqui depende do banco e da sessão: nada é pré-gerado no build.
export const dynamic = 'force-dynamic'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  await requireAuth()
  const banco = databaseEnvName()
  const ultimaId = banco ? await ultimaEntradaId().catch(() => 0) : 0
  return (
    <div className="flex min-h-dvh">
      <Sidebar />
      <div className="min-w-0 flex-1">
        <MobileHeader />
        <main className="mx-auto w-full max-w-6xl px-4 pb-32 pt-4 sm:px-6 lg:px-10 lg:pb-16 lg:pt-10">
          {banco ? children : <SemBanco />}
        </main>
      </div>
      <BottomNav />
      {banco && <AutoAtualizar ultimaId={ultimaId} />}
    </div>
  )
}
