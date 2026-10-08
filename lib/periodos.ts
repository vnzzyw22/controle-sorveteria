// Períodos do Resumo ("este mês", "30 dias"...), escolhidos pela URL (?periodo=90).

import { inicioDoPeriodo } from './analise.ts'
import { inicioDoMes } from './dates.ts'

const PERIODOS = {
  mes: { rotulo: 'Este mês', frase: 'neste mês' },
  '30': { rotulo: '30 dias', frase: 'nos últimos 30 dias', dias: 30 },
  '90': { rotulo: '3 meses', frase: 'nos últimos 3 meses', dias: 90 },
  '180': { rotulo: '6 meses', frase: 'nos últimos 6 meses', dias: 180 },
} as const

export type PeriodoChave = keyof typeof PERIODOS

export const PERIODO_PADRAO: PeriodoChave = '90'

// Ordem fixa (do mais curto ao mais longo); Object.keys poria as chaves numéricas na frente de "mes".
export const OPCOES_PERIODO = (['mes', '30', '90', '180'] as const).map((chave) => ({
  chave,
  rotulo: PERIODOS[chave].rotulo,
}))

export function resolverPeriodo(param: string | undefined, hoje: string) {
  const chave: PeriodoChave = param !== undefined && param in PERIODOS ? (param as PeriodoChave) : PERIODO_PADRAO
  const config = PERIODOS[chave]
  return {
    chave,
    frase: config.frase,
    de: 'dias' in config ? inicioDoPeriodo(hoje, config.dias) : inicioDoMes(hoje),
    ate: hoje,
  }
}
