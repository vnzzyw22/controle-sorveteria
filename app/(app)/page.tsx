import { ArrowDownCircle, ArrowUpCircle, ChevronLeft, ChevronRight } from 'lucide-react'
import Link from 'next/link'
import { getCaixaDoDia } from '@/lib/data'
import { addDays, formatData, formatDataExtenso, hoje, isIsoDate } from '@/lib/dates'
import { formatBRL } from '@/lib/money'
import { CaixaDoDia } from './caixa-do-dia'

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const params = await searchParams
  const today = hoje()
  const data = isIsoDate(params.data) && params.data <= today ? params.data : today
  const caixa = await getCaixaDoDia(data)
  const ehHoje = data === today

  return (
    <>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-cacau-suave">{formatDataExtenso(data)}</p>
          <h1 className="font-display text-[28px] font-bold leading-tight tracking-tight sm:text-[32px]">
            {ehHoje ? 'Caixa de hoje' : `Caixa de ${formatData(data)}`}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <nav aria-label="Escolher dia" className="flex items-center rounded-xl border border-linha bg-superficie">
            <Link
              href={`/?data=${addDays(data, -1)}`}
              aria-label="Dia anterior"
              className="rounded-l-xl p-2.5 text-cacau-suave hover:bg-creme-fundo hover:text-cacau"
            >
              <ChevronLeft aria-hidden className="size-5" />
            </Link>
            <form action="/" className="border-x border-linha">
              <label htmlFor="dia" className="sr-only">
                Data
              </label>
              <input
                id="dia"
                name="data"
                type="date"
                max={today}
                defaultValue={data}
                className="tabular bg-transparent px-2 py-2 text-sm outline-none"
              />
              <button type="submit" className="sr-only">
                Ver dia
              </button>
            </form>
            {ehHoje ? (
              <span aria-hidden className="p-2.5 text-linha">
                <ChevronRight className="size-5" />
              </span>
            ) : (
              <Link
                href={`/?data=${addDays(data, 1)}`}
                aria-label="Próximo dia"
                className="rounded-r-xl p-2.5 text-cacau-suave hover:bg-creme-fundo hover:text-cacau"
              >
                <ChevronRight aria-hidden className="size-5" />
              </Link>
            )}
          </nav>
          {!ehHoje && (
            <Link href="/" className="rounded-xl px-3 py-2.5 text-sm font-semibold text-framboesa hover:bg-superficie">
              Hoje
            </Link>
          )}
        </div>
      </div>

      {caixa.atrasadas.quantidade > 0 && (
        <Link
          href="/historico?aba=contas"
          className="mb-5 flex items-center justify-between gap-3 rounded-2xl bg-alerta-fundo px-4 py-3 text-sm text-alerta hover:brightness-[0.98]"
        >
          <span>
            <strong className="font-semibold">
              {caixa.atrasadas.quantidade} {caixa.atrasadas.quantidade === 1 ? 'conta vencida' : 'contas vencidas'}
            </strong>{' '}
            sem pagamento marcado ({formatBRL(caixa.atrasadas.totalCentavos)}).
          </span>
          <span className="shrink-0 font-semibold underline">Ver contas</span>
        </Link>
      )}

      <div className="mb-6 grid grid-cols-2 gap-3 sm:flex">
        <Link
          href="/vendas/nova"
          className="flex items-center justify-center gap-2 rounded-xl bg-framboesa px-5 py-3 font-semibold text-white shadow-sm shadow-framboesa/30 transition-colors hover:bg-framboesa-escura"
        >
          <ArrowDownCircle aria-hidden className="size-5" />
          Lançar venda
        </Link>
        <Link
          href="/saidas/nova"
          className="flex items-center justify-center gap-2 rounded-xl border border-linha bg-superficie px-5 py-3 font-semibold text-cacau transition-colors hover:border-borda"
        >
          <ArrowUpCircle aria-hidden className="size-5" />
          Lançar saída
        </Link>
      </div>

      <CaixaDoDia caixa={caixa} data={data} />
    </>
  )
}
