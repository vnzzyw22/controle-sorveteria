'use client'

import { AnimatePresence, motion } from 'framer-motion'
import { ChevronDown } from 'lucide-react'
import { useState } from 'react'

/** Mostra os primeiros itens e guarda o resto atrás de um "Ver mais". */
export function ListaVerMais({ itens, visiveis = 3 }: { itens: React.ReactNode[]; visiveis?: number }) {
  const [aberta, setAberta] = useState(false)
  const resto = itens.slice(visiveis)
  return (
    <div className="mt-2 text-sm">
      <ul className="space-y-1.5">
        {itens.slice(0, visiveis).map((item, i) => (
          <li key={i}>{item}</li>
        ))}
      </ul>
      <AnimatePresence initial={false}>
        {aberta && (
          <motion.ul
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="space-y-1.5 overflow-hidden pt-1.5"
          >
            {resto.map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
      {resto.length > 0 && (
        <button
          type="button"
          onClick={() => setAberta((a) => !a)}
          aria-expanded={aberta}
          className="mt-2 inline-flex items-center gap-1 rounded-lg px-1 py-1 font-semibold text-framboesa hover:underline"
        >
          {aberta ? 'Ver menos' : `Ver mais (${resto.length})`}
          <ChevronDown aria-hidden className={`size-4 transition-transform ${aberta ? 'rotate-180' : ''}`} />
        </button>
      )}
    </div>
  )
}
