import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  calcularPainelMeta,
  diasNoMes,
  fimDoMes,
  inicioDoPeriodo,
  mediaPorDia,
  periodoMesAnterior,
  rotuloMes,
  semanaCompleta,
  ultimosMeses,
  variacaoPct,
} from '../lib/analise.ts'
import { categoriaCanonica, chaveCategoria, sugestoesCategorias } from '../lib/categorias.ts'

test('meses: tamanho, rótulo e janela dos últimos meses', () => {
  assert.equal(diasNoMes('2026-02'), 28)
  assert.equal(diasNoMes('2028-02'), 29)
  assert.equal(diasNoMes('2026-10'), 31)
  assert.equal(fimDoMes('2026-04'), '2026-04-30')
  assert.equal(rotuloMes('2026-10'), 'out/26')
  assert.deepEqual(ultimosMeses('2026-02', 4), ['2025-11', '2025-12', '2026-01', '2026-02'])
})

test('mês anterior na mesma altura (e quando o mês anterior é mais curto)', () => {
  assert.deepEqual(periodoMesAnterior('2026-10-08'), { de: '2026-09-01', ate: '2026-09-08' })
  assert.deepEqual(periodoMesAnterior('2026-03-31'), { de: '2026-02-01', ate: '2026-02-28' })
  assert.deepEqual(periodoMesAnterior('2026-01-15'), { de: '2025-12-01', ate: '2025-12-15' })
})

test('período de N dias termina hoje e conta hoje', () => {
  assert.equal(inicioDoPeriodo('2026-10-30', 30), '2026-10-01')
  assert.equal(inicioDoPeriodo('2026-10-08', 1), '2026-10-08')
})

test('variação percentual', () => {
  assert.equal(variacaoPct(1200, 1000), 20)
  assert.equal(variacaoPct(800, 1000), -20)
  assert.equal(variacaoPct(1000, 1000), 0)
  assert.equal(variacaoPct(500, 0), null)
})

test('painel: meta, quanto falta e quanto por dia', () => {
  const p = calcularPainelMeta({
    hoje: '2026-10-10', // 22 dias restantes contando hoje (10 a 31)
    vendidoCentavos: 400_000,
    contasCentavos: 0,
    taxaMediaBp: 0,
    metaCentavos: 1_000_000,
  })
  assert.equal(p.diasRestantes, 22)
  assert.equal(p.pctMeta, 40)
  assert.equal(p.faltaMetaCentavos, 600_000)
  assert.equal(p.porDiaParaMetaCentavos, 27_273) // 600000 / 22 arredondado para cima
  assert.equal(p.projecaoCentavos, 1_240_000) // 400000 / 10 dias x 31
  assert.equal(p.equilibrioCentavos, 0)
  assert.equal(p.metaAbaixoDoEquilibrio, false)
})

test('painel: meta batida não mostra falta negativa', () => {
  const p = calcularPainelMeta({
    hoje: '2026-10-31',
    vendidoCentavos: 1_200_000,
    contasCentavos: 0,
    taxaMediaBp: 0,
    metaCentavos: 1_000_000,
  })
  assert.equal(p.faltaMetaCentavos, 0)
  assert.equal(p.porDiaParaMetaCentavos, 0)
  assert.equal(p.pctMeta, 120)
})

test('ponto de equilíbrio: vendas precisam cobrir as contas depois da taxa', () => {
  // Contas de R$ 9.000 com 10% de taxa média: precisa vender R$ 10.000 (10.000 - 10% = 9.000).
  const p = calcularPainelMeta({
    hoje: '2026-10-10',
    vendidoCentavos: 400_000,
    contasCentavos: 900_000,
    taxaMediaBp: 1_000,
    metaCentavos: 800_000,
  })
  assert.equal(p.equilibrioCentavos, 1_000_000)
  assert.equal(p.faltaEquilibrioCentavos, 600_000)
  assert.equal(p.equilibrioAtingido, false)
  assert.equal(p.metaAbaixoDoEquilibrio, true)
})

test('ponto de equilíbrio sem taxa e já atingido', () => {
  const p = calcularPainelMeta({
    hoje: '2026-10-20',
    vendidoCentavos: 950_000,
    contasCentavos: 900_000,
    taxaMediaBp: 0,
    metaCentavos: null,
  })
  assert.equal(p.equilibrioCentavos, 900_000)
  assert.equal(p.faltaEquilibrioCentavos, 0)
  assert.equal(p.equilibrioAtingido, true)
  assert.equal(p.metaCentavos, null)
  assert.equal(p.pctMeta, null)
  assert.equal(p.metaAbaixoDoEquilibrio, false)
})

test('projeção só aparece depois de uma semana com vendas', () => {
  const base = { vendidoCentavos: 100_000, contasCentavos: 0, taxaMediaBp: 0, metaCentavos: null }
  assert.equal(calcularPainelMeta({ ...base, hoje: '2026-10-03' }).projecaoCentavos, null)
  assert.notEqual(calcularPainelMeta({ ...base, hoje: '2026-10-07' }).projecaoCentavos, null)
  assert.equal(calcularPainelMeta({ ...base, hoje: '2026-10-20', vendidoCentavos: 0 }).projecaoCentavos, null)
})

test('dias da semana: semana completa de segunda a domingo e média por dia aberto', () => {
  const semana = semanaCompleta([
    { dow: 6, dias: 4, vendas: 80, brutoCentavos: 400_000 },
    { dow: 0, dias: 2, vendas: 30, brutoCentavos: 150_000 },
  ])
  assert.deepEqual(
    semana.map((d) => d.dow),
    [1, 2, 3, 4, 5, 6, 0],
  )
  assert.equal(mediaPorDia(semana[5]), 100_000) // sábado: 400000 / 4
  assert.equal(mediaPorDia(semana[0]), 0) // segunda sem vendas
})

test('categorias: ignora maiúsculas e acentos e reaproveita a grafia já usada', () => {
  assert.equal(chaveCategoria('  Energía   Elétrica '), 'energia eletrica')
  const conhecidas = ['Energia e água', 'Aluguel']
  assert.equal(categoriaCanonica('aluguel', conhecidas), 'Aluguel')
  assert.equal(categoriaCanonica('ALUGUEL  ', conhecidas), 'Aluguel')
  assert.equal(categoriaCanonica('ENERGIA E AGUA', conhecidas), 'Energia e água')
  assert.equal(categoriaCanonica('gás', conhecidas), 'Gás')
  assert.equal(categoriaCanonica('   ', conhecidas), null)
})

test('categorias: sugestões juntam as mais usadas com as padrão, sem repetir', () => {
  const s = sugestoesCategorias(['aluguel', 'Gás', 'Insumos'])
  assert.deepEqual(s.slice(0, 3), ['aluguel', 'Gás', 'Insumos'])
  assert.equal(s.filter((c) => c.toLowerCase() === 'aluguel').length, 1)
  assert.ok(s.includes('Leite e laticínios'))
  assert.ok(s.length <= 14)
})
