'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import {
  Sparkles,
  Compass,
  Rocket,
  Code,
  Database,
  Layers,
  Github,
  Users,
  CheckCircle2,
  Clock,
  ArrowUpRight,
  Cpu,
  Mail,
  Heart,
  BookOpen,
  GitBranch,
  ChevronDown,
  ChevronUp,
  Terminal,
  Shield,
  Zap,
  Globe,
} from 'lucide-react';

interface ProjectStats {
  posts: number;
  subscribers: number;
  topics: number;
  updates: number;
}

type RoadmapPhaseKey = 'v1' | 'v1_2' | 'v2';

const ROADMAP_PHASES: Record<
  RoadmapPhaseKey,
  {
    version: string;
    title: string;
    status: string;
    statusColor: string;
    summary: string;
    items: { label: string; done: boolean; desc: string }[];
  }
> = {
  v1: {
    version: 'Fase 1 · Versão 1.0 (Atual)',
    title: 'Fundação Autoral & Motor Notion',
    status: 'Concluído e No Ar',
    statusColor: '#1DB954',
    summary:
      'Refatoração completa do antigo protótipo em Vanilla JS ("Post It") para uma arquitetura moderna full-stack com banco de dados em tempo real e editor proprietário de blocos.',
    items: [
      {
        label: 'Editor de Blocos Estilo Notion',
        done: true,
        desc: 'Escrita modular com suporte a comandos "/", drag-and-drop de blocos, grifos multicoloridos, citações, código, imagens redimensionáveis e embeds do Spotify.',
      },
      {
        label: 'Tópicos Dinâmicos & Jardim Digital',
        done: true,
        desc: 'Criação de abas temáticas personalizadas com banner próprio, cor de destaque e introdução rica para catalogar assuntos específicos.',
      },
      {
        label: 'Newsletter Inteligente via Resend',
        done: true,
        desc: 'Notificações por e-mail sem algoritmos, permitindo que cada leitor filtre se deseja receber tudo, apenas fixados ou somente hashtags do seu interesse.',
      },
      {
        label: 'Acessibilidade & Temas Persistentes',
        done: true,
        desc: 'Alternância instantânea entre Modo Escuro, Modo Claro, Alto Contraste e controle de escala tipográfica salvos localmente.',
      },
    ],
  },
  v1_2: {
    version: 'Fase 2 · Versão 1.2 (Próximo Passo)',
    title: 'Interatividade Profunda & Threads Expansíveis',
    status: 'Em Planejamento',
    statusColor: '#38bdf8',
    summary:
      'Evolução da experiência de leitura comunitária, permitindo conversas ramificadas sem poluir o fluxo visual minimalista do feed.',
    items: [
      {
        label: 'Respostas e Threads em Cards Expansíveis',
        done: false,
        desc: 'Sistema de comentários inline que se abrem suavemente dentro do próprio card da publicação, evitando janelas modais intrusivas.',
      },
      {
        label: 'Reações Rápidas e Favoritos por Bloco',
        done: false,
        desc: 'Possibilidade de destacar trechos específicos de um artigo longo ou salvar publicações para leitura posterior.',
      },
      {
        label: 'Busca Semântica e Filtro Combinado',
        done: false,
        desc: 'Pesquisa instantânea cruzando múltiplas tags, datas de publicação e tipos de mídia (áudio, código ou ensaios).',
      },
      {
        label: ' Modo Leitura Imersiva para Artigos ("Artigue")',
        done: false,
        desc: 'Layout focado com tempo estimado de leitura e sumário automático gerado a partir dos cabeçalhos H1 e H2 do post.',
      },
    ],
  },
  v2: {
    version: 'Fase 3 · Versão 2.0 (Visão de Futuro)',
    title: 'Ecossistema Aberto, Colunistas & PWA',
    status: 'Visão de Longo Prazo',
    statusColor: '#a855f7',
    summary:
      'Transformar o Insight* em uma plataforma de publicação independente de referência, conectada a protocolos abertos da web.',
    items: [
      {
        label: 'Suporte a Colunistas e Coautores Convidados',
        done: false,
        desc: 'Abertura para colaboradores selecionados publicarem artigos técnicos e ensaios dentro de tópicos dedicados.',
      },
      {
        label: 'Aplicativo Web Progressivo (PWA Offline-First)',
        done: false,
        desc: 'Instalação direta no celular e desktop com sincronização de rascunhos e leitura mesmo sem conexão à internet.',
      },
      {
        label: 'Feed RSS/Atom Nativo & API Pública de Leitura',
        done: false,
        desc: 'Integração aberta para leitores de RSS e desenvolvedores que queiram consumir publicações e changelogs via JSON.',
      },
      {
        label: 'Exportação Direta em Markdown e PDF',
        done: false,
        desc: 'Ferramenta para transformar qualquer postagem ou tópico do Jardim Digital em documento portátil com um clique.',
      },
    ],
  },
};

