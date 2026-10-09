import type { Metadata, Viewport } from 'next'
import { Bricolage_Grotesque, Inter } from 'next/font/google'
import { Providers } from '@/components/providers'
import { SCRIPT_CAPTURA_INSTALACAO } from '@/components/instalar-app'
import './globals.css'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' })
const bricolage = Bricolage_Grotesque({ subsets: ['latin'], variable: '--font-bricolage', display: 'swap' })

export const metadata: Metadata = {
  title: { default: 'Caixa da Sorveteria', template: '%s · Caixa da Sorveteria' },
  description: 'Fluxo de caixa: vendas, taxas das maquininhas e saídas do dia.',
  robots: { index: false, follow: false },
  applicationName: 'Caixa da Sorveteria',
  appleWebApp: { capable: true, title: 'Caixa', statusBarStyle: 'default' },
  icons: {
    icon: [
      { url: '/icon.svg', type: 'image/svg+xml' },
      { url: '/icons/favicon-32.png', sizes: '32x32', type: 'image/png' },
      { url: '/favicon.ico', sizes: '16x16 32x32 48x48' },
    ],
    shortcut: '/favicon.ico',
    apple: '/icons/apple-touch-icon.png',
  },
}

export const viewport: Viewport = {
  themeColor: '#fbf6ee',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${inter.variable} ${bricolage.variable}`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: SCRIPT_CAPTURA_INSTALACAO }} />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
