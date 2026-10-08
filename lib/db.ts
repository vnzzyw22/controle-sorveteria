import 'server-only'
import { Pool, types, type PoolClient, type QueryResultRow } from 'pg'
import { SCHEMA_SQL } from './schema'

// DATE (1082) volta como texto "AAAA-MM-DD"; sem isso o driver converte para Date no fuso do servidor.
types.setTypeParser(1082, (value) => value)
// NUMERIC (1700) continua como texto e é convertido para centavos em lib/money.ts.

declare global {
  // Reaproveita o pool entre recarregamentos em desenvolvimento.
  var __sorveteriaPool: Pool | undefined
  var __sorveteriaSchema: Promise<void> | undefined
}

function getPool(): Pool {
  if (!globalThis.__sorveteriaPool) {
    const connectionString = process.env.DATABASE_URL
    if (!connectionString) {
      throw new Error('DATABASE_URL não configurada. Veja o README para conectar o Neon.')
    }
    const pool = new Pool({ connectionString, max: 5, idleTimeoutMillis: 10_000 })
    // O Neon desliga conexões ociosas quando o banco "dorme"; sem este handler o processo cairia.
    pool.on('error', (error) => console.error('Conexão ociosa com o banco encerrada:', error.message))
    globalThis.__sorveteriaPool = pool
  }
  return globalThis.__sorveteriaPool
}

// Trava para impedir que duas instâncias criem as tabelas ao mesmo tempo.
const SCHEMA_LOCK_ID = 727_001

function ensureSchema(): Promise<void> {
  if (!globalThis.__sorveteriaSchema) {
    globalThis.__sorveteriaSchema = (async () => {
      const client = await getPool().connect()
      try {
        await client.query('BEGIN')
        await client.query('SELECT pg_advisory_xact_lock($1)', [SCHEMA_LOCK_ID])
        await client.query(SCHEMA_SQL)
        await client.query('COMMIT')
      } catch (error) {
        await client.query('ROLLBACK').catch(() => {})
        throw error
      } finally {
        client.release()
      }
    })().catch((error) => {
      globalThis.__sorveteriaSchema = undefined
      throw error
    })
  }
  return globalThis.__sorveteriaSchema
}

export async function query<T extends QueryResultRow>(text: string, params: unknown[] = []): Promise<T[]> {
  await ensureSchema()
  const result = await getPool().query<T>(text, params)
  return result.rows
}

export async function transaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  await ensureSchema()
  const client = await getPool().connect()
  try {
    await client.query('BEGIN')
    const result = await fn(client)
    await client.query('COMMIT')
    return result
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {})
    throw error
  } finally {
    client.release()
  }
}