const TECH_STACK = [
  {
    name: 'Next.js 15 (App Router)',
    category: 'Core & Rotas Full-Stack',
    icon: Layers,
    desc: 'Estrutura baseada em componentes React modernos, combinando renderização rápida no cliente com Route Handlers serverless (/api/newsletter) para processamento seguro.',
  },
  {
    name: 'TypeScript Estrito',
    category: 'Segurança de Tipos',
    icon: Code,
    desc: 'Modelagem completa das estruturas de dados (PostBlock, CustomTopic, Profile e Subscribers), garantindo zero inconsistências entre o editor visual e o banco de dados.',
  },
  {
    name: 'Supabase (PostgreSQL + RLS)',
    category: 'Banco de Dados, Auth & Storage',
    icon: Database,
    desc: 'Armazenamento relacional e JSONB para os blocos estilo Notion, políticas de Row Level Security (RLS), gatilhos PL/pgSQL para contagem automática e buckets públicos para imagens.',
  },
  {
    name: 'Notion-Like Block Engine',
    category: 'Tecnologia Proprietária de Escrita',
    icon: Terminal,
    desc: 'Motor contentEditable construído sob medida que converte cada parágrafo, código, callout, citação ou embed do Spotify em objetos JSON independentes e reordenáveis.',
  },
  {
    name: 'Tailwind CSS + CSS Variables',
    category: 'Design System & Temas',
    icon: Cpu,
    desc: 'Arquitetura semântica de tokens visuais (--background, --surface, --accent) que permite trocar temas e ativar o Alto Contraste em tempo real sem recarregar a página.',
  },
  {
    name: 'Resend API',
    category: 'Engenharia de E-mails',
    icon: Mail,
    desc: 'Conversor dinâmico que transforma os blocos do editor Notion em tabelas HTML compatíveis com Gmail e Outlook, disparando alertas segmentados por hashtag.',
  },
];

const COLLABORATION_AREAS = [
  {
    role: 'Engenharia & Open-Source',
    desc: 'Otimização de performance em React/Next.js, novos blocos para o editor e revisões de código no GitHub.',
    tag: 'Pull Requests & Issues',
  },
  {
    role: 'UI/UX & Acessibilidade',
    desc: 'Refinamento de microinterações, testes de leitura em dispositivos móveis e melhorias contínuas de contraste.',
    tag: 'Design System',
  },
  {
    role: 'Beta Testers & Caça-Bugs',
    desc: 'Usuários ativos que testam novas versões listadas no Mural de Notificações e reportam comportamentos inesperados.',
    tag: 'QA Comunitário',
  },
  {
    role: 'Curadoria & Ideias de Tópicos',
    desc: 'Sugestão de pautas técnicas, discussões literárias, cultura pop e novos recursos para as próximas fases do roadmap.',
    tag: 'Comunidade',
  },
];

