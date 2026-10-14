import { Banknote, Landmark } from 'lucide-react'
import Link from 'next/link'
import { CONTAS, CONTA_LABEL, type Conta } from '@/lib/contas'
import type { SaldoConta, SaldoEmpresa } from '@/lib/data'
import { formatDataCurta } from '@/lib/dates'
import { formatBRL } from '@/lib/money'

const ICONE: Record<Conta, typeof Landmark> = { banco: Landmark, especie: Banknote }
const COR: Record<Conta, string> = { banco: 'bg-framboesa-clara text-framboesa', especie: 'bg-dinheiro-fundo text-dinheiro' }

/** Cartão do Caixa: saldo de cada conta (banco e espécie) informado em Ajustes, com o que entrou e saiu depois. */
export function SaldoEmpresaCartao({ saldo }: { saldo: SaldoEmpresa | null }) {
  if (!saldo) {
    return (
      <Link
        href="/config#saldo"
        className="mb-5 flex items-center gap-3 rounded-2xl border border-dashed border-borda px-4 py-3 text-sm text-cacau-suave hover:bg-superficie hover:text-cacau"
      >
        <Landmark aria-hidden className="size-5 shrink-0" />
        <span>
          Informe <strong>quanto a empresa tem no banco e em dinheiro</strong> em Ajustes para acompanhar o saldo aqui.
        </span>
      </Link>
    )
  }
  return (
    <section aria-labelledby="saldo-empresa-titulo" className="cartao mb-5 p-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
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
        <Link
          href="/entradas/nova"
          className="rounded-xl border border-linha px-4 py-2 text-center text-sm font-semibold text-framboesa hover:border-borda hover:bg-creme-fundo"
        >
          + Entrada de valor
        </Link>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {CONTAS.map((c) => (
          <ContaBloco key={c} conta={c} saldo={saldo.contas[c]} />
        ))}
      </div>
    </section>
  )
}

function ContaBloco({ conta, saldo }: { conta: Conta; saldo: SaldoConta | null }) {
  const Icone = ICONE[conta]
  return (
    <div className="rounded-2xl border border-linha p-4">
      <div className="flex items-center gap-3">
        <span className={`grid size-9 shrink-0 place-items-center rounded-full ${COR[conta]}`}>
          <Icone aria-hidden className="size-4" />
        </span>
        <div className="min-w-0">
          <h3 className="text-sm text-cacau-suave">{CONTA_LABEL[conta]}</h3>
          {saldo ? (
            <p className={`tabular text-xl font-bold ${saldo.atualCentavos < 0 ? 'text-saida' : ''}`}>
              {formatBRL(saldo.atualCentavos)}
            </p>
          ) : (
            <Link href="/config#saldo" className="text-sm font-semibold text-framboesa underline">
              Informar em Ajustes
            </Link>
          )}
        </div>
      </div>
      {saldo && (
        <dl className="mt-3 space-y-1 text-sm">
          <Linha rotulo={`Saldo em ${formatDataCurta(saldo.data)}`} valor={formatBRL(saldo.inicialCentavos)} />
          <Linha
            rotulo={conta === 'banco' ? '+ vendas que já caíram' : '+ vendas em dinheiro'}
            valor={formatBRL(saldo.entradasCentavos)}
            tom="text-entrada"
          />
          <Linha rotulo="+ entradas de valor" valor={formatBRL(saldo.outrasCentavos)} tom="text-entrada" />
          <Linha rotulo="− pagamentos feitos" valor={formatBRL(saldo.saidasCentavos)} tom="text-saida" />
          {conta === 'banco' && <Linha rotulo="a receber (cartão)" valor={formatBRL(saldo.aReceberCentavos)} />}
        </dl>
      )}
    </div>
  )
}

function Linha({ rotulo, valor, tom }: { rotulo: string; valor: string; tom?: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-cacau-suave">{rotulo}</dt>
      <dd className={`tabular ${tom ?? ''}`}>{valor}</dd>
    </div>
  )
}
