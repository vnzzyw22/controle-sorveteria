import assert from 'node:assert/strict'
import { test } from 'node:test'
import { acharTerminal, dataBrasilia, formaDoPagamento, veioDoBalcao, vendaDoPagamento } from '../lib/mp-mapa.ts'

test('Mercado Pago: tipo de pagamento vira forma do sistema', () => {
  assert.equal(formaDoPagamento('credit_card'), 'credito')
  assert.equal(formaDoPagamento('debit_card'), 'debito')
  assert.equal(formaDoPagamento('bank_transfer'), 'pix')
  assert.equal(formaDoPagamento('ticket'), null)
})

test('Mercado Pago: data no horário de Brasília (venda às 22h de Brasília ainda é do mesmo dia)', () => {
  assert.equal(dataBrasilia('2026-10-09T00:30:00.000Z'), '2026-10-08')
  assert.equal(dataBrasilia('2026-10-08T22:00:00.000-03:00'), '2026-10-08')
  assert.equal(dataBrasilia(undefined), null)
})

test('Mercado Pago: pagamento aprovado vira venda com a taxa real cobrada', () => {
  const v = vendaDoPagamento({
    id: 123456789,
    status: 'approved',
    payment_type_id: 'credit_card',
    installments: 3,
    transaction_amount: 100,
    date_approved: '2026-10-08T15:10:00.000-03:00',
    money_release_date: '2026-11-07T15:10:00.000-03:00',
    fee_details: [{ type: 'mercadopago_fee', amount: 4.98, fee_payer: 'collector' }],
    transaction_details: { net_received_amount: 95.02 },
  })
  assert.ok(!('ignorar' in v))
  assert.deepEqual(v, {
    mpPaymentId: '123456789',
    forma: 'credito',
    parcelas: 3,
    brutoCentavos: 10000,
    taxaCentavos: 498,
    liquidoCentavos: 9502,
    taxaPercentual: 4.98,
    data: '2026-10-08',
    dataRecebimento: '2026-11-07',
  })
})

test('Mercado Pago: sem líquido informado, desconta só a taxa paga pela loja', () => {
  const v = vendaDoPagamento({
    id: 'x1',
    status: 'approved',
    payment_type_id: 'debit_card',
    transaction_amount: 20,
    fee_details: [
      { amount: 0.4, fee_payer: 'collector' },
      { amount: 1, fee_payer: 'payer' },
    ],
  })
  assert.ok(!('ignorar' in v))
  assert.equal(v.taxaCentavos, 40)
  assert.equal(v.liquidoCentavos, 1960)
  assert.equal(v.parcelas, 1)
})

test('Mercado Pago: pagamento não aprovado ou de outro tipo não vira venda', () => {
  assert.ok('ignorar' in vendaDoPagamento({ id: 1, status: 'rejected', payment_type_id: 'credit_card', transaction_amount: 10 }))
  assert.ok('ignorar' in vendaDoPagamento({ id: 1, status: 'approved', payment_type_id: 'ticket', transaction_amount: 10 }))
})

test('Mercado Pago: acha a maquininha pelo número da etiqueta ou pelo id completo', () => {
  const lista = [{ id: 'PAX_A910__SMARTPOS1495357742' }, { id: 'NEWLAND_N950__N950NCB801734178471' }]
  assert.equal(acharTerminal(lista, '1734178471')?.id, 'NEWLAND_N950__N950NCB801734178471')
  assert.equal(acharTerminal(lista, 'PAX_A910__SMARTPOS1495357742')?.id, 'PAX_A910__SMARTPOS1495357742')
  assert.equal(acharTerminal(lista, '999'), null)
  assert.equal(acharTerminal([lista[0]], '')?.id, lista[0].id)
})

test('Mercado Pago: só pagamentos do balcão viram venda (cartão na Point, Pix/QR na loja, cobrança do sistema)', () => {
  assert.ok(veioDoBalcao({ point_of_interaction: { type: 'POINT' } }))
  assert.ok(veioDoBalcao({ point_of_interaction: { type: 'INSTORE' } }))
  assert.ok(veioDoBalcao({ external_reference: 'sorveteria-123' }))
  assert.ok(!veioDoBalcao({ point_of_interaction: { type: 'PIX_TRANSFER' } }))
  assert.ok(!veioDoBalcao({}))
})
