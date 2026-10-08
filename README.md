# Caixa da Sorveteria

Fluxo de caixa simples para a sorveteria:

- **Lançar venda:** dinheiro, Pix, débito ou crédito (até 12x). O sistema busca a taxa da maquininha (Mercado Pago, Stone, PagSeguro ou outra) e mostra o valor líquido e o dia em que o dinheiro cai.
- **Lançar saída:** compras e despesas à vista ou parceladas. Cada parcela vira uma conta a pagar no mês dela.
- **Caixa do dia:** bruto, taxas, líquido, saídas e saldo, separados por forma de pagamento e por maquininha.
- **Histórico:** consulta de vendas antigas, saídas e contas a pagar, com filtros por período, forma, maquininha e busca. Também exporta planilha (abre no Excel).
- **Configurações:** taxas de cada maquininha (débito, Pix e crédito de 1x a 12x) e prazo de recebimento.

Funciona no navegador do celular e do computador. Custo: **R$ 0** (Neon grátis + Vercel grátis).

---

## Como colocar no ar (uma vez só)

### 1. Banco de dados: Neon

1. Crie uma conta em [neon.com](https://neon.com). Dá para entrar com o Google, sem cartão.
2. Crie um projeto (região sugerida: **São Paulo / sa-east-1**).
3. No painel, clique em **Connect** e copie a *connection string* da opção **pooled**. Ela começa com `postgresql://` e tem `-pooler` no endereço.

Não precisa criar tabela nenhuma: o sistema cria tudo sozinho no primeiro acesso.

### 2. Site: Vercel

1. Crie uma conta em [vercel.com](https://vercel.com) entrando com o GitHub.
2. Clique em **Add New → Project** e importe o repositório `controle.sorveteria`.
3. Em **Environment Variables**, adicione:

| Nome | Valor |
|---|---|
| `DATABASE_URL` | a connection string do Neon |
| `APP_PASSWORD` | a senha que a equipe vai usar para entrar |
| `SESSION_SECRET` | *(opcional)* um texto aleatório longo |

4. Clique em **Deploy**. Em cerca de 1 minuto o site estará num endereço do tipo `controle-sorveteria.vercel.app`.

### 3. Primeiro uso

1. Entre com a senha.
2. Vá em **Configurações** e preencha as taxas de cada maquininha. Elas estão no app ou no contrato de cada uma e mudam conforme o plano. Deixe em branco o que vocês não usam.
3. Pronto: comece a lançar as vendas.

> Dica: no celular, abra o site e use "Adicionar à tela inicial" para ele ficar como um aplicativo.

---

## Como o banco funciona

| Tabela | Guarda |
|---|---|
| `maquininhas` | Mercado Pago, Stone, PagSeguro (e outras que vocês adicionarem) |
| `taxas` | % e prazo de cada maquininha por tipo (débito, Pix, crédito 1x–12x) |
| `entradas` | cada venda: valor bruto, taxa **copiada no momento da venda**, valor líquido e data de recebimento |
| `saidas` | cada compra ou despesa, à vista ou parcelada |
| `saidas_parcelas` | uma linha por parcela, com vencimento e se já foi paga |

- A taxa fica gravada na própria venda. Se a maquininha mudar a taxa, vocês atualizam em Configurações e as vendas antigas continuam com o valor que realmente foi cobrado.
- **Saídas do dia** são as parcelas que vencem naquele dia. Uma compra de R$ 900 em 3x tira R$ 300 por mês, não R$ 900 de uma vez.
- Valores são calculados em centavos inteiros, sem erros de arredondamento. Uma parcela que não divide exato fica com os centavos que sobram na última.

### Limites do plano grátis

- O banco do Neon "dorme" depois de 5 minutos sem uso e acorda sozinho no próximo acesso. O primeiro lançamento depois de um tempo parado pode levar 1 ou 2 segundos a mais.
- O Neon grátis só permite restaurar os dados até poucas horas para trás. **Exporte a planilha do mês** pelo Histórico de vez em quando para guardar uma cópia.

---

## Para desenvolvedores

```bash
npm install
cp .env.example .env.local   # preencha DATABASE_URL e APP_PASSWORD
npm run dev                   # http://localhost:3000
npm test                      # testes dos cálculos (taxas, parcelas, datas)
npm run lint                  # checagem de tipos
npm run db:setup              # opcional: cria as tabelas manualmente
```

Stack: Next.js 16 (App Router, Server Actions), React 19, Tailwind CSS 4, Framer Motion, Postgres (`pg`).

- `lib/schema.ts`: estrutura do banco (idempotente)
- `lib/money.ts`: cálculo de taxa e divisão de parcelas
- `lib/actions.ts`: lançamentos, que recalculam tudo no servidor e não confiam no navegador
- `lib/data.ts`: consultas
- `proxy.ts` + `lib/session.ts`: login por senha única da loja
