// Sessão simples por senha única da loja. O cookie guarda a validade assinada com HMAC-SHA256;
// usa só Web Crypto para funcionar tanto no proxy quanto nas Server Actions.

export const SESSION_COOKIE = 'sorveteria_sessao'
export const SESSION_DAYS = 30

const encoder = new TextEncoder()

function secret(): string | null {
  const explicit = process.env.SESSION_SECRET
  if (explicit) return explicit
  const password = process.env.APP_PASSWORD
  return password ? `sorveteria-sessao:${password}` : null
}

async function hmac(key: string, message: string): Promise<string> {
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    encoder.encode(key),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const signature = await crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(message))
  return Array.from(new Uint8Array(signature), (b) => b.toString(16).padStart(2, '0')).join('')
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

export async function createSessionToken(now = Date.now()): Promise<{ token: string; expires: Date }> {
  const key = secret()
  if (!key) throw new Error('APP_PASSWORD não configurada')
  const expires = new Date(now + SESSION_DAYS * 24 * 60 * 60 * 1000)
  const payload = `v1.${expires.getTime()}`
  return { token: `${payload}.${await hmac(key, payload)}`, expires }
}

export async function verifySessionToken(token: string | undefined, now = Date.now()): Promise<boolean> {
  const key = secret()
  if (!key || !token) return false
  const parts = token.split('.')
  if (parts.length !== 3 || parts[0] !== 'v1') return false
  const expires = Number(parts[1])
  if (!Number.isFinite(expires) || expires < now) return false
  return safeEqual(parts[2], await hmac(key, `v1.${parts[1]}`))
}

export async function passwordMatches(input: string): Promise<boolean> {
  const expected = process.env.APP_PASSWORD
  if (!expected) return false
  // Compara os hashes para não vazar o tamanho da senha pelo tempo de resposta.
  const [a, b] = await Promise.all([hmac('cmp', input), hmac('cmp', expected)])
  return safeEqual(a, b)
}
