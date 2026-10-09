import { CupSoda } from 'lucide-react'
import Link from 'next/link'
import type { ItemEstoque } from '@/lib/data'

/** Linha do Caixa com a situação das bebidas; destaca as que estão acabando. */
export function EstoqueAviso({ itens }: { itens: ItemEstoque[] }) {
  const faltando = itens.filter((i) => i.situacao !== 'ok')
  const semControle = itens.every((i) => i.quantidade === 0)
  return (
    <Link
      href="/estoque"
      className={`mb-5 flex items-center justify-between gap-3 rounded-2xl px-4 py-3 text-sm transition-colors ${
        faltando.length && !semControle
          ? 'bg-alerta-fundo text-alerta hover:brightness-[0.98]'
          : 'border border-linha bg-superficie text-cacau-suave hover:border-borda hover:text-cacau'
      }`}
    >
      <span className="flex items-center gap-3">
        <CupSoda aria-hidden className="size-5 shrink-0" />
        {semControle ? (
          <span>
            <strong>Estoque de bebidas:</strong> registre quanto tem de cada uma para o site ir descontando nas vendas.
          </span>
        ) : faltando.length ? (
          <span>
            <strong>Bebidas acabando:</strong> {faltando.map((i) => `${i.nome} (${Math.max(i.quantidade, 0)})`).join(', ')}
          </span>
        ) : (
          <span>
            <strong>Estoque de bebidas em dia.</strong> {itens.map((i) => `${i.nome} ${i.quantidade}`).join(' · ')}
          </span>
        )}
      </span>
      <span className="shrink-0 font-semibold underline">Ver estoque</span>
    </Link>
  )
}
