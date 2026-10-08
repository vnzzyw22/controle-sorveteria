// Estrutura do banco. Todos os comandos são idempotentes: podem rodar várias vezes
// sem apagar dados (o sistema roda isto automaticamente na primeira conexão).

export const SCHEMA_SQL = /* sql */ `
CREATE TABLE IF NOT EXISTS maquininhas (
  id        INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  nome      TEXT NOT NULL UNIQUE,
  ativa     BOOLEAN NOT NULL DEFAULT TRUE,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS taxas (
  id            INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  maquininha_id INTEGER NOT NULL REFERENCES maquininhas(id) ON DELETE CASCADE,
  forma         TEXT NOT NULL CHECK (forma IN ('debito', 'credito', 'pix')),
  parcelas      INTEGER NOT NULL DEFAULT 1 CHECK (parcelas BETWEEN 1 AND 12),
  percentual    NUMERIC(5,2) NOT NULL CHECK (percentual >= 0 AND percentual < 100),
  prazo_dias    INTEGER NOT NULL DEFAULT 1 CHECK (prazo_dias BETWEEN 0 AND 365),
  UNIQUE (maquininha_id, forma, parcelas)
);

CREATE TABLE IF NOT EXISTS entradas (
  id               INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  data             DATE NOT NULL,
  descricao        TEXT,
  forma            TEXT NOT NULL CHECK (forma IN ('dinheiro', 'pix', 'debito', 'credito')),
  maquininha_id    INTEGER REFERENCES maquininhas(id),
  parcelas         INTEGER NOT NULL DEFAULT 1 CHECK (parcelas BETWEEN 1 AND 12),
  valor_bruto      NUMERIC(10,2) NOT NULL CHECK (valor_bruto > 0),
  taxa_percentual  NUMERIC(5,2)  NOT NULL DEFAULT 0,
  valor_taxa       NUMERIC(10,2) NOT NULL DEFAULT 0,
  valor_liquido    NUMERIC(10,2) NOT NULL,
  data_recebimento DATE NOT NULL,
  criado_em        TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (forma NOT IN ('debito', 'credito') OR maquininha_id IS NOT NULL),
  CHECK (forma <> 'dinheiro' OR maquininha_id IS NULL)
);
CREATE INDEX IF NOT EXISTS entradas_data_idx ON entradas (data DESC, id DESC);

CREATE TABLE IF NOT EXISTS saidas (
  id           INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  data         DATE NOT NULL,
  descricao    TEXT NOT NULL,
  categoria    TEXT,
  fornecedor   TEXT,
  forma        TEXT NOT NULL CHECK (forma IN ('dinheiro', 'pix', 'debito', 'credito', 'boleto')),
  condicao     TEXT NOT NULL CHECK (condicao IN ('a_vista', 'parcelado')),
  num_parcelas INTEGER NOT NULL DEFAULT 1 CHECK (num_parcelas BETWEEN 1 AND 48),
  valor_total  NUMERIC(10,2) NOT NULL CHECK (valor_total > 0),
  criado_em    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS saidas_data_idx ON saidas (data DESC, id DESC);

CREATE TABLE IF NOT EXISTS saidas_parcelas (
  id         INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  saida_id   INTEGER NOT NULL REFERENCES saidas(id) ON DELETE CASCADE,
  numero     INTEGER NOT NULL,
  vencimento DATE NOT NULL,
  valor      NUMERIC(10,2) NOT NULL CHECK (valor > 0),
  pago_em    DATE,
  UNIQUE (saida_id, numero)
);
CREATE INDEX IF NOT EXISTS saidas_parcelas_venc_idx ON saidas_parcelas (vencimento);

-- Meta de vendas por mês ("AAAA-MM"). Vale também para os meses seguintes até a próxima meta cadastrada.
CREATE TABLE IF NOT EXISTS metas (
  mes   TEXT PRIMARY KEY CHECK (length(mes) = 7),
  valor NUMERIC(10,2) NOT NULL CHECK (valor > 0)
);

INSERT INTO maquininhas (nome) VALUES ('Mercado Pago'), ('Stone'), ('PagSeguro')
ON CONFLICT (nome) DO NOTHING;
`
