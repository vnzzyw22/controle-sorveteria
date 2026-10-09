import { Landmark } from 'lucide-react'
import Link from 'next/link'
import type { SaldoEmpresa } from '@/lib/data'
import { formatDataCurta } from '@/lib/dates'
import { formatBRL } from '@/lib/money'

/** Cartão do Caixa: saldo informado em Ajustes + vendas que já caíram + entradas de valor − pagamentos feitos depois. */
export function SaldoEmpresaCartao({ saldo }: { saldo: SaldoEmpresa | null }) {
  if (!saldo) {
    return (
      <Link
        href="/config#saldo"
        className="mb-5 flex items-center gap-3 rounded-2xl border border-dashed border-borda px-4 py-3 text-sm text-cacau-suave hover:bg-superficie hover:text-cacau"
      >
        <Landmark aria-hidden className="size-5 shrink-0" />
        <span>
          Informe <strong>quanto a empresa tem hoje</strong> em Ajustes para acompanhar o saldo aqui.
        </span>
      </Link>
    )
  }
  return (
    <section aria-labelledby="saldo-empresa-titulo" className="cartao mb-5 flex flex-wrap items-center justify-between gap-4 p-5">
      <div className="flex items-center gap-3">
        <span className="grid size-11 place-items-center rounded-full bg-framboesa-clara text-framboesa">
          <Landmark aria-hidden className="size-5" />
        </span>
        <div>
          <h2 id="saldo-empresa-titulo" className="text-sm text-cacau-suave">
            Saldo da empresa
          </h2>
          <p
            className={`tabular font-display text-[28px] font-bold leading-tight tracking-tight ${
              saldo.atualCentavos < 0 ? 'text-saida' : ''
            }`}
          >
            {formatBRL(saldo.atualCentavos)}
          </p>
        </div>
      </div>
      <dl className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
        <div className="flex justify-between gap-3">
          <dt className="text-cacau-suave">Saldo em {formatDataCurta(saldo.data)}</dt>
          <dd className="tabular">{formatBRL(saldo.inicialCentavos)}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-cacau-suave">+ vendas que já caíram</dt>
          <dd className="tabular text-entrada">{formatBRL(saldo.entradasCentavos)}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-cacau-suave">+ entradas de valor</dt>
          <dd className="tabular text-entrada">{formatBRL(saldo.outrasCentavos)}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-cacau-suave">− pagamentos feitos</dt>
          <dd className="tabular text-saida">{formatBRL(saldo.saidasCentavos)}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-cacau-suave">a receber (cartão)</dt>
          <dd className="tabular">{formatBRL(saldo.aReceberCentavos)}</dd>
        </div>
      </dl>
      <Link
        href="/entradas/nova"
        className="w-full rounded-xl border border-linha px-4 py-2 text-center text-sm font-semibold text-framboesa hover:border-borda hover:bg-creme-fundo sm:w-auto"
      >
        + Entrada de valor
      </Link>
    </section>
  )
}
