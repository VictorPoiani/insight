'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  GraduationCap,
  UserCircle2,
  PenLine,
  AtSign,
  Repeat2,
  LayoutGrid,
  Bell,
  Palette,
  Keyboard,
  BarChart3,
  Heart,
  Zap,
  NotebookPen,
  CheckCircle2,
  Circle,
  ArrowRight,
} from 'lucide-react';
import { Kbd, SHORTCUTS } from '@/components/layout/GlobalShortcuts';

interface Step {
  id: string;
  icon: typeof PenLine;
  title: string;
  summary: string;
  items: React.ReactNode[];
  cta?: { href: string; label: string };
}

const STEPS: Step[] = [
  {
    id: 'perfil',
    icon: UserCircle2,
    title: 'Monte seu perfil',
    summary: 'É a sua vitrine na comunidade.',
    items: [
      'Abra seu perfil pelo menu da conta (canto inferior da barra esquerda) e toque em editar.',
      'Troque foto, capa, nome de exibição e bio. Dá para colocar uma música do perfil pela pesquisa.',
      'Em Configurações você muda o @usuário (o sistema avisa se o nome está livre).',
    ],
    cta: { href: '/config', label: 'Ir para Configurações' },
  },
  {
    id: 'postar',
    icon: PenLine,
    title: 'Compartilhe seu Insight',
    summary: 'O editor funciona em blocos, como um caderno.',
    items: [
      <>Toque em <strong>Compartilhe seu Insight…</strong> no topo do feed e escreva.</>,
      <>Digite <Kbd>/</Kbd> num bloco vazio (ou use o <strong>+</strong>) para inserir título, citação, código, lista, imagem, vídeo, GIF, enquete, tabela, música, mapa mental e mais.</>,
      <><Kbd>Enter</Kbd> pula linha dentro do bloco; <Kbd>Ctrl</Kbd> + <Kbd>Enter</Kbd> cria outro bloco abaixo.</>,
      'Imagens e vídeos entram com metade da largura no computador. Arraste a alça ou use 25/50/75/100% para ajustar.',
      'Duas ou mais mídias seguidas viram um carrossel: a próxima aparece ao lado, mais apagada.',
      'Arraste um bloco pela alça ⋮⋮ para reordenar. Solte na borda esquerda ou direita de outro bloco para deixá-los lado a lado.',
      'No menu ⋯ de cada bloco dá para marcar como spoiler — ele aparece borrado até a pessoa tocar.',
      'Selecione um texto para realçar, pôr negrito, itálico ou link. O rascunho é salvo sozinho.',
    ],
  },
  {
    id: 'mencoes',
    icon: AtSign,
    title: 'Respostas e menções',
    summary: 'Converse e chame a comunidade para a discussão.',
    items: [
      <>Digite <Kbd>@</Kbd> em um post ou resposta: aparecem membros conforme você escreve. Use as setas e <Kbd>Enter</Kbd> para escolher.</>,
      'Quem for marcado recebe a notificação “mencionou você”.',
      'Respostas aceitam texto, citação, código, lista, imagens, GIF, vídeo e música (escreva o nome e pesquise).',
    ],
  },
  {
    id: 'repost',
    icon: Repeat2,
    title: 'Curtir, repostar e citar',
    summary: 'Espalhe o que vale a pena.',
    items: [
      'O botão de repost oferece “Repostar” (direto) ou “Repostar com comentário” — seu texto com o post original embaixo.',
      'Toque numa imagem para abrir em tela cheia; deslize para ver as próximas.',
    ],
  },
  {
    id: 'topicos',
    icon: LayoutGrid,
    title: 'Tópicos do perfil',
    summary: 'Abas próprias com modelos prontos.',
    items: [
      'No seu perfil, crie um tópico e escolha um modelo: metas, hábitos, tarefas, roadmap, mapa mental, plano nutricional, agenda ou Poemas & Livros.',
      'Poemas & Livros é um mural de escritos ligado ao My Notebook: traga capítulos de lá ou escreva direto no tópico.',
      'Cada tópico pode ser público ou privado.',
    ],
  },
  {
    id: 'notificacoes',
    icon: Bell,
    title: 'Notificações',
    summary: 'Só o que importa para você.',
    items: [
      'Filtre por curtidas, respostas, menções, enquetes, seguidores e reposts.',
      'Toque no ícone de lista para selecionar uma a uma ou todas e apagar de uma vez.',
      'A engrenagem liga ou desliga cada tipo de aviso.',
    ],
    cta: { href: '/notificacoes', label: 'Abrir notificações' },
  },
  {
    id: 'visual',
    icon: Palette,
    title: 'Deixe do seu jeito',
    summary: 'Leitura confortável de dia e de noite.',
    items: [
      'Configurações → Plano de fundo: Claro, Obsidian, Âmbar ou Lights out, e a cor de destaque.',
      'Modo leitura confortável e escolha da tipografia dos posts.',
      'Luz noturna automática: o filtro laranja liga sozinho no horário que você escolher.',
      'A barra direita começa recolhida; abra quando quiser buscar ou ver tópicos.',
    ],
    cta: { href: '/config', label: 'Personalizar' },
  },
  {
    id: 'atalhos',
    icon: Keyboard,
    title: 'Atalhos de teclado',
    summary: 'Para quem gosta de agilidade.',
    items: SHORTCUTS.map((s) => (
      <span key={s.label} className="inline-flex flex-wrap items-center gap-1.5">
        {s.keys.map((k) => (
          <Kbd key={k}>{k}</Kbd>
        ))}
        <span>— {s.label}</span>
      </span>
    )),
  },
  {
    id: 'atividade',
    icon: BarChart3,
    title: 'Sua atividade',
    summary: 'Acompanhe como você usa o Insight.',
    items: [
      'O botão de gráfico na barra direita (ou “Sua atividade” no menu ☰ do celular) mostra tempo de tela, posts vistos, vídeos assistidos, curtidas, comentários e reposts dos últimos 7 ou 30 dias.',
      'Esses números são só seus.',
    ],
  },
  {
    id: 'apoie',
    icon: Heart,
    title: 'Apoie e suba de nível',
    summary: 'Cada real vira um ponto de contribuição.',
    items: [
      'Doações via Pix liberam níveis de contribuinte com mais espaço para anexos, tópicos extras e efeitos de patente.',
      'Todo domingo o feed mostra o ranking semanal de contribuição — com direito a sequências no topo e viradas.',
      'Quem doa recebe um agradecimento no topo do feed para toda a comunidade.',
    ],
    cta: { href: '/apoie', label: 'Ver como apoiar' },
  },
  {
    id: 'nitro',
    icon: Zap,
    title: 'Insight Nitro',
    summary: 'Personalização completa do perfil.',
    items: [
      'Molduras, aberturas animadas, temas, estilos de nome, tags, títulos e o selo Nitro.',
      'Use o provador para testar tudo antes de assinar.',
      'Quem chega ao Nível 5 de contribuinte ganha o Nitro vitalício.',
    ],
    cta: { href: '/nitro', label: 'Conhecer o Nitro' },
  },
  {
    id: 'notebook',
    icon: NotebookPen,
    title: 'My Notebook',
    summary: 'Seu caderno privado (em testes fechados).',
    items: [
      'Notas em Markdown, diário, modo escritor para livros com capítulos, metas de palavras e grafo de ideias.',
      'Quando liberado, ele aparece logo abaixo de Início no menu.',
    ],
  },
];