export default function AboutPage() {
  const [stats, setStats] = useState<ProjectStats>({
    posts: 8,
    subscribers: 2,
    topics: 5,
    updates: 1,
  });
  const [activePhase, setActivePhase] = useState<RoadmapPhaseKey>('v1');
  const [expandHowToCollab, setExpandHowToCollab] = useState(false);

  const supabase = createClient();

  useEffect(() => {
    async function fetchLiveStats() {
      const [postsRes, subsRes, topicsRes, updatesRes] = await Promise.all([
        supabase.from('posts').select('*', { count: 'exact', head: true }),
        supabase.from('subscribers').select('*', { count: 'exact', head: true }),
        supabase.from('custom_topics').select('*', { count: 'exact', head: true }),
        supabase.from('updates').select('*', { count: 'exact', head: true }),
      ]);

      setStats({
        posts: postsRes.count ?? 8,
        subscribers: subsRes.count ?? 2,
        topics: 5 + (topicsRes.count ?? 0),
        updates: updatesRes.count ?? 1,
      });
    }

    fetchLiveStats();
  }, [supabase]);

  const currentRoadmap = ROADMAP_PHASES[activePhase];

  return (
    <div className="p-5 sm:p-7 space-y-8">
      {/* 1. HERO & MANIFESTO */}
      <header className="relative p-6 sm:p-8 rounded-3xl bg-surface border border-border overflow-hidden space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-accent/15 border border-accent/40 text-accent text-[11px] font-extrabold uppercase tracking-wider">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Manifesto & Arquitetura · Insight* v1.0</span>
          </span>

          <a
            href="https://github.com/VictorPoiani"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-elevated border border-border hover:border-accent text-xs font-bold text-secondary hover:text-primary transition-colors"
          >
            <Github className="w-3.5 h-3.5 text-accent" />
            <span>github.com/VictorPoiani</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </a>
        </div>

        <div className="space-y-3">
          <h1 className="text-2xl sm:text-3xl font-black text-primary leading-tight tracking-tight">
            Mais que um microblog: um espaço autoral livre de algoritmos para ideias que merecem permanecer.
          </h1>
          <p className="text-xs sm:text-sm text-secondary leading-relaxed max-w-2xl">
            O <strong className="text-primary">Insight*</strong> nasceu da necessidade de unir a velocidade de uma rede social minimalista com a profundidade de um <strong className="text-primary">Jardim Digital</strong>. Tudo guiado por uma única filosofia central: <span className="text-accent font-extrabold">&ldquo;Apenas poste.&rdquo;</span>
          </p>
        </div>

        {/* Barra de Métricas Vivas do Banco */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-2">
          {[
            { label: 'Insights Publicados', value: stats.posts + '+' },
            { label: 'Tópicos Ativos', value: stats.topics },
            { label: 'Leitores Inscritos', value: stats.subscribers },
            { label: 'Patches no Mural', value: stats.updates },
          ].map((item) => (
            <div
              key={item.label}
              className="p-3 rounded-2xl bg-elevated border border-border text-center"
            >
              <p className="text-lg sm:text-xl font-black text-accent">
                {item.value}
              </p>
              <p className="text-[11px] text-secondary font-medium">
                {item.label}
              </p>
            </div>
          ))}
        </div>
      </header>

      {/* 2. NOSSO OBJETIVO E A ORIGEM DO PROJETO */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <Compass className="w-5 h-5 text-accent" />
          <h2 className="text-lg font-extrabold text-primary">
            1. O Nosso Objetivo: Por que o Insight* existe?
          </h2>
        </div>

        <div className="p-5 sm:p-6 rounded-2xl bg-surface border border-border space-y-4 text-xs sm:text-sm text-primary/90 leading-relaxed">
          <p>
            Nas redes sociais tradicionais, o conteúdo que você produz é refém de dois problemas: a <strong className="text-primary">efemeridade</strong> (um texto trabalhado desaparece do feed em 24 horas) e a <strong className="text-primary">tirania algorítmica</strong> (que força criadores a escreverem apenas o que gera cliques artificiais, e não o que realmente importa).
          </p>
          <p>
            Iniciado originalmente sob o codinome <em>Post It</em> em Vanilla JavaScript e posteriormente reconstruído do zero em uma stack moderna, o <strong className="text-primary">Insight*</strong> foi projetado para resolver essa lacuna. O objetivo é ser uma <strong className="text-primary">casa digital permanente</strong> — onde um insight rápido de duas linhas, um desabafo em relação ao seu desemprego frente a revolução da IA, uma crítica ao final de <em>Game of Thrones</em>, sua torcida a seu time do coração ou até mesmo um artigo técnico profundo coexistem com a mesma dignidade visual.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
            <div className="p-4 rounded-xl bg-elevated border border-border space-y-1.5">
              <div className="flex items-center gap-2 text-accent font-bold text-xs">
                <Zap className="w-4 h-4" />
                <span>Zero Fricção Criativa</span>
              </div>
              <p className="text-xs text-secondary leading-relaxed">
                Com um escrita dinamica e modernamente integrada direta no feed, você transforma pensamentos em publicações ricas sem sair da página inicial.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-elevated border border-border space-y-1.5">
              <div className="flex items-center gap-2 text-accent font-bold text-xs">
                <BookOpen className="w-4 h-4" />
                <span>Curadoria por Tópicos</span>
              </div>
              <p className="text-xs text-secondary leading-relaxed">
                Em vez de uma linha do tempo caótica, o conteúdo é organizado em abas temáticas e hashtags que funcionam como prateleiras vivas do seu conhecimento.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-elevated border border-border space-y-1.5">
              <div className="flex items-center gap-2 text-accent font-bold text-xs">
                <Globe className="w-4 h-4" />
                <span>Entrega 100% Direta</span>
              </div>
              <p className="text-xs text-secondary leading-relaxed">
                Quem acompanha o blog não depende de sorte para ver um post novo: nossa integração de e-mail entrega exatamente os temas que o leitor escolheu seguir.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 3. ONDE QUEREMOS CHEGAR: ROADMAP E PLANOS PARA O FUTURO */}
      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Rocket className="w-5 h-5 text-accent" />
            <h2 className="text-lg font-extrabold text-primary">
              2. Onde Queremos Chegar (Roadmap & Futuro)
            </h2>
          </div>
          <span className="text-[11px] text-muted">
            Clique nas fases abaixo para explorar o plano de evolução
          </span>
        </div>

        {/* Seletor Interativo de Fases do Roadmap */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          {(
            [
              { key: 'v1', label: 'v1.0 · Fundação Atual', sub: 'No Ar' },
              { key: 'v1_2', label: 'v1.2 · Comunidade', sub: 'Curto Prazo' },
              { key: 'v2', label: 'v2.0 · Ecossistema Aberto', sub: 'Longo Prazo' },
            ] as { key: RoadmapPhaseKey; label: string; sub: string }[]
          ).map((tab) => {
            const active = activePhase === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActivePhase(tab.key)}
                className={`p-3.5 rounded-2xl border text-left transition-all ${
                  active
                    ? 'bg-accent/15 border-accent text-primary shadow-md'
                    : 'bg-surface border-border text-secondary hover:text-primary'
                }`}
              >
                <p className="text-xs font-extrabold">{tab.label}</p>
                <p className="text-[11px] text-muted mt-0.5">{tab.sub}</p>
              </button>
            );
          })}
        </div>

        {/* Card Detalhado da Fase Selecionada */}
        <div className="p-5 sm:p-6 rounded-2xl bg-surface border border-border space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3.5">
            <div>
              <p className="text-[11px] font-bold text-accent uppercase tracking-wider">
                {currentRoadmap.version}
              </p>
              <h3 className="text-base sm:text-lg font-extrabold text-primary mt-0.5">
                {currentRoadmap.title}
              </h3>
            </div>

            <span
              style={{
                borderColor: currentRoadmap.statusColor,
                color: currentRoadmap.statusColor,
              }}
              className="px-3 py-1 rounded-full border text-[11px] font-bold bg-elevated"
            >
              ● {currentRoadmap.status}
            </span>
          </div>

          <p className="text-xs sm:text-sm text-secondary leading-relaxed">
            {currentRoadmap.summary}
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            {currentRoadmap.items.map((item) => (
              <div
                key={item.label}
                className="p-3.5 rounded-xl bg-elevated border border-border flex items-start gap-3"
              >
                {item.done ? (
                  <CheckCircle2 className="w-4 h-4 text-[#1DB954] shrink-0 mt-0.5" />
                ) : (
                  <Clock className="w-4 h-4 text-accent shrink-0 mt-0.5" />
                )}
                <div className="space-y-1">
                  <p className="text-xs font-bold text-primary">{item.label}</p>
                  <p className="text-[11px] text-secondary leading-relaxed">
                    {item.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 4. FERRAMENTAS TÉCNICAS E ENGENHARIA (UNDER THE HOOD) */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Code className="w-5 h-5 text-accent" />
            <h2 className="text-lg font-extrabold text-primary">
              3. Ferramentas Técnicas & Arquitetura
            </h2>
          </div>
          <span className="text-[11px] text-muted hidden sm:inline">
            Stack de Produção
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {TECH_STACK.map((tech) => {
            const Icon = tech.icon;
            return (
              <div
                key={tech.name}
                className="p-4 sm:p-5 rounded-2xl bg-surface border border-border hover:border-accent/40 transition-colors space-y-2.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-xl bg-elevated border border-border text-accent">
                      <Icon className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-xs sm:text-sm font-extrabold text-primary">
                        {tech.name}
                      </h3>
                      <p className="text-[10px] font-semibold text-accent">
                        {tech.category}
                      </p>
                    </div>
                  </div>
                </div>

                <p className="text-xs text-secondary leading-relaxed">
                  {tech.desc}
                </p>
              </div>
            );
          })}
        </div>
      </section>

      {/* 5. ÁREA DE COLABORADORES, COMUNIDADE E CRIADOR */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <Users className="w-5 h-5 text-accent" />
          <h2 className="text-lg font-extrabold text-primary">
            4. Criador & Área de Colaboradores
          </h2>
        </div>

        {/* Card Principal do Criador */}
        <div className="p-5 sm:p-6 rounded-2xl bg-surface border border-border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2.5 py-0.5 rounded-full bg-accent text-white text-[10px] font-extrabold uppercase">
                Idealizador & Lead Dev
              </span>
              <span className="text-xs text-muted">
                Rio Paranaíba, MG · Sistemas de Informação (UFV-CRP)
              </span>
            </div>
            <h3 className="text-base sm:text-lg font-black text-primary">
              Victor Poiani{' '}
              <span className="text-[#E63946] font-bold">
                · Desenvolvedor & Criador
              </span>
            </h3>
            <p className="text-xs text-secondary leading-relaxed max-w-xl">
              Responsável pela arquitetura full-stack, concepção do sistema de blocos estilo Notion, banco de dados no Supabase e curadoria editorial do Insight*.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <a
              href="https://github.com/VictorPoiani"
              target="_blank"
              rel="noopener noreferrer"
              className="px-3.5 py-2 rounded-xl bg-elevated border border-border hover:border-accent text-xs font-bold text-primary flex items-center gap-1.5 transition-colors"
            >
              <Github className="w-4 h-4 text-accent" />
              <span>GitHub</span>
            </a>
            <a
              href="https://www.instagram.com/victorpoiani/"
              target="_blank"
              rel="noopener noreferrer"
              className="px-3.5 py-2 rounded-xl bg-accent text-white text-xs font-bold hover:bg-accent-hover flex items-center gap-1.5 transition-colors"
            >
              <span>Instagram</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>

        {/* Cadeiras Abertas / Frentes de Colaboração */}
        <div className="p-5 sm:p-6 rounded-2xl bg-surface border border-border space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-extrabold text-primary">
                Frentes Abertas para Colaboradores
              </h3>
              <p className="text-xs text-secondary mt-0.5">
                O Insight* é construído em público. Veja como você pode participar da evolução da plataforma:
              </p>
            </div>

            <button
              type="button"
              onClick={() => setExpandHowToCollab(!expandHowToCollab)}
              className="px-3.5 py-1.5 rounded-xl bg-elevated border border-border hover:border-accent text-xs font-bold text-accent flex items-center gap-1.5 transition-colors"
            >
              <GitBranch className="w-3.5 h-3.5" />
              <span>Como entrar para o mural</span>
              {expandHowToCollab ? (
                <ChevronUp className="w-3.5 h-3.5" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5" />
              )}
            </button>
          </div>

          {/* Card Expansível: Passo a passo para colaborar */}
          {expandHowToCollab && (
            <div className="p-4 rounded-xl bg-elevated border border-accent/40 space-y-2.5 text-xs text-secondary">
              <p className="font-bold text-primary">
                Como colaborar tecnicamente ou com ideias:
              </p>
              <ol className="list-decimal list-inside space-y-1.5 leading-relaxed">
                <li>
                  Acesse nosso perfil no GitHub (
                  <a
                    href="https://github.com/VictorPoiani"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-accent font-bold hover:underline"
                  >
                    github.com/VictorPoiani
                  </a>
                  ) para acompanhar os repositórios, abrir <em>Issues</em> ou enviar <em>Pull Requests</em>.
                </li>
                <li>
                  Encontrou um bug ou teve uma ideia de feature? Envie uma sugestão direta na DM do criador ou interaja nos posts com a tag <strong className="text-primary">#projetos</strong>.
                </li>
                <li>
                  Todos os contribuidores que tiverem código, design ou sugestões implementadas serão listados oficialmente nesta seção com link para seu respectivo GitHub.
                </li>
              </ol>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {COLLABORATION_AREAS.map((area) => (
              <div
                key={area.role}
                className="p-3.5 rounded-xl bg-elevated border border-border space-y-1.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-extrabold text-primary">
                    {area.role}
                  </p>
                  <span className="px-2 py-0.5 rounded-full bg-surface border border-border text-[10px] font-bold text-accent">
                    {area.tag}
                  </span>
                </div>
                <p className="text-[11px] text-secondary leading-relaxed">
                  {area.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 6. BANNER FINAL: GITHUB OFICIAL & NAVEGAÇÃO RÁPIDA */}
      <footer className="p-6 rounded-3xl bg-elevated border border-border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs font-extrabold text-accent uppercase tracking-wider">
            <Shield className="w-4 h-4" />
            <span>Código, Transparência & Apoio</span>
          </div>
          <h3 className="text-base font-extrabold text-primary">
            Explore os bastidores ou impulsione o projeto
          </h3>
          <p className="text-xs text-secondary">
            Confira nossos repositórios no GitHub, acompanhe o changelog técnico ou apoie a manutenção do servidor.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <a
            href="https://github.com/VictorPoiani"
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2.5 rounded-xl bg-accent text-white text-xs font-bold hover:bg-accent-hover flex items-center gap-2 shadow-md transition-colors"
          >
            <Github className="w-4 h-4" />
            <span>Ver GitHub Oficial</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </a>

          <Link
            href="/notificacoes"
            className="px-3.5 py-2.5 rounded-xl bg-surface border border-border hover:border-accent text-xs font-bold text-primary transition-colors"
          >
            Mural de Atualizações
          </Link>

          <Link
            href="/apoie"
            className="px-3.5 py-2.5 rounded-xl bg-surface border border-border hover:border-accent text-xs font-bold text-secondary hover:text-primary flex items-center gap-1.5 transition-colors"
          >
            <Heart className="w-3.5 h-3.5 text-accent" />
            <span>Apoiar</span>
          </Link>
        </div>
      </footer>
    </div>
  );
}