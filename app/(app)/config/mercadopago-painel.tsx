import { CheckCircle2, CircleDashed, TriangleAlert } from 'lucide-react'
import { headers } from 'next/headers'
import { formatHora, formatDataCurta, hoje } from '@/lib/dates'
import { buscarTerminal, contaDoToken, mpConfig, ultimosEventos, type ContaMP, type Terminal } from '@/lib/mercadopago'
import { BuscarVendasBotao } from './buscar-vendas-botao'

function Item({ ok, aviso, titulo, children }: { ok: boolean; aviso?: boolean; titulo: string; children: React.ReactNode }) {
  const Icone = ok ? CheckCircle2 : aviso ? TriangleAlert : CircleDashed
  return (
    <li className="flex gap-3 py-3">
      <Icone aria-hidden className={`mt-0.5 size-5 shrink-0 ${ok ? 'text-entrada' : aviso ? 'text-alerta' : 'text-cacau-suave'}`} />
      <div className="min-w-0">
        <p className="font-semibold">{titulo}</p>
        <div className="mt-0.5 break-words text-sm text-cacau-suave">{children}</div>
      </div>
    </li>
  )
}

/** Situação da integração com a maquininha Mercado Pago (Point). */
export async function MercadoPagoPainel() {
  const cfg = mpConfig()
  const h = await headers()
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? 'seu-site.vercel.app'
  const webhook = `https://${host}/api/mercadopago/webhook`

  let terminal: Terminal | null = null
  let todos: Terminal[] = []
  let erroTerminal: string | undefined
  let conta: ContaMP | undefined
  let erroConta: string | undefined
  if (cfg.token) {
    try {
      ;({ terminal, todos, erro: erroTerminal } = await buscarTerminal())
    } catch (error) {
      erroTerminal = error instanceof Error ? error.message : 'Falha ao falar com o Mercado Pago.'
    }
    try {
      ;({ conta, erro: erroConta } = await contaDoToken())
    } catch (error) {
      erroConta = error instanceof Error ? error.message : 'Falha ao consultar a conta.'
    }
  }
  const contaDeTeste = conta?.tags?.some((t) => /test/i.test(t)) ?? false
  const eventos = await ultimosEventos(8).catch(() => [])
  const hojeIso = hoje()

  return (
    <section aria-labelledby="mp-titulo" className="cartao p-5">
      <h2 id="mp-titulo" className="font-display text-lg font-bold">
        Maquininha Mercado Pago
      </h2>
      <p className="mt-1 text-sm text-cacau-suave">
        Com isto configurado, dá para cobrar na maquininha direto da tela de venda, e as vendas feitas na própria maquininha
        entram sozinhas no caixa.
      </p>

      <ul className="mt-2 divide-y divide-linha">
        <Item ok={!!cfg.token && !!conta && !contaDeTeste} aviso={!!cfg.token && (!conta || contaDeTeste)} titulo="Token de acesso">
          {!cfg.token ? (
            'Falta preencher MERCADOPAGO_ACCESS_TOKEN (painel do Mercado Pago > Suas integrações > Credenciais de produção).'
          ) : conta ? (
            <>
              Conta do token: <strong className="text-cacau">{conta.nickname ?? 'sem apelido'}</strong>
              {conta.email ? ` (${conta.email})` : ''} · ID {conta.id}. Confira se é a mesma conta logada na maquininha.
              {contaDeTeste && (
                <strong className="block text-alerta">
                  Este token é de um usuário de TESTE: ele nunca enxerga as vendas reais. Use as credenciais de produção da
                  conta real.
                </strong>
              )}
            </>
          ) : (
            (erroConta ?? 'Não foi possível consultar a conta do token.')
          )}
        </Item>
        <Item ok={!!terminal} aviso={!!cfg.token && !terminal} titulo="Maquininha">
          {!cfg.token ? (
            `Será procurada pelo número ${cfg.terminal || '(não informado)'} quando o token for configurado.`
          ) : terminal ? (
            <>
              Encontrada: <code className="text-cacau">{terminal.id}</code>.{' '}
              {terminal.operating_mode === 'PDV'
                ? 'Modo PDV (integrado): pronta para receber cobranças do sistema.'
                : `Modo ${terminal.operating_mode ?? 'desconhecido'}: para cobrar pelo sistema, ela precisa estar no modo PDV.`}
            </>
          ) : (
            <>
              {erroTerminal}
              {todos.length > 0 && (
                <> Maquininhas na conta: {todos.map((t) => t.id).join(', ')}. Ajuste MERCADOPAGO_POINT_TERMINAL.</>
              )}
            </>
          )}
        </Item>
        <Item ok={!!cfg.segredoWebhook} titulo="Aviso automático (webhook)">
          {cfg.segredoWebhook ? 'Assinatura secreta configurada.' : 'Falta preencher MERCADOPAGO_WEBHOOK_SECRET.'} No painel do
          Mercado Pago (Suas integrações &gt; Webhooks), cadastre o endereço{' '}
          <code className="break-all text-cacau">{webhook}</code> e marque os eventos <strong>Pagamentos</strong> e{' '}
          <strong>Order (Mercado Pago)</strong>.
        </Item>
      </ul>

      {cfg.token && (
        <div className="mt-3 flex flex-col gap-2 border-t border-linha pt-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-cacau-suave">Faltou alguma venda feita na maquininha hoje? Busque no Mercado Pago.</p>
          <BuscarVendasBotao />
        </div>
      )}

      {eventos.length > 0 && (
        <div className="mt-4 border-t border-linha pt-4">
          <h3 className="text-sm font-semibold">Últimos avisos do Mercado Pago</h3>
          <ul className="mt-2 space-y-1.5 text-sm">
            {eventos.map((e, i) => {
              const dia = hoje(e.recebido_em)
              return (
                <li key={i} className="rounded-lg bg-creme-fundo px-3 py-2">
                  <span className="tabular text-cacau-suave">
                    {dia === hojeIso ? 'hoje' : formatDataCurta(dia)} {formatHora(e.recebido_em)} · {e.tipo}
                  </span>
                  <span className="block break-words">{e.resultado}</span>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </section>
  )
}
