import 'server-only'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { SESSION_COOKIE, verifySessionToken } from './session'

export async function isAuthenticated(): Promise<boolean> {
  const store = await cookies()
  return verifySessionToken(store.get(SESSION_COOKIE)?.value)
}

/** Use no início de toda página protegida e de toda Server Action. */
export async function requireAuth(): Promise<void> {
  if (!(await isAuthenticated())) redirect('/login')
}
