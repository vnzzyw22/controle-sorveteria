// Cria as tabelas no banco apontado por DATABASE_URL (opcional: o sistema também faz isso sozinho).
// Uso: DATABASE_URL=... npm run db:setup
import pg from 'pg'
import { SCHEMA_SQL } from '../lib/schema.ts'

const connectionString = process.env.DATABASE_URL
if (!connectionString) {
  console.error('Defina DATABASE_URL antes de rodar.')
  process.exit(1)
}

const client = new pg.Client({ connectionString })
await client.connect()
try {
  await client.query(SCHEMA_SQL)
  console.log('Tabelas prontas.')
} finally {
  await client.end()
}
