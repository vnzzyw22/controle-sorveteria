import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // O driver do Postgres roda só no servidor e não deve passar pelo bundler.
  serverExternalPackages: ['pg'],
}

export default nextConfig
