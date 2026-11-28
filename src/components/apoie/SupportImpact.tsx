'use client';

import { useEffect, useRef, useState } from 'react';
import { Server, Database, Image as ImageIcon, ShieldCheck, NotebookPen } from 'lucide-react';

const AREAS = [
  { icon: Server, title: 'Hospedagem', text: 'Servidores que mantêm o Insight rápido e no ar, a qualquer hora.' },
  { icon: Database, title: 'Banco de dados', text: 'Posts, conversas, perfis e notificações guardados com segurança.' },
  { icon: ImageIcon, title: 'Imagens e arquivos', text: 'Armazenamento das fotos, vídeos e anexos que a comunidade publica.' },
  { icon: ShieldCheck, title: 'Segurança', text: 'Moderação, proteção contra robôs e ferramentas que mantêm o espaço saudável.' },
  { icon: NotebookPen, title: 'Evolução contínua', text: 'Novos módulos e melhorias, como o Notebook, construídos com a comunidade.' },
] as const;

/** Página Apoie: por que doar e para onde vai cada real (cartões entram em sequência). */
export function SupportImpact() {
  const ref = useRef<HTMLElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') {
      setVisible(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisible(true);
          io.disconnect();
        }
      },
      { threshold: 0.15 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <section ref={ref} className="px-4 sm:px-6 py-7 border-b border-border space-y-5">
      <div className="space-y-2 max-w-2xl">
        <span className="text-[10px] font-mono font-bold uppercase tracking-[0.16em] text-accent">Para onde vai o seu apoio</span>
        <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight text-primary leading-snug">
          Manter uma plataforma aberta, rápida e estável tem custos reais.
        </h2>
        <p className="text-xs sm:text-sm text-secondary leading-relaxed">
          Todo valor arrecadado aqui é destinado <strong className="text-primary">exclusivamente à sustentabilidade do Insight</strong>:
          hospedagem, banco de dados, armazenamento de imagens e arquivos, ferramentas de segurança e a evolução contínua de módulos
          como o Notebook.
        </p>
      </div>

      <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
        {AREAS.map((a, i) => {
          const Icon = a.icon;
          return (
            <li
              key={a.title}
              style={{ transitionDelay: visible ? `${i * 90}ms` : '0ms' }}
              className={`group rounded-2xl border border-border bg-surface/50 p-4 space-y-2 transition-all duration-500 motion-reduce:transition-none hover:border-accent/50 ${
                visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3'
              }`}
            >
              <span className="inline-flex w-8 h-8 items-center justify-center rounded-xl bg-accent/10 text-accent transition-transform group-hover:-translate-y-0.5">
                <Icon className="w-4 h-4" />
              </span>
              <p className="text-sm font-bold text-primary">{a.title}</p>
              <p className="text-xs text-secondary leading-relaxed">{a.text}</p>
            </li>
          );
        })}
      </ul>

      <p
        style={{ transitionDelay: visible ? `${AREAS.length * 90}ms` : '0ms' }}
        className={`max-w-2xl text-xs sm:text-sm text-secondary leading-relaxed border-l-2 border-accent/60 pl-3 transition-opacity duration-500 motion-reduce:transition-none ${
          visible ? 'opacity-100' : 'opacity-0'
        }`}
      >
        Apoiar o projeto é <strong className="text-primary">totalmente opcional</strong>, mas faz toda a diferença para continuarmos
        independentes, livres de poluição visual e crescendo junto com a comunidade.
      </p>
    </section>
  );
}
