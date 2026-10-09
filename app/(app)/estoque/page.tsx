import type { Metadata } from 'next'
import { getEstoque, getMovimentosEstoque } from '@/lib/data'
import { PageHeader } from '@/components/ui'
import { EstoqueClient } from './estoque-client'

export const metadata: Metadata = { title: 'Estoque de bebidas' }

export default async function EstoquePage() {
  const [itens, movimentos] = await Promise.all([getEstoque(), getMovimentosEstoque()])
  return (
    <>
      <PageHeader
        title="Estoque de bebidas"
        description="Cada venda de bebida tira 1 do estoque sozinha. Aqui você registra o que chegou e corrige depois de contar."
      />
      <EstoqueClient itens={itens} movimentos={movimentos} />
    </>
  )
}
