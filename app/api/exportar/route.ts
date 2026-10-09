import { isAuthenticated } from '@/lib/auth'
import { listSaidas, listVendas } from '@/lib/data'
import { formatData } from '@/lib/dates'
import { parseFiltroSaidas, parseFiltroVendas } from '@/lib/filters'
import { FORMA_LABEL } from '@/lib/money'
import { nomeProduto } from '@/lib/produtos'

export const dynamic = 'force-dynamic'

// Planilha no padrão do Excel brasileiro: separador ";" e vírgula decimal.
function valor(centavos: number): string {
  const negative = centavos < 0
  const abs = Math.abs(centavos)
  return `${negative ? '-' : ''}${Math.floor(abs / 100)},${String(abs % 100).padStart(2, '0')}`
}

function celula(value: string | number | null | undefined): string {
  const s = value === null || value === undefined ? '' : String(value)
  // Aspas sempre; evita também que o Excel interprete "=..." como fórmula.
  const safe = /^[=+\-@]/.test(s) && !/^-?\d/.test(s) ? `'${s}` : s
  return `"${safe.replace(/"/g, '""')}"`
}

function csv(rows: (string | number | null | undefined)[][]): string {
  return '﻿' + rows.map((r) => r.map(celula).join(';')).join('\r\n')
}

export async function GET(request: Request) {
  if (!(await isAuthenticated())) {
    return Response.json({ erro: 'Não autenticado' }, { status: 401 })
  }
  const url = new URL(request.url)
  const params = Object.fromEntries(url.searchParams)
  const aba = params.aba === 'saidas' ? 'saidas' : 'vendas'

  let body: string
  let nome: string
  if (aba === 'vendas') {
    const filtro = parseFiltroVendas(params)
    const { vendas } = await listVendas(filtro, { all: true })
    nome = `vendas_${filtro.de}_a_${filtro.ate}.csv`
    body = csv([
      ['Nº', 'Data', 'Produto', 'Forma', 'Parcelas', 'Maquininha', 'Observação', 'Bruto', 'Taxa %', 'Taxa R$', 'Líquido', 'Recebimento'],
      ...vendas.map((v) => [
        v.id,
        formatData(v.data),
        nomeProduto(v.produto),
        FORMA_LABEL[v.forma],
        v.parcelas,
        v.maquininhaNome,
        v.descricao,
        valor(v.brutoCentavos),
        v.taxaPercentual.toFixed(2).replace('.', ','),
        valor(v.taxaCentavos),
        valor(v.liquidoCentavos),
        formatData(v.dataRecebimento),
      ]),
    ])
  } else {
    const filtro = parseFiltroSaidas(params)
    const { saidas } = await listSaidas(filtro, { all: true })
    nome = `saidas_${filtro.de}_a_${filtro.ate}.csv`
    body = csv([
      ['Nº', 'Data da compra', 'Descrição', 'Categoria', 'Fornecedor', 'Forma', 'Condição', 'Parcela', 'Vencimento', 'Valor da parcela', 'Pago em', 'Total da compra'],
      ...saidas.flatMap((s) =>
        s.parcelas.map((p) => [
          s.id,
          formatData(s.data),
          s.descricao,
          s.categoria,
          s.fornecedor,
          FORMA_LABEL[s.forma],
          s.condicao === 'parcelado' ? 'Parcelado' : 'À vista',
          `${p.numero}/${s.numParcelas}`,
          formatData(p.vencimento),
          valor(p.valorCentavos),
          p.pagoEm ? formatData(p.pagoEm) : '',
          valor(s.totalCentavos),
        ]),
      ),
    ])
  }

  return new Response(body, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${nome}"`,
      'Cache-Control': 'no-store',
    },
  })
}
