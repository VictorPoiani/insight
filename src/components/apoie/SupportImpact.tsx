'use client';

/** Página Apoie: por que doar e para onde vai o dinheiro (texto corrido + lista sóbria). */
const AREAS = [
  ['Hospedagem', 'os servidores que mantêm o Insight rápido e no ar'],
  ['Banco de dados', 'posts, conversas, perfis e notificações'],
  ['Imagens e arquivos', 'o armazenamento do que a comunidade publica'],
  ['Segurança', 'moderação e proteção contra abuso e robôs'],
  ['Evolução', 'novos módulos e melhorias, como o Notebook'],
] as const;

export function SupportImpact() {
  return (
    <section className="px-4 sm:px-6 py-8 border-b border-border">
      <div className="grid gap-8 lg:grid-cols-[1.1fr_1fr] lg:gap-12">
        <div className="space-y-4">
          <h2 className="text-lg sm:text-xl font-bold text-primary leading-snug">
            Manter uma plataforma aberta, rápida e estável tem custos reais.
          </h2>
          <p className="text-sm text-secondary leading-relaxed">
            Todo valor arrecadado aqui é destinado exclusivamente à sustentabilidade do Insight: hospedagem, banco de dados,
            armazenamento de imagens e arquivos, ferramentas de segurança e a evolução contínua de módulos como o Notebook.
          </p>
          <p className="text-sm text-secondary leading-relaxed">
            Apoiar o projeto é totalmente opcional, mas faz toda a diferença para continuarmos independentes, livres de poluição
            visual e crescendo junto com a comunidade.
          </p>
        </div>

        <div>
          <p className="text-xs text-muted pb-2">Para onde vai cada real</p>
          <ul className="divide-y divide-border border-y border-border">
            {AREAS.map(([title, text]) => (
              <li key={title} className="flex items-baseline justify-between gap-4 py-3">
                <span className="text-sm font-medium text-primary shrink-0">{title}</span>
                <span className="text-xs text-muted text-right">{text}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
