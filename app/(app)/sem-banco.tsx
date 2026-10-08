import { Database } from 'lucide-react'

export function SemBanco() {
  return (
    <div role="alert" className="cartao mx-auto mt-6 max-w-lg p-7">
      <Database aria-hidden className="size-8 text-framboesa" />
      <h1 className="mt-3 font-display text-2xl font-bold">Banco de dados não conectado</h1>
      <p className="mt-2 text-cacau-suave">
        O site está no ar, mas ainda não sabe onde guardar os lançamentos. Para conectar:
      </p>
      <ol className="mt-4 list-decimal space-y-2 pl-5 text-[15px]">
        <li>
          No Vercel, abra o projeto e vá na aba <strong>Storage</strong>.
        </li>
        <li>
          Toque em <strong>Create Database → Neon</strong>, escolha o plano grátis e conecte a este projeto.
        </li>
        <li>
          Vá em <strong>Deployments</strong>, toque nos três pontinhos do mais recente e escolha <strong>Redeploy</strong>.
        </li>
      </ol>
      <p className="mt-4 text-sm text-cacau-suave">
        Se o banco foi criado direto no site do Neon, adicione a connection string em Settings → Environment Variables
        com o nome <code className="font-semibold text-cacau">DATABASE_URL</code> e faça o Redeploy.
      </p>
    </div>
  )
}
