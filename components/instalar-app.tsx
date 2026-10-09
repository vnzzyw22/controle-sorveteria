'use client'

import { Download } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useToast } from './toast'

interface PromptInstalacao extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

declare global {
  interface Window {
    __pwaPrompt?: PromptInstalacao | null
  }
}

/**
 * Script que roda antes da página carregar: guarda o convite de instalação do Chrome
 * (o evento pode acontecer antes de o botão existir na tela).
 */
export const SCRIPT_CAPTURA_INSTALACAO = `window.addEventListener('beforeinstallprompt',function(e){e.preventDefault();window.__pwaPrompt=e;window.dispatchEvent(new Event('pwa-pronto'))});`

function instalado(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  )
}

function ehIOS(): boolean {
  return /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
}

/** Botão "Instalar app": usa o convite do Chrome/Android; no iPhone, explica o caminho pelo Safari. */
export function InstalarApp({ variante }: { variante: 'barra' | 'icone' }) {
  const [modo, setModo] = useState<'oculto' | 'chrome' | 'ios'>('oculto')
  const toast = useToast()

  useEffect(() => {
    if (instalado()) return
    const atualizar = () => setModo(window.__pwaPrompt ? 'chrome' : ehIOS() ? 'ios' : 'oculto')
    const aoInstalar = () => {
      window.__pwaPrompt = null
      setModo('oculto')
    }
    atualizar()
    window.addEventListener('pwa-pronto', atualizar)
    window.addEventListener('appinstalled', aoInstalar)
    return () => {
      window.removeEventListener('pwa-pronto', atualizar)
      window.removeEventListener('appinstalled', aoInstalar)
    }
  }, [])

  if (modo === 'oculto') return null

  async function instalar() {
    if (modo === 'ios') {
      toast({
        tone: 'sucesso',
        message: 'No iPhone: abra no Safari, toque em Compartilhar (quadrado com seta) e depois em "Adicionar à Tela de Início".',
      })
      return
    }
    const convite = window.__pwaPrompt
    if (!convite) return
    await convite.prompt()
    const { outcome } = await convite.userChoice
    window.__pwaPrompt = null
    setModo('oculto')
    if (outcome === 'accepted') toast({ tone: 'sucesso', message: 'App instalado! Procure o ícone "Caixa" na sua tela.' })
  }

  if (variante === 'icone') {
    return (
      <button
        type="button"
        onClick={instalar}
        className="flex items-center gap-1.5 rounded-xl px-2.5 py-2 text-sm font-semibold text-framboesa hover:bg-superficie"
      >
        <Download aria-hidden className="size-5" />
        Instalar
      </button>
    )
  }
  return (
    <button
      type="button"
      onClick={instalar}
      className="mb-2 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-[15px] font-semibold text-framboesa hover:bg-superficie"
    >
      <Download aria-hidden className="size-5" />
      Instalar app
    </button>
  )
}
