import assert from 'node:assert/strict'
import { test } from 'node:test'
import { montarResumoDia } from '../lib/resumo-dia.ts'

test('resumo do dia para o WhatsApp', () => {
  const texto = montarResumoDia({
    data: '2026-10-09',
    quantidadeVendas: 3,
    brutoCentavos: 3499,
    taxaCentavos: 50,
    liquidoCentavos: 3449,
    saidasCentavos: 1000,
    saldoCentavos: 2449,
    formas: [
      { forma: 'dinheiro', quantidade: 2, brutoCentavos: 1999 },
      { forma: 'credito', quantidade: 1, brutoCentavos: 1500 },
    ],
    produtos: ['red_bull', 'cascao_1', 'self_service', 'cascao_1'],
    gaveta: { esperadoCentavos: 6999, contadoCentavos: 6899 },
    saldoEmpresaCentavos: 309249,
    estoqueBaixo: [{ nome: 'Red Bull', quantidade: 2 }],
  }).replace(/ /g, ' ')
  assert.match(texto, /Sexta-feira, 9 de outubro/)
  assert.match(texto, /\*Vendas:\* 3 · R\$ 34,99/)
  assert.match(texto, /• Dinheiro: R\$ 19,99 \(2\)/)
  assert.match(texto, /• Crédito: R\$ 15,00 \(1\)/)
  assert.doesNotMatch(texto, /Pix/)
  assert.match(texto, /Self-service: 1\n• Cascão 1 bola: 2\n.*\n?• Red Bull: 1/)
  assert.match(texto, /faltou R\$ 1,00/)
  assert.match(texto, /Bebidas acabando:\* Red Bull \(2\)/)
  assert.match(texto, /Saldo da empresa:\* R\$ 3\.092,49/)
})
