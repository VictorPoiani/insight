'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Search, Hash, Github, ArrowUpRight } from 'lucide-react';

const DEFAULT_TOPICS = [
  'dev',
  'ia',
  'projetos',
  'rock',
  'musica',
  'artigue',
  'jardim',
];

export function RightSidebar() {
  const [searchQuery, setSearchQuery] = useState('');
  const [showAllTopics, setShowAllTopics] = useState(false);
  const router = useRouter();

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = searchQuery.trim();
    if (trimmed) {
      router.push(`/?q=${encodeURIComponent(trimmed)}`);
    } else {
      router.push('/');
    }
  }

  const displayedTopics = showAllTopics
    ? [...DEFAULT_TOPICS, 'professional', 'python', 'nextjs']
    : DEFAULT_TOPICS;

  return (
    <aside className="w-60 shrink-0 hidden lg:flex flex-col justify-between h-screen sticky top-0 bg-background px-3.5 py-5">
      <div className="space-y-3">
        {/* 1. Barra de Busca Compacta */}
        <form onSubmit={handleSearch} className="relative">
          <Search className="w-3.5 h-3.5 text-muted absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar no Insight..."
            className="w-full bg-surface border border-border rounded-full pl-8 pr-3 py-1.5 text-[11px] text-primary placeholder:text-muted focus:outline-none focus:border-accent transition-colors"
          />
        </form>

        {/* 2. Card de Tópicos Compacto */}
        <div className="p-3 rounded-xl bg-surface border border-border space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1 text-[11px] font-extrabold text-primary uppercase tracking-wider">
              <Hash className="w-3 h-3 text-accent" />
              <span>Tópicos</span>
            </div>
            <button
              type="button"
              onClick={() => setShowAllTopics(!showAllTopics)}
              className="text-[10px] text-muted hover:text-accent transition-colors"
            >
              {showAllTopics ? 'Menos' : 'Ver todos'}
            </button>
          </div>

          <div className="flex flex-wrap gap-1">
            {displayedTopics.map((topic) => (
              <Link
                key={topic}
                href={`/?tag=${topic}`}
                className="px-2 py-0.5 rounded-full bg-elevated border border-border text-[11px] text-secondary hover:text-primary hover:border-accent transition-colors"
              >
                #{topic}
              </Link>
            ))}
          </div>
        </div>

        {/* 3. Botão Discreto do GitHub */}
        <a
          href="https://github.com/VictorPoiani"
          target="_blank"
          rel="noopener noreferrer"
          className="group flex items-center justify-between px-3 py-2 rounded-xl bg-surface border border-border hover:border-accent transition-all"
        >
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-6 h-6 rounded-lg bg-elevated border border-border flex items-center justify-center text-secondary group-hover:text-accent group-hover:border-accent/40 transition-colors shrink-0">
              <Github className="w-3.5 h-3.5" />
            </div>
            <div className="truncate">
              <p className="text-[11px] font-bold text-primary leading-tight truncate">
                @VictorPoiani
              </p>
              <p className="text-[10px] text-muted truncate">
                GitHub · Projetos
              </p>
            </div>
          </div>

          <ArrowUpRight className="w-3.5 h-3.5 text-muted group-hover:text-accent group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform shrink-0 ml-1.5" />
        </a>
      </div>

      {/* 4. Rodapé Legal Compacto */}
      <footer className="px-1 space-y-1 text-[10px] text-muted leading-tight">
        <div className="flex flex-wrap gap-x-2.5 gap-y-0.5">
          <Link href="/privacidade" className="hover:text-secondary transition-colors">
            Privacidade (LGPD)
          </Link>
          <Link href="/termos" className="hover:text-secondary transition-colors">
            Termos de Uso
          </Link>
          <Link href="/about" className="hover:text-secondary transition-colors">
            Sobre o Projeto
          </Link>
        </div>
        <p>© 2026 Insighter — Victor Poiani</p>
      </footer>
    </aside>
  );
}