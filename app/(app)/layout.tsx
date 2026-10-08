import { BottomNav, MobileHeader, Sidebar } from '@/components/nav'
import { requireAuth } from '@/lib/auth'

// Tudo aqui depende do banco e da sessão: nada é pré-gerado no build.
export const dynamic = 'force-dynamic'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  await requireAuth()
  return (
    <div className="flex min-h-dvh">
      <Sidebar />
      <div className="min-w-0 flex-1">
        <MobileHeader />
        <main className="mx-auto w-full max-w-6xl px-4 pb-32 pt-4 sm:px-6 lg:px-10 lg:pb-16 lg:pt-10">{children}</main>
      </div>
      <BottomNav />
    </div>
  )
}
