import { NextResponse, type NextRequest } from 'next/server'
import { SESSION_COOKIE, verifySessionToken } from './lib/session'

// Checagem otimista: redireciona quem não está logado. As páginas e ações
// conferem a sessão de novo no servidor (lib/auth.ts).
export async function proxy(request: NextRequest) {
  const ok = await verifySessionToken(request.cookies.get(SESSION_COOKIE)?.value)
  if (ok) return NextResponse.next()

  if (request.nextUrl.pathname.startsWith('/api/')) {
    return NextResponse.json({ erro: 'Não autenticado' }, { status: 401 })
  }
  return NextResponse.redirect(new URL('/login', request.url))
}

export const config = {
  // O webhook do Mercado Pago fica de fora: ele se protege pela assinatura (app/api/mercadopago/webhook).
  matcher: ['/((?!login|api/mercadopago/webhook|_next/static|_next/image|favicon.ico|icon.svg).*)'],
}
