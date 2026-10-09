import assert from 'node:assert/strict'
import { test } from 'node:test'
import { addDays, addMonths, hoje, isIsoDate } from '../lib/dates.ts'
import {
  calcularTaxa,
  centsToDecimal,
  decimalToCents,
  dividirParcelas,
  formatBRL,
  parseBRLInput,
} from '../lib/money.ts'

test('taxa da maquininha é arredondada ao centavo', () => {
  assert.deepEqual(calcularTaxa(5000, 3.15), { taxaCentavos: 158, liquidoCentavos: 4842 })
  assert.deepEqual(calcularTaxa(1000, 1.99), { taxaCentavos: 20, liquidoCentavos: 980 })
  assert.deepEqual(calcularTaxa(2000, 0), { taxaCentavos: 0, liquidoCentavos: 2000 })
  // Em ponto flutuante, 1000 * 1.15 / 100 = 11.4999… (arredondaria para 11); a conta em inteiros dá 11,5 -> 12
  assert.deepEqual(calcularTaxa(1000, 1.15), { taxaCentavos: 12, liquidoCentavos: 988 })
})

test('parcelas: a última recebe os centavos que sobram', () => {
  assert.deepEqual(dividirParcelas(10000, 3), [3333, 3333, 3334])
  assert.deepEqual(dividirParcelas(90000, 3), [30000, 30000, 30000])
  assert.deepEqual(dividirParcelas(500, 1), [500])
  assert.equal(dividirParcelas(123457, 7).reduce((a, b) => a + b), 123457)
  assert.throws(() => dividirParcelas(100, 0))
})

test('conversão entre centavos e NUMERIC do banco', () => {
  assert.equal(decimalToCents('12.50'), 1250)
  assert.equal(decimalToCents('12.5'), 1250)
  assert.equal(decimalToCents('0.07'), 7)
  assert.equal(decimalToCents('-3.10'), -310)
  assert.equal(decimalToCents(null), 0)
  assert.equal(centsToDecimal(1250), '12.50')
  assert.equal(centsToDecimal(7), '0.07')
  assert.equal(centsToDecimal(-310), '-3.10')
})

test('leitura de valores digitados no formato brasileiro', () => {
  assert.equal(parseBRLInput('1.234,56'), 123456)
  assert.equal(parseBRLInput('R$ 12,5'), 1250)
  assert.equal(parseBRLInput('12'), 1200)
  assert.equal(parseBRLInput('1.000'), 100000)
  assert.equal(parseBRLInput('abc'), null)
  assert.equal(parseBRLInput(''), null)
})

test('formatação em reais', () => {
  assert.equal(formatBRL(123456).replace(/\s/g, ' '), 'R$ 1.234,56')
})

test('datas: soma de meses respeita o fim do mês', () => {
  assert.equal(addMonths('2026-01-31', 1), '2026-02-28')
  assert.equal(addMonths('2024-01-31', 1), '2024-02-29')
  assert.equal(addMonths('2026-11-15', 2), '2027-01-15')
  assert.equal(addMonths('2026-03-31', -1), '2026-02-28')
  assert.equal(addDays('2026-12-31', 1), '2027-01-01')
  assert.equal(addDays('2026-03-01', -1), '2026-02-28')
})

test('datas: "hoje" usa o horário de Brasília', () => {
  // 02:00 UTC de 9/out ainda é 23:00 de 8/out em Brasília
  assert.equal(hoje(new Date('2026-10-09T02:00:00Z')), '2026-10-08')
  assert.equal(hoje(new Date('2026-10-09T04:00:00Z')), '2026-10-09')
})

test('datas: validação', () => {
  assert.ok(isIsoDate('2026-02-28'))
  assert.ok(!isIsoDate('2026-02-30'))
  assert.ok(!isIsoDate('08/10/2026'))
  assert.ok(!isIsoDate(undefined))
})

import { produtoPeloValor, produtoPeloValorSql, nomeProduto } from '../lib/produtos.ts'

test('produto pelo valor: preços fixos e self-service', () => {
  assert.equal(produtoPeloValor(799), 'cascao_1')
  assert.equal(produtoPeloValor(1199), 'cascao_2')
  assert.equal(produtoPeloValor(400), 'agua')
  assert.equal(produtoPeloValor(700), 'refrigerante')
  assert.equal(produtoPeloValor(800), 'suco')
  assert.equal(produtoPeloValor(1400), 'monster')
  assert.equal(produtoPeloValor(1500), 'red_bull')
  assert.equal(produtoPeloValor(1873), 'self_service')
  assert.equal(produtoPeloValor(800 + 1), 'self_service')
  assert.equal(nomeProduto('cascao_2'), 'Cascão 2 bolas')
  assert.equal(nomeProduto(null), 'Self-service')
  assert.match(produtoPeloValorSql('valor_bruto'), /WHEN 7\.99 THEN 'cascao_1'.*ELSE 'self_service' END/)
})
