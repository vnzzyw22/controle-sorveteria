export default function Carregando() {
  return (
    <div aria-busy="true" aria-label="Carregando" className="animate-pulse space-y-4">
      <div className="h-9 w-56 rounded-xl bg-linha/70" />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-28 rounded-2xl bg-linha/50" />
        ))}
      </div>
      <div className="h-64 rounded-2xl bg-linha/40" />
    </div>
  )
}
