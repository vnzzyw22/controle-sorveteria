import { InvalidWebhookSignatureError, SignatureFailureReason, WebhookSignatureValidator } from 'mercadopago'
import { NextResponse, type NextRequest } from 'next/server'
import { mpConfig, processarOrder, processarPagamento, registrarEvento } from '@/lib/mercadopago'

// Aviso automático do Mercado Pago (webhook). Fica fora do login da loja, então a segurança é:
// 1) a assinatura x-signature tem que bater com o segredo (MERCADOPAGO_WEBHOOK_SECRET);
// 2) o corpo do aviso nunca é usado como verdade: o pagamento/cobrança é buscado de novo na API com o token.
export async function POST(request: NextRequest) {
  const { token, segredoWebhook } = mpConfig()
  if (!token || !segredoWebhook) {
    return NextResponse.json({ erro: 'Integração com o Mercado Pago ainda não configurada.' }, { status: 503 })
  }

  const url = new URL(request.url)
  const corpo = (await request.json().catch(() => ({}))) as { type?: string; data?: { id?: string | number } }
  const dataId = url.searchParams.get('data.id') ?? (corpo.data?.id !== undefined ? String(corpo.data.id) : null)
  const tipo = url.searchParams.get('type') ?? corpo.type ?? url.searchParams.get('topic') ?? 'desconhecido'

  const xSignature = request.headers.get('x-signature')
  try {
    WebhookSignatureValidator.validate({
      xSignature,
      xRequestId: request.headers.get('x-request-id'),
      // A documentação do Mercado Pago manda usar o id em minúsculas quando ele tem letras (ex.: cobranças "ORD...").
      dataId: dataId?.toLowerCase() ?? null,
      secret: segredoWebhook,
    })
    // Aviso antigo reenviado (replay) é recusado. O horário pode vir em segundos ou em milissegundos,
    // por isso a checagem é feita aqui e não pelo SDK (que supõe segundos).
    const ts = Number(/(?:^|,)\s*ts=(\d+)/.exec(xSignature ?? '')?.[1])
    const tsMs = ts > 1e12 ? ts : ts * 1000
    if (!Number.isFinite(tsMs) || Math.abs(Date.now() - tsMs) > 10 * 60_000) {
      throw new InvalidWebhookSignatureError(SignatureFailureReason.TimestampOutOfTolerance)
    }
  } catch (error) {
    const motivo = error instanceof InvalidWebhookSignatureError ? error.reason : 'erro na validação'
    await registrarEvento(tipo, dataId, `recusado: assinatura inválida (${motivo})`).catch(() => {})
    return NextResponse.json({ erro: 'Assinatura inválida.' }, { status: 401 })
  }

  if (!dataId) {
    await registrarEvento(tipo, null, 'ignorado: aviso sem id').catch(() => {})
    return NextResponse.json({ ok: true })
  }

  try {
    const resultado =
      tipo === 'payment'
        ? await processarPagamento(dataId)
        : tipo === 'order'
          ? await processarOrder(dataId)
          : `ignorado: tipo de aviso ${tipo}`
    await registrarEvento(tipo, dataId, resultado)
    return NextResponse.json({ ok: true })
  } catch (error) {
    // Erro passageiro (Mercado Pago ou banco fora do ar): responde 500 para o Mercado Pago tentar de novo.
    const msg = error instanceof Error ? error.message : String(error)
    await registrarEvento(tipo, dataId, `erro: ${msg}`).catch(() => {})
    return NextResponse.json({ erro: 'Falha ao processar o aviso.' }, { status: 500 })
  }
}
