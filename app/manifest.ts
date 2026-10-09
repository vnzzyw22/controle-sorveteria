import type { MetadataRoute } from 'next'

// Torna o site instalável ("Instalar app" no Chrome / "Adicionar à tela de início" no celular).
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: 'Caixa da Sorveteria',
    short_name: 'Caixa',
    description: 'Fluxo de caixa da sorveteria: vendas, maquininhas, saídas e saldo.',
    lang: 'pt-BR',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#fbf6ee',
    theme_color: '#fbf6ee',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    // Atalhos ao segurar o ícone do app.
    shortcuts: [
      { name: 'Lançar venda', url: '/vendas/nova', icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }] },
      { name: 'Lançar saída', url: '/saidas/nova', icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }] },
      { name: 'Histórico', url: '/historico', icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }] },
    ],
  }
}
