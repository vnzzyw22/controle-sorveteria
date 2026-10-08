'use client'

import { motion } from 'framer-motion'
import { ArrowDownCircle, ArrowUpCircle, ChartColumn, History, LayoutDashboard, LogOut, Settings } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { logout } from '@/lib/actions'
import { Logo } from './logo'

const ITEMS = [
  { href: '/', label: 'Caixa do dia', short: 'Caixa', icon: LayoutDashboard },
  { href: '/vendas/nova', label: 'Lançar venda', short: 'Venda', icon: ArrowDownCircle },
  { href: '/saidas/nova', label: 'Lançar saída', short: 'Saída', icon: ArrowUpCircle },
  { href: '/resumo', label: 'Resumo', short: 'Resumo', icon: ChartColumn },
  { href: '/historico', label: 'Histórico', short: 'Histórico', icon: History },
  { href: '/config', label: 'Configurações', short: 'Ajustes', icon: Settings },
]

function isActive(pathname: string, href: string) {
  return href === '/' ? pathname === '/' : pathname.startsWith(href)
}

const spring = { type: 'spring', stiffness: 520, damping: 40 } as const

export function Sidebar() {
  const pathname = usePathname()
  return (
    <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-linha bg-creme-fundo/60 px-4 py-6 lg:flex">
      <Link href="/" className="mb-8 rounded-xl px-2">
        <Logo />
      </Link>
      <nav aria-label="Principal" className="flex flex-1 flex-col gap-1">
        {ITEMS.map(({ href, label, icon: Icon }) => {
          const active = isActive(pathname, href)
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? 'page' : undefined}
              className={`relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-[15px] font-medium transition-colors ${
                active ? 'text-framboesa' : 'text-cacau-suave hover:text-cacau'
              }`}
            >
              {active && (
                <motion.span
                  layoutId="nav-desktop"
                  transition={spring}
                  className="absolute inset-0 rounded-xl bg-superficie shadow-sm ring-1 ring-linha"
                />
              )}
              <Icon aria-hidden className="relative size-5" />
              <span className="relative">{label}</span>
            </Link>
          )
        })}
      </nav>
      <form action={logout}>
        <button
          type="submit"
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-[15px] font-medium text-cacau-suave hover:bg-superficie hover:text-cacau"
        >
          <LogOut aria-hidden className="size-5" />
          Sair
        </button>
      </form>
    </aside>
  )
}

export function BottomNav() {
  const pathname = usePathname()
  return (
    <nav
      aria-label="Principal"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-linha bg-superficie/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
    >
      <ul className="mx-auto grid max-w-lg grid-cols-6">
        {ITEMS.map(({ href, short, icon: Icon }) => {
          const active = isActive(pathname, href)
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? 'page' : undefined}
                className={`relative flex flex-col items-center gap-0.5 px-1 pb-2 pt-2.5 text-[11px] font-medium ${
                  active ? 'text-framboesa' : 'text-cacau-suave'
                }`}
              >
                {active && (
                  <motion.span
                    layoutId="nav-mobile"
                    transition={spring}
                    className="absolute inset-x-3 top-0 h-[3px] rounded-b-full bg-framboesa"
                  />
                )}
                <Icon aria-hidden className="size-6" strokeWidth={active ? 2.2 : 1.8} />
                {short}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}

export function MobileHeader() {
  return (
    <header className="flex items-center justify-between px-4 pb-1 pt-4 lg:hidden">
      <Link href="/" className="rounded-xl">
        <Logo />
      </Link>
      <form action={logout}>
        <button
          type="submit"
          aria-label="Sair"
          className="rounded-xl p-2.5 text-cacau-suave hover:bg-superficie hover:text-cacau"
        >
          <LogOut aria-hidden className="size-5" />
        </button>
      </form>
    </header>
  )
}
