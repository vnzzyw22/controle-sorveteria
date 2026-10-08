// Contas do painel de meta, do ponto de equilíbrio e dos comparativos. Tudo em centavos inteiros
// e sem acesso ao banco, para poder ser testado sozinho.

import { addDays, addMonths, inicioDoMes } from './dates.ts'

const MESES_CURTOS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
const MESES_LONGOS = [
  'janeiro',
  'fevereiro',
  'março',
  'abril',
  'maio',
  'junho',
  'julho',
  'agosto',
  'setembro',
  'outubro',
  'novembro',
  'dezembro',
]

export const DIAS_SEMANA = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'] as const

/** "2026-10-08" -> "2026-10" */
export const mesDe = (iso: string) => iso.slice(0, 7)

/** "2026-10" -> "outubro" */
export const nomeDoMes = (mes: string) => MESES_LONGOS[Number(mes.slice(5, 7)) - 1]

/** "2026-10" -> "out/26" */
export const rotuloMes = (mes: string) => `${MESES_CURTOS[Number(mes.slice(5, 7)) - 1]}/${mes.slice(2, 4)}`

export function diasNoMes(mes: string): number {
  const [y, m] = mes.split('-').map(Number)
  return new Date(Date.UTC(y, m, 0)).getUTCDate()
}

/** Último dia do mês ("2026-10-31"). */
export const fimDoMes = (mes: string) => `${mes}-${String(diasNoMes(mes)).padStart(2, '0')}`

/** Os últimos `n` meses terminando em `mes`, do mais antigo ao mais novo. */
export function ultimosMeses(mes: string, n: number): string[] {
  const base = `${mes}-01`
  return Array.from({ length: n }, (_, i) => mesDe(addMonths(base, i - (n - 1))))
}

/** Mesma altura do mês passado: dia 8 de outubro -> de 01/09 a 08/09 (ou ao fim de setembro, se for menor). */
export function periodoMesAnterior(hojeIso: string): { de: string; ate: string } {
  const anterior = mesDe(addMonths(inicioDoMes(hojeIso), -1))
  const dia = Math.min(Number(hojeIso.slice(8, 10)), diasNoMes(anterior))
  return { de: `${anterior}-01`, ate: `${anterior}-${String(dia).padStart(2, '0')}` }
}

/** Variação percentual inteira; null quando não há base de comparação. */
export function variacaoPct(atual: number, anterior: number): number | null {
  if (anterior <= 0) return null
  return Math.round(((atual - anterior) / anterior) * 100)
}

export interface EntradaMeta {
  /** Dia de hoje (AAAA-MM-DD, horário de Brasília). */
  hoje: string
  /** Vendas brutas do mês até hoje. */
  vendidoCentavos: number
  /** Contas (saídas) com vencimento no mês, pagas ou não. */
  contasCentavos: number
  /** Parte das vendas que fica com as maquininhas, em pontos-base (315 = 3,15%). */
  taxaMediaBp: number
  /** Meta de vendas do mês; null = ainda não definida. */
  metaCentavos: number | null
}

export interface PainelMeta {
  mes: string
  diaAtual: number
  diasNoMes: number
  /** Dias que ainda dá para vender, contando hoje. */
  diasRestantes: number
  vendidoCentavos: number
  metaCentavos: number | null
  pctMeta: number | null
  faltaMetaCentavos: number | null
  porDiaParaMetaCentavos: number | null
  /** Quanto o mês fecha se o ritmo até aqui continuar; só depois de uma semana de dados. */
  projecaoCentavos: number | null
  contasCentavos: number
  /** Taxa média das maquininhas usada na conta, em pontos-base. */
  taxaMediaBp: number
  /** Vendas necessárias para cobrir as contas do mês, já descontadas as taxas. */
  equilibrioCentavos: number
  faltaEquilibrioCentavos: number
  equilibrioAtingido: boolean
  /** A meta é menor que o ponto de equilíbrio: bater a meta não fecha as contas. */
  metaAbaixoDoEquilibrio: boolean
}

export function calcularPainelMeta(e: EntradaMeta): PainelMeta {
  const mes = mesDe(e.hoje)
  const total = diasNoMes(mes)
  const diaAtual = Number(e.hoje.slice(8, 10))
  const diasRestantes = total - diaAtual + 1

  const bp = Math.min(Math.max(Math.round(e.taxaMediaBp), 0), 9_000)
  // Para sobrar `contas` depois da taxa: vendas x (1 - taxa) >= contas.
  const equilibrio = e.contasCentavos > 0 ? Math.ceil((e.contasCentavos * 10_000) / (10_000 - bp)) : 0
  const faltaEquilibrio = Math.max(0, equilibrio - e.vendidoCentavos)

  const meta = e.metaCentavos && e.metaCentavos > 0 ? e.metaCentavos : null
  const faltaMeta = meta === null ? null : Math.max(0, meta - e.vendidoCentavos)

  return {
    mes,
    diaAtual,
    diasNoMes: total,
    diasRestantes,
    vendidoCentavos: e.vendidoCentavos,
    metaCentavos: meta,
    pctMeta: meta === null ? null : Math.round((e.vendidoCentavos / meta) * 100),
    faltaMetaCentavos: faltaMeta,
    porDiaParaMetaCentavos: faltaMeta === null ? null : Math.ceil(faltaMeta / diasRestantes),
    projecaoCentavos:
      diaAtual >= 7 && e.vendidoCentavos > 0 ? Math.round((e.vendidoCentavos / diaAtual) * total) : null,
    contasCentavos: e.contasCentavos,
    taxaMediaBp: bp,
    equilibrioCentavos: equilibrio,
    faltaEquilibrioCentavos: faltaEquilibrio,
    equilibrioAtingido: equilibrio > 0 && e.vendidoCentavos >= equilibrio,
    metaAbaixoDoEquilibrio: meta !== null && equilibrio > 0 && meta < equilibrio,
  }
}

export interface DiaDaSemana {
  /** 0 = domingo ... 6 = sábado */
  dow: number
  /** Dias diferentes em que houve venda nesse dia da semana. */
  dias: number
  vendas: number
  brutoCentavos: number
}

/** Média de vendas por dia em que a loja vendeu (dia sem nenhuma venda é tratado como fechado). */
export const mediaPorDia = (d: DiaDaSemana) => (d.dias > 0 ? Math.round(d.brutoCentavos / d.dias) : 0)

/** Segunda a domingo, com todos os dias presentes (os sem venda vêm zerados). */
export function semanaCompleta(linhas: DiaDaSemana[]): DiaDaSemana[] {
  return [1, 2, 3, 4, 5, 6, 0].map(
    (dow) => linhas.find((l) => l.dow === dow) ?? { dow, dias: 0, vendas: 0, brutoCentavos: 0 },
  )
}

/** Primeiro dia do período de N dias que termina hoje (N = 30 -> hoje e os 29 anteriores). */
export const inicioDoPeriodo = (hojeIso: string, dias: number) => addDays(hojeIso, -(dias - 1))
