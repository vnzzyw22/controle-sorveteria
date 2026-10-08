import { addDays, hoje, inicioDoMes, isIsoDate } from './dates'
import { FORMAS_ENTRADA, FORMAS_SAIDA, type FormaEntrada, type FormaSaida } from './money'

export const PAGE_SIZE = 30

type Params = Record<string, string | string[] | undefined>

function one(params: Params, key: string): string | undefined {
  const value = params[key]
  return Array.isArray(value) ? value[0] : value
}

function periodo(params: Params) {
  const today = hoje()
  let de = one(params, 'de')
  let ate = one(params, 'ate')
  if (!isIsoDate(de)) de = inicioDoMes(today)
  if (!isIsoDate(ate)) ate = today
  if (de > ate) [de, ate] = [ate, de]
  return { de, ate }
}

function pagina(params: Params): number {
  const n = Number(one(params, 'pagina'))
  return Number.isInteger(n) && n > 0 ? n : 1
}

function busca(params: Params): string {
  return (one(params, 'q') ?? '').trim().slice(0, 100)
}

export interface FiltroVendas {
  de: string
  ate: string
  forma: FormaEntrada | ''
  maquininha: number | 'nenhuma' | ''
  q: string
  pagina: number
}

export function parseFiltroVendas(params: Params): FiltroVendas {
  const forma = one(params, 'forma') as FormaEntrada
  const maq = one(params, 'maquininha')
  const maqId = Number(maq)
  return {
    ...periodo(params),
    forma: FORMAS_ENTRADA.includes(forma) ? forma : '',
    maquininha: maq === 'nenhuma' ? 'nenhuma' : Number.isInteger(maqId) && maqId > 0 ? maqId : '',
    q: busca(params),
    pagina: pagina(params),
  }
}

export interface FiltroSaidas {
  de: string
  ate: string
  forma: FormaSaida | ''
  condicao: 'a_vista' | 'parcelado' | ''
  categoria: string
  q: string
  pagina: number
}

export function parseFiltroSaidas(params: Params): FiltroSaidas {
  const forma = one(params, 'forma') as FormaSaida
  const condicao = one(params, 'condicao')
  return {
    ...periodo(params),
    forma: FORMAS_SAIDA.includes(forma) ? forma : '',
    condicao: condicao === 'a_vista' || condicao === 'parcelado' ? condicao : '',
    categoria: (one(params, 'categoria') ?? '').trim().slice(0, 60),
    q: busca(params),
    pagina: pagina(params),
  }
}

export interface FiltroContas {
  status: 'pendentes' | 'pagas' | 'todas'
  ate: string
  pagina: number
}

export function parseFiltroContas(params: Params): FiltroContas {
  const status = one(params, 'status')
  const ate = one(params, 'ate')
  return {
    status: status === 'pagas' || status === 'todas' ? status : 'pendentes',
    // Por padrão mostra o que vence até 60 dias à frente.
    ate: isIsoDate(ate) ? ate : addDays(hoje(), 60),
    pagina: pagina(params),
  }
}
