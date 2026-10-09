// Texto do fechamento do dia para mandar no WhatsApp. Sem acesso ao banco: recebe os números prontos.

import { formatDataExtenso } from './dates.ts'
import { FORMAS_ENTRADA, FORMA_LABEL, formatBRL, type FormaEntrada } from './money.ts'
import { PRODUTOS, nomeProduto } from './produtos.ts'

export interface DadosResumoDia {
  data: string
  quantidadeVendas: number
  brutoCentavos: number
  taxaCentavos: number
  liquidoCentavos: number
  saidasCentavos: number
  saldoCentavos: number
  formas: { forma: FormaEntrada; quantidade: number; brutoCentavos: number }[]
  produtos: string[]
  gaveta?: { esperadoCentavos: number; contadoCentavos: number | null } | null
  saldoEmpresaCentavos?: number | null
  estoqueBaixo?: { nome: string; quantidade: number }[]
}

export function montarResumoDia(d: DadosResumoDia): string {
  const linhas = [`🍦 *Caixa da Sorveteria* — ${formatDataExtenso(d.data)}`, '']
  linhas.push(`*Vendas:* ${d.quantidadeVendas} · ${formatBRL(d.brutoCentavos)}`)
  for (const f of FORMAS_ENTRADA) {
    const r = d.formas.find((x) => x.forma === f)
    if (r && r.quantidade) linhas.push(`• ${FORMA_LABEL[f]}: ${formatBRL(r.brutoCentavos)} (${r.quantidade})`)
  }
  if (d.taxaCentavos) linhas.push(`Taxas das maquininhas: − ${formatBRL(d.taxaCentavos)}`)
  linhas.push(`*Entrou (líquido):* ${formatBRL(d.liquidoCentavos)}`)
  linhas.push(`*Saídas do dia:* − ${formatBRL(d.saidasCentavos)}`)
  linhas.push(`*Saldo do dia:* ${formatBRL(d.saldoCentavos)}`)

  const contagem = new Map<string, number>()
  for (const p of d.produtos) contagem.set(p, (contagem.get(p) ?? 0) + 1)
  if (contagem.size) {
    const ordem = PRODUTOS.map((p) => p.id as string)
    const itens = [...contagem.entries()].sort((a, b) => ordem.indexOf(a[0]) - ordem.indexOf(b[0]))
    linhas.push('', '*Produtos:*', ...itens.map(([id, n]) => `• ${nomeProduto(id)}: ${n}`))
  }

  if (d.gaveta) {
    linhas.push('', `*Gaveta:* deveria ter ${formatBRL(d.gaveta.esperadoCentavos)}`)
    if (d.gaveta.contadoCentavos !== null) {
      const dif = d.gaveta.contadoCentavos - d.gaveta.esperadoCentavos
      const resultado = dif === 0 ? 'bateu certinho ✅' : dif > 0 ? `sobrou ${formatBRL(dif)}` : `faltou ${formatBRL(-dif)} ⚠️`
      linhas.push(`Contado: ${formatBRL(d.gaveta.contadoCentavos)} — ${resultado}`)
    } else {
      linhas.push('Caixa ainda aberto (não contado).')
    }
  }
  if (d.estoqueBaixo?.length) {
    linhas.push('', `*Bebidas acabando:* ${d.estoqueBaixo.map((e) => `${e.nome} (${e.quantidade})`).join(', ')}`)
  }
  if (d.saldoEmpresaCentavos !== null && d.saldoEmpresaCentavos !== undefined) {
    linhas.push('', `*Saldo da empresa:* ${formatBRL(d.saldoEmpresaCentavos)}`)
  }
  return linhas.join('\n')
}