const STORE = 'insight-tutorial-done';

export default function TutorialPage() {
  const [done, setDone] = useState<string[]>([]);

  useEffect(() => {
    try {
      const v = JSON.parse(localStorage.getItem(STORE) || '[]');
      if (Array.isArray(v)) setDone(v.map(String));
    } catch {
      /* começa do zero */
    }
  }, []);

  const toggle = (id: string) => {
    setDone((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      try {
        localStorage.setItem(STORE, JSON.stringify(next));
      } catch {
        /* modo privado */
      }
      return next;
    });
  };

  const pct = useMemo(() => Math.round((done.filter((d) => STEPS.some((s) => s.id === d)).length / STEPS.length) * 100), [done]);

  return (
    <div className="px-4 sm:px-8 py-6 sm:py-8 max-w-3xl mx-auto space-y-6">
      <header className="space-y-3">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-surface border border-border text-[11px] font-bold uppercase tracking-wider text-accent">
          <GraduationCap className="w-3.5 h-3.5" /> Tutorial
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-primary tracking-tight">Tudo o que dá para fazer no Insight*</h1>
        <p className="text-sm text-secondary">Siga os passos no seu ritmo. Marque cada um como visto para acompanhar o progresso.</p>
        <div className="flex items-center gap-3">
          <div className="flex-1 h-2 rounded-full bg-elevated overflow-hidden" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
            <div className="h-full bg-accent transition-all duration-500" style={{ width: `${pct}%` }} />
          </div>
          <span className="text-xs font-mono font-bold text-accent w-10 text-right">{pct}%</span>
        </div>
      </header>

      {/* Índice */}
      <nav aria-label="Passos" className="flex flex-wrap gap-1.5">
        {STEPS.map((s, i) => (
          <a
            key={s.id}
            href={`#${s.id}`}
            className={`px-2.5 py-1 rounded-full text-[11px] font-bold border transition-colors ${
              done.includes(s.id) ? 'bg-accent/15 border-accent/40 text-accent' : 'border-border text-secondary hover:text-primary'
            }`}
          >
            {i + 1}. {s.title}
          </a>
        ))}
      </nav>

      <ol className="space-y-4">
        {STEPS.map((s, i) => {
          const Icon = s.icon;
          const isDone = done.includes(s.id);
          return (
            <li key={s.id} id={s.id} className={`scroll-mt-20 rounded-2xl border p-5 transition-colors ${isDone ? 'border-accent/40 bg-accent/[0.04]' : 'border-border bg-surface/40'}`}>
              <div className="flex items-start gap-3">
                <span className="w-9 h-9 rounded-xl bg-accent/15 text-accent flex items-center justify-center shrink-0">
                  <Icon className="w-4.5 h-4.5" />
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-muted">Passo {i + 1}</p>
                  <h2 className="text-base font-extrabold text-primary">{s.title}</h2>
                  <p className="text-xs text-muted">{s.summary}</p>
                </div>
              </div>
              <ul className="mt-4 space-y-2 text-sm text-secondary leading-relaxed list-disc pl-5 marker:text-accent">
                {s.items.map((it, k) => (
                  <li key={k}>{it}</li>
                ))}
              </ul>
              <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => toggle(s.id)}
                  aria-pressed={isDone}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border ${
                    isDone ? 'bg-accent text-white border-accent' : 'border-border text-primary hover:border-accent'
                  }`}
                >
                  {isDone ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Circle className="w-3.5 h-3.5" />}
                  {isDone ? 'Visto' : 'Marcar como visto'}
                </button>
                {s.cta && (
                  <Link href={s.cta.href} className="inline-flex items-center gap-1 text-xs font-bold text-accent hover:underline">
                    {s.cta.label} <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
