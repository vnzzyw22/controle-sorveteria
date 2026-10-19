import { NextResponse, type NextRequest } from 'next/server'
import { mpPronto, sincronizarRecentes } from '@/lib/mercadopago'
import { chaveDespertadorConfere } from '@/lib/session'

// "Despertador": um serviço externo grátis (ex.: cron-job.org) chama este endereço a cada minuto, então as vendas
// da maquininha entram no caixa mesmo com o site fechado. Fica fora do login da loja; a segurança é a chave
// do endereço (mostrada em Ajustes), e a resposta não traz nenhum dado da loja.
export const dynamic = 'force-dynamic'

async function despertar(request: NextRequest) {
  const url = new URL(request.url)
  const bearer = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? null
  if (!(await chaveDespertadorConfere(url.searchParams.get('chave') ?? bearer))) {
    return NextResponse.json({ ok: false, erro: 'Chave inválida.' }, { status: 401 })
  }
  if (!mpPronto()) return NextResponse.json({ ok: false, erro: 'Mercado Pago não configurado.' }, { status: 503 })
  try {
    const r = await sincronizarRecentes()
    return NextResponse.json({ ok: true, ...r })
  } catch (error) {
    console.error('Despertador falhou:', error instanceof Error ? error.message : error)
    return NextResponse.json({ ok: false, erro: 'Falha ao buscar as vendas.' }, { status: 502 })
  }
}

export const GET = despertar
export const POST = despertar
