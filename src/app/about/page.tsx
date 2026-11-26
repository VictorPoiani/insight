'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  ArrowUpRight,
  Github,
  Heart,
  Zap,
  BookOpen,
  ShieldCheck,
  Feather,
  Layers,
  Database,
  Cloud,
  Cpu,
  CreditCard,
  Film,
  Code2,
  Sparkles,
  Users,
  Bug,
  Palette,
  Lightbulb,
  Check,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { InsightAsterisk } from '@/components/brand/InsightAsterisk';
import './about.css';
import { NOTEBOOK_NAME } from '@/lib/notebook/copy';

const FOUNDER_ID = '96d271a9-9102-49b1-b593-9279c5dfe3f4';
const WORDS = ['poemas', 'códigos', 'desabafos', 'teorias', 'análises', 'projetos', 'memórias'];
const TAGS_A = ['#dev', '#poesia', '#futebol', '#ia', '#musica', '#cinema', '#livros', '#games', '#filosofia', '#design', '#ciencia', '#carreira'];
const TAGS_B = ['#rock', '#projetos', '#artigue', '#anime', '#estudos', '#fotografia', '#startups', '#series', '#historia', '#academia', '#culinaria', '#viagem'];

/* -------------------------------------------------------------------------- */
/* Ganchos                                                                    */
/* -------------------------------------------------------------------------- */

/** Adiciona "in" quando o elemento entra na tela (uma vez). */
function useReveal<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const els = root.querySelectorAll('.ab-reveal, .ab-line, .ab-draw');
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            e.target.classList.add('in');
            io.unobserve(e.target);
          }
        }
      },
      { threshold: 0.18 }
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);
  return ref;
}

/** Número que sobe até o valor quando aparece. */
function CountUp({ value, suffix = '' }: { value: number; suffix?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [shown, setShown] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let raf = 0;
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      io.disconnect();
      const start = performance.now();
      const dur = 1400;
      const tick = (t: number) => {
        const p = Math.min(1, (t - start) / dur);
        setShown(Math.round(value * (1 - Math.pow(1 - p, 3))));
        if (p < 1) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    });
    io.observe(el);
    return () => {
      io.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [value]);
  return (
    <span ref={ref} className="tabular-nums">
      {shown.toLocaleString('pt-BR')}
      {suffix}
    </span>
  );
}

/** Brilho que segue o mouse (variáveis --mx/--my). */
function trackGlow(e: React.MouseEvent<HTMLElement>) {
  const r = e.currentTarget.getBoundingClientRect();
  e.currentTarget.style.setProperty('--mx', `${e.clientX - r.left}px`);
  e.currentTarget.style.setProperty('--my', `${e.clientY - r.top}px`);
}

/* -------------------------------------------------------------------------- */
/* Ilustrações                                                                */
/* -------------------------------------------------------------------------- */

function MiniCard({ className = '', style, children }: { className?: string; style?: React.CSSProperties; children: React.ReactNode }) {
  return (
    <div style={style} className={`absolute rounded-2xl border border-border bg-surface/90 backdrop-blur shadow-[0_20px_50px_-20px_rgba(0,0,0,0.55)] p-3 ${className}`}>
      {children}
    </div>
  );
}

function Lines({ n = 3, w = ['90%', '75%', '55%'] }: { n?: number; w?: string[] }) {
  return (
    <div className="space-y-1.5">
      {Array.from({ length: n }).map((_, i) => (
        <div key={i} className="h-1.5 rounded-full bg-border" style={{ width: w[i % w.length] }} />
      ))}
    </div>
  );
}

/** Composição do hero: asterisco em órbita + cartões de post flutuando (parallax). */
function HeroArt({ tilt }: { tilt: { x: number; y: number } }) {
  const t = (k: number) => ({ transform: `translate3d(${tilt.x * k}px, ${tilt.y * k}px, 0)` });
  return (
    <div className="relative w-full aspect-square max-w-[460px] mx-auto">
      {/* anéis */}
      <svg viewBox="0 0 400 400" className="absolute inset-0 w-full h-full ab-spin-rev" aria-hidden>
        <circle cx="200" cy="200" r="190" fill="none" stroke="var(--border)" strokeDasharray="2 10" />
        <circle cx="200" cy="200" r="140" fill="none" stroke="var(--border)" strokeOpacity="0.7" />
        <circle cx="390" cy="200" r="5" fill="var(--accent)" />
        <circle cx="60" cy="100" r="3" fill="#e879f9" />
      </svg>
      <div className="absolute inset-[28%] ab-spin" style={t(0.4)}>
        <InsightAsterisk className="w-full h-full drop-shadow-[0_0_40px_rgba(37,99,235,0.45)]" />
      </div>

      {/* post de texto */}
      <div style={t(1.2)} className="absolute left-[2%] top-[8%] w-[46%]">
        <MiniCard className="ab-bob relative">
          <div className="flex items-center gap-2 mb-2">
            <span className="w-6 h-6 rounded-full bg-gradient-to-br from-sky-400 to-indigo-500" />
            <span className="h-1.5 w-16 rounded-full bg-border" />
          </div>
          <Lines />
          <div className="mt-2 flex gap-3 text-[9px] text-muted">
            <span>♥ 24</span>
            <span>↻ 6</span>
          </div>
        </MiniCard>
      </div>

      {/* enquete */}
      <div style={t(-1)} className="absolute right-[0%] top-[22%] w-[42%]">
        <MiniCard className="ab-bob d2 relative">
          <p className="text-[10px] font-bold text-primary mb-1.5">Melhor final de série?</p>
          {[62, 28, 10].map((p, i) => (
            <div key={i} className="mb-1 h-4 rounded-md bg-elevated overflow-hidden relative">
              <div className="h-full bg-accent/60 rounded-md" style={{ width: `${p}%`, opacity: 0.4 + 0.3 * (2 - i) }} />
              <span className="absolute right-1.5 top-0.5 text-[8px] text-secondary">{p}%</span>
            </div>
          ))}
        </MiniCard>
      </div>

      {/* música */}
      <div style={t(0.8)} className="absolute left-[8%] bottom-[10%] w-[44%]">
        <MiniCard className="ab-bob d3 relative flex items-center gap-2">
          <span className="w-9 h-9 rounded-lg bg-gradient-to-br from-emerald-400 to-teal-600 shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="h-1.5 w-20 rounded-full bg-border mb-1.5" />
            <div className="h-1.5 w-12 rounded-full bg-border" />
          </div>
          <span className="ab-eq flex items-end gap-[3px] h-4 text-[#1DB954]">
            <i /> <i /> <i /> <i />
          </span>
        </MiniCard>
      </div>

      {/* poema */}
      <div style={t(-1.4)} className="absolute right-[4%] bottom-[4%] w-[40%]">
        <MiniCard className="ab-bob relative">
          <p className="text-[9px] font-black uppercase tracking-[0.2em] text-amber-500 mb-1">Poema</p>
          <p className="text-[10px] italic text-secondary leading-snug" style={{ fontFamily: 'Georgia, serif' }}>
            antes, e com tal zelo,
            <br />e sempre, e tanto…
          </p>
        </MiniCard>
      </div>
    </div>
  );
}

/** Algoritmo × jardim (o problema e a resposta). */
function ChaosArt() {
  return (
    <svg viewBox="0 0 240 160" className="w-full h-40 ab-draw" aria-hidden>
      <g fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <path d="M20 30 C 60 10, 70 80, 110 50 S 160 120, 200 40" opacity="0.5" />
        <path d="M30 120 C 70 60, 90 140, 130 90 S 180 20, 215 110" opacity="0.35" />
        <path d="M95 20 L 145 20 L 125 70 L 125 120 L 115 120 L 115 70 Z" />
        <line x1="120" y1="125" x2="120" y2="150" strokeDasharray="3 5" />
      </g>
      {[[30, 25], [60, 60], [180, 30], [200, 100], [45, 110], [170, 135]].map(([x, y], i) => (
        <rect key={i} x={x} y={y} width="16" height="10" rx="2" fill="currentColor" opacity={0.15 + (i % 3) * 0.1} />
      ))}
    </svg>
  );
}

function GardenArt() {
  return (
    <svg viewBox="0 0 240 160" className="w-full h-40 ab-draw" aria-hidden>
      <g fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <line x1="20" y1="140" x2="220" y2="140" />
        <path d="M60 140 C 60 110, 60 90, 60 70" />
        <path d="M60 100 C 40 95, 35 80, 38 70 C 52 74, 60 86, 60 100" />
        <path d="M60 88 C 78 82, 84 68, 82 58 C 68 62, 60 74, 60 88" />
        <path d="M120 140 C 120 110, 120 70, 120 40" />
        <path d="M120 80 C 96 74, 92 56, 96 44 C 112 50, 120 64, 120 80" />
        <path d="M120 62 C 142 56, 148 40, 144 28 C 128 34, 120 48, 120 62" />
        <path d="M180 140 C 180 120, 180 104, 180 92" />
        <circle cx="180" cy="84" r="10" />
      </g>
      <circle cx="120" cy="34" r="5" fill="var(--accent)" />
      <circle cx="60" cy="64" r="4" fill="#f59e0b" />
    </svg>
  );
}

/* -------------------------------------------------------------------------- */
/* Conteúdo                                                                   */
/* -------------------------------------------------------------------------- */

const PILLARS = [
  { icon: Zap, title: 'Zero fricção', text: 'Você escreve direto no feed, em blocos, como num caderno. Do pensamento ao post em segundos.' },
  { icon: BookOpen, title: 'Tópicos, não timeline', text: 'Cada perfil organiza o que publica em abas temáticas, que funcionam como prateleiras vivas.' },
  { icon: Sparkles, title: 'Sem algoritmo pago', text: 'Ninguém compra alcance. O que aparece é o que a comunidade publica, em ordem e por tema.' },
  { icon: ShieldCheck, title: 'Seguro por padrão', text: 'Moderação automática antes de publicar, +18 borrado e revisão humana quando há dúvida.' },
];

const SHOWCASE = [
  { src: '/tutorial/composer-slash.webp', title: 'Editor em blocos', text: '18 tipos de bloco: texto, enquete, mapa mental, música, código…', span: 'sm:col-span-2 sm:row-span-2', pos: '0% 0%' },
  { src: '/tutorial/topic-poemas.webp', title: 'Poemas & Livros', text: `Um mural de escritos ligado ao ${NOTEBOOK_NAME}.`, span: '', pos: '50% 78%' },
  { src: '/tutorial/topic-habitos.webp', title: 'Tópicos que trabalham', text: 'Metas, hábitos, agenda, dieta e mais.', span: '', pos: '50% 80%' },
  { src: '/tutorial/carousel.webp', title: 'Carrossel', text: 'Mídias seguidas viram galeria.', span: 'sm:col-span-2', pos: '50% 60%' },
  { src: '/tutorial/ranking.webp', title: 'Domingo de ranking', text: 'Quem apoia o projeto ganha a manchete.', span: 'sm:col-span-2', pos: '0% 0%' },
  { src: '/tutorial/mention.webp', title: 'Menções', text: 'Digite @ e chame a comunidade para a conversa.', span: 'sm:col-span-2', pos: '60% 30%' },
];

const TIMELINE = [
  { when: 'O começo', title: 'Post It', text: 'Um protótipo em JavaScript puro: um lugar para anotar ideias e publicar sem cerimônia.', done: true },
  { when: 'Versão 1.0', title: 'Insight*', text: 'Reconstruído do zero com Next.js e Supabase: editor em blocos, tópicos, temas e um feed sem algoritmo.', done: true },
  { when: 'Hoje', title: 'Comunidade', text: 'Respostas em conversa, menções, reposts com comentário, notícias, Insight Nitro, ranking de apoio e moderação automática.', done: true },
  { when: 'Insight 2.0', title: 'Aberto para todos', text: `Fim do beta fechado, Mensagens, ${NOTEBOOK_NAME} liberado, app instalável (PWA) e exportação dos seus escritos.`, done: false },
];

const STACK = [
  { icon: Layers, name: 'Next.js 15', role: 'App e rotas de servidor' },
  { icon: Code2, name: 'TypeScript', role: 'Tudo tipado, do editor ao banco' },
  { icon: Database, name: 'Supabase', role: 'Postgres, RLS e tempo real' },
  { icon: Cloud, name: 'Cloudflare R2', role: 'Fotos e vídeos' },
  { icon: Cpu, name: 'Vercel', role: 'Hospedagem e crons' },
  { icon: CreditCard, name: 'Mercado Pago', role: 'Pix e Insight Nitro' },
  { icon: ShieldCheck, name: 'OpenAI Moderation', role: 'Segurança do conteúdo' },
  { icon: Film, name: 'WebCodecs', role: 'Vídeo comprimido no navegador' },
];

const COLLAB = [
  { icon: Code2, title: 'Engenharia', text: 'Performance, novos blocos para o editor e revisões de código no GitHub.' },
  { icon: Palette, title: 'Design e acessibilidade', text: 'Microinterações, leitura no celular, contraste e temas.' },
  { icon: Bug, title: 'Testes e bugs', text: 'Experimentar as novidades do Mural de Atualizações e contar o que quebrou.' },
  { icon: Lightbulb, title: 'Ideias e curadoria', text: 'Pautas, tópicos e recursos para as próximas versões.' },
];

/* -------------------------------------------------------------------------- */
/* Página                                                                     */
/* -------------------------------------------------------------------------- */

export default function AboutPage() {
  const rootRef = useReveal<HTMLDivElement>();
  const [word, setWord] = useState(0);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const [stats, setStats] = useState({ posts: 0, members: 0, topics: 0, updates: 0 });
  const [founder, setFounder] = useState<{ avatar_url?: string | null; display_name?: string | null } | null>(null);

  // página imersiva: recolhe as barras laterais ao abrir e devolve ao sair
  useEffect(() => {
    if (window.matchMedia('(max-width: 767px)').matches) return;
    const emit = (collapse: boolean) => {
      window.dispatchEvent(new CustomEvent('insight-toggle-focus-mode', { detail: { collapse, auto: true } }));
    };
    emit(true);
    return () => emit(false);
  }, []);

  useEffect(() => {
    const id = setInterval(() => setWord((w) => (w + 1) % WORDS.length), 2200);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const supabase = createClient();
    (async () => {
      const [posts, members, topics, updates, prof] = await Promise.all([
        supabase.from('posts').select('id', { count: 'exact', head: true }),
        supabase.from('profiles').select('id', { count: 'exact', head: true }),
        supabase.from('custom_topics').select('id', { count: 'exact', head: true }),
        supabase.from('updates').select('id', { count: 'exact', head: true }),
        supabase.from('profiles').select('avatar_url, display_name').eq('id', FOUNDER_ID).maybeSingle(),
      ]);
      setStats({ posts: posts.count ?? 0, members: members.count ?? 0, topics: topics.count ?? 0, updates: updates.count ?? 0 });
      setFounder(prof.data ?? null);
    })();
  }, []);

  return (
    <div ref={rootRef} className="relative overflow-x-clip">
      {/* ============================== HERO ============================== */}
      <section
        className="relative px-5 sm:px-10 pt-12 sm:pt-16 pb-14 overflow-hidden"
        onMouseMove={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          setTilt({ x: ((e.clientX - r.left) / r.width - 0.5) * 16, y: ((e.clientY - r.top) / r.height - 0.5) * 16 });
        }}
        onMouseLeave={() => setTilt({ x: 0, y: 0 })}
      >
        <div className="ab-blob w-72 h-72 -left-20 -top-16" style={{ background: 'var(--accent)' }} />
        <div className="ab-blob w-80 h-80 right-[-6rem] top-24" style={{ background: '#c026d3', animationDelay: '-6s' }} />
        <div className="ab-blob w-64 h-64 left-1/3 bottom-[-8rem]" style={{ background: '#f59e0b', opacity: 0.25, animationDelay: '-12s' }} />

        <div className="relative max-w-6xl mx-auto grid lg:grid-cols-[1.1fr_1fr] gap-10 items-center">
          <div>
            <p className="ab-reveal inline-flex items-center gap-2 rounded-full border border-border bg-surface/70 backdrop-blur px-3 py-1 text-[11px] font-bold uppercase tracking-[0.2em] text-secondary">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> Sobre o Insight*
            </p>
            <h1 className="ab-reveal mt-5 text-[2.6rem] sm:text-6xl font-black leading-[1.02] tracking-tight text-primary" data-delay="1">
              Ideias que
              <br />
              merecem <span className="bg-gradient-to-r from-sky-400 via-fuchsia-400 to-amber-300 bg-clip-text text-transparent">ficar.</span>
            </h1>
            <p className="ab-reveal mt-5 text-lg sm:text-xl text-secondary leading-relaxed max-w-xl" data-delay="2">
              Uma rede social autoral, sem algoritmo pago, onde cabem{' '}
              <span key={WORDS[word]} className="ab-word-in inline-block font-bold text-primary" aria-live="polite">
                {WORDS[word]}
              </span>{' '}
              e tudo o que você pensa. A filosofia é uma só: <strong className="text-accent">apenas poste.</strong>
            </p>
            <div className="ab-reveal mt-7 flex flex-wrap gap-3" data-delay="3">
              <Link href="/" className="inline-flex items-center gap-2 px-5 py-3 rounded-full bg-accent text-white text-sm font-bold shadow-lg hover:scale-[1.03] transition-transform">
                Compartilhar um Insight <ArrowUpRight className="w-4 h-4" />
              </Link>
              <Link href="/tutorial" className="inline-flex items-center gap-2 px-5 py-3 rounded-full border border-border bg-surface/70 backdrop-blur text-sm font-bold text-primary hover:border-accent transition-colors">
                Ver o tutorial
              </Link>
            </div>
          </div>
          <div className="ab-reveal" data-delay="2">
            <HeroArt tilt={tilt} />
          </div>
        </div>

        {/* números ao vivo */}
        <div className="relative max-w-6xl mx-auto mt-12 grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { v: stats.posts, label: 'Insights publicados' },
            { v: stats.members, label: 'Membros' },
            { v: stats.topics, label: 'Tópicos criados' },
            { v: stats.updates, label: 'Atualizações no mural' },
          ].map((s, i) => (
            <div key={s.label} className="ab-reveal rounded-2xl border border-border bg-surface/60 backdrop-blur p-4" data-delay={String(i + 1)}>
              <p className="text-3xl sm:text-4xl font-black text-primary">
                <CountUp value={s.v} />
              </p>
              <p className="text-xs text-muted mt-1">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ============================== FAIXA DE TAGS ============================== */}
      <div className="relative border-y border-border bg-surface/40 py-3 space-y-2 overflow-hidden [mask-image:linear-gradient(90deg,transparent,black_10%,black_90%,transparent)]" aria-hidden>
        {[TAGS_A, TAGS_B].map((tags, row) => (
          <div key={row} className={`ab-marquee ${row ? 'rev' : ''}`}>
            {[...tags, ...tags].map((t, i) => (
              <span key={i} className={`mx-2 px-3 py-1 rounded-full border border-border text-sm font-semibold whitespace-nowrap ${i % 4 === 0 ? 'text-accent' : 'text-secondary'}`}>
                {t}
              </span>
            ))}
          </div>
        ))}
      </div>

      {/* ============================== MANIFESTO ============================== */}
      <section className="px-5 sm:px-10 py-20 max-w-6xl mx-auto">
        <p className="ab-reveal font-mono text-[11px] uppercase tracking-[0.3em] text-accent">Manifesto</p>
        <h2 className="ab-reveal mt-3 text-3xl sm:text-5xl font-black tracking-tight text-primary max-w-3xl leading-tight" data-delay="1">
          O feed das redes virou uma esteira. Aqui, ele volta a ser um jardim.
        </h2>
        <div className="mt-12 grid md:grid-cols-2 gap-5">
          <article className="ab-reveal rounded-3xl border border-border bg-surface/50 p-6 sm:p-8 text-rose-400" data-delay="1">
            <ChaosArt />
            <h3 className="mt-4 text-xl font-extrabold text-primary">O problema</h3>
            <p className="mt-2 text-sm text-secondary leading-relaxed">
              Nas redes tradicionais, um texto trabalhado some do feed em 24 horas, e o algoritmo empurra quem escreve a produzir só o que dá clique. O que importa vira ruído.
            </p>
          </article>
          <article className="ab-reveal rounded-3xl border border-border bg-surface/50 p-6 sm:p-8 text-emerald-400" data-delay="2">
            <GardenArt />
            <h3 className="mt-4 text-xl font-extrabold text-primary">A resposta</h3>
            <p className="mt-2 text-sm text-secondary leading-relaxed">
              Uma casa digital permanente: um insight de duas linhas, um desabafo, a crítica ao final de uma série ou um artigo técnico convivem com a mesma dignidade, organizados por tema e sem disputa por alcance.
            </p>
          </article>
        </div>

        <div className="mt-6 grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {PILLARS.map(({ icon: Icon, title, text }, i) => (
            <div key={title} onMouseMove={trackGlow} className="ab-reveal ab-glow rounded-2xl border border-border bg-background p-5" data-delay={String(i + 1)}>
              <span className="grid place-items-center w-10 h-10 rounded-xl bg-accent text-white shadow-md">
                <Icon className="w-5 h-5" />
              </span>
              <h3 className="mt-4 font-extrabold text-primary">{title}</h3>
              <p className="mt-1.5 text-sm text-secondary leading-relaxed">{text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ============================== VITRINE ============================== */}
      <section className="px-5 sm:px-10 py-16 bg-surface/30 border-y border-border">
        <div className="max-w-6xl mx-auto">
          <p className="ab-reveal font-mono text-[11px] uppercase tracking-[0.3em] text-accent">Por dentro</p>
          <h2 className="ab-reveal mt-3 text-3xl sm:text-4xl font-black tracking-tight text-primary" data-delay="1">
            Feito para escrever bem.
          </h2>
          <div className="mt-10 grid sm:grid-cols-4 auto-rows-[200px] gap-4">
            {SHOWCASE.map((s, i) => (
              <figure
                key={s.src}
                onMouseMove={trackGlow}
                className={`ab-reveal ab-glow group relative rounded-2xl overflow-hidden border border-border bg-background ${s.span}`}
                data-delay={String((i % 4) + 1)}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={s.src}
                  alt={s.title}
                  loading="lazy"
                  style={{ objectPosition: s.pos }}
                  className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-[1.04]"
                />
                <figcaption className="absolute inset-x-0 bottom-0 p-4 bg-gradient-to-t from-black/85 via-black/50 to-transparent">
                  <p className="text-sm font-extrabold text-white">{s.title}</p>
                  <p className="text-xs text-white/75">{s.text}</p>
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      {/* ============================== HISTÓRIA ============================== */}
      <section className="px-5 sm:px-10 py-20 max-w-6xl mx-auto">
        <p className="ab-reveal font-mono text-[11px] uppercase tracking-[0.3em] text-accent">Linha do tempo</p>
        <h2 className="ab-reveal mt-3 text-3xl sm:text-4xl font-black tracking-tight text-primary" data-delay="1">
          De um post-it a uma comunidade.
        </h2>
        <div className="relative mt-12">
          {/* linha que se desenha */}
          <svg className="absolute left-4 sm:left-1/2 top-0 h-full w-1 -translate-x-1/2 overflow-visible" preserveAspectRatio="none" viewBox="0 0 2 100" aria-hidden>
            <line className="ab-line" pathLength={1} x1="1" y1="0" x2="1" y2="100" stroke="var(--accent)" strokeWidth="2" vectorEffect="non-scaling-stroke" />
          </svg>
          <ol className="space-y-10">
            {TIMELINE.map((t, i) => (
              <li key={t.title} className={`ab-reveal relative grid sm:grid-cols-2 gap-4 pl-12 sm:pl-0 ${i % 2 ? 'sm:[&>div]:col-start-2' : ''}`} data-delay="1">
                <span
                  className={`absolute left-4 sm:left-1/2 top-3 -translate-x-1/2 w-4 h-4 rounded-full border-2 ${t.done ? 'bg-accent border-accent' : 'bg-background border-accent animate-pulse'}`}
                />
                <div className={`rounded-2xl border border-border bg-surface/60 p-5 ${i % 2 ? '' : 'sm:mr-10 sm:text-right'} ${i % 2 ? 'sm:ml-10' : ''}`}>
                  <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-accent">{t.when}</p>
                  <h3 className="mt-1 text-lg font-extrabold text-primary">{t.title}</h3>
                  <p className="mt-1.5 text-sm text-secondary leading-relaxed">{t.text}</p>
                  {!t.done && <p className="mt-2 inline-block text-[11px] font-bold text-fuchsia-400">em construção</p>}
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ============================== STACK EM ÓRBITA ============================== */}
      <section className="px-5 sm:px-10 py-20 bg-surface/30 border-y border-border overflow-hidden">
        <div className="max-w-6xl mx-auto grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <p className="ab-reveal font-mono text-[11px] uppercase tracking-[0.3em] text-accent">Por baixo do capô</p>
            <h2 className="ab-reveal mt-3 text-3xl sm:text-4xl font-black tracking-tight text-primary" data-delay="1">
              Tecnologia moderna, código feito à mão.
            </h2>
            <p className="ab-reveal mt-4 text-secondary leading-relaxed" data-delay="2">
              O editor de blocos é proprietário: cada parágrafo, imagem ou enquete vira um objeto que você move, redimensiona e combina. Em volta dele, serviços escolhidos a dedo.
            </p>
            <ul className="mt-6 grid sm:grid-cols-2 gap-2.5">
              {STACK.map(({ icon: Icon, name, role }, i) => (
                <li key={name} className="ab-reveal flex items-center gap-3 rounded-xl border border-border bg-background px-3 py-2.5" data-delay={String((i % 4) + 1)}>
                  <Icon className="w-4 h-4 text-accent shrink-0" />
                  <span className="min-w-0">
                    <span className="block text-sm font-bold text-primary">{name}</span>
                    <span className="block text-[11px] text-muted truncate">{role}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
          <div className="ab-reveal relative aspect-square max-w-[420px] w-full mx-auto" data-delay="2" aria-hidden>
            <div className="absolute inset-[34%]">
              <InsightAsterisk className="w-full h-full ab-spin" />
            </div>
            <div className="absolute inset-0 rounded-full border border-dashed border-border" />
            <div className="absolute inset-[16%] rounded-full border border-border/70" />
            <div className="absolute inset-0 ab-orbit">
              {STACK.map(({ icon: Icon, name }, i) => {
                const a = (i / STACK.length) * Math.PI * 2;
                const r = i % 2 ? 44 : 31;
                return (
                  <span
                    key={name}
                    className="absolute -translate-x-1/2 -translate-y-1/2"
                    style={{ left: `${50 + r * Math.cos(a)}%`, top: `${50 + r * Math.sin(a)}%` }}
                  >
                    <span className="ab-counter grid place-items-center w-11 h-11 rounded-2xl border border-border bg-surface shadow-lg">
                      <Icon className="w-5 h-5 text-accent" />
                    </span>
                  </span>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* ============================== CRIADOR ============================== */}
      <section className="px-5 sm:px-10 py-20 max-w-6xl mx-auto">
        <div className="ab-reveal relative rounded-[2rem] border border-border overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-accent/20 via-transparent to-fuchsia-500/15" aria-hidden />
          <div className="relative grid md:grid-cols-[auto_1fr] gap-8 items-center p-7 sm:p-10">
            <div className="relative w-36 h-36 mx-auto">
              <div className="absolute inset-[-10px] rounded-full ab-spin" style={{ background: 'conic-gradient(from 0deg, var(--accent), #e879f9, #fcd34d, var(--accent))' }} />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={founder?.avatar_url || '/assets/net/default-perfil'}
                alt="Victor Poiani"
                className="relative w-36 h-36 rounded-full object-cover border-4 border-background bg-elevated"
              />
            </div>
            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-accent">Quem faz</p>
              <h2 className="mt-2 text-3xl font-black text-primary">Victor Poiani</h2>
              <p className="text-sm text-muted">Idealizador e desenvolvedor · Sistemas de Informação (UFV-CRP) · Rio Paranaíba, MG</p>
              <blockquote className="mt-4 text-lg text-secondary leading-relaxed italic border-l-2 border-accent pl-4">
                “Eu queria um lugar onde escrever fosse leve e o que a gente escreve não sumisse no dia seguinte. O Insight é esse lugar, e ele é construído em público, com quem usa.”
              </blockquote>
              <div className="mt-5 flex flex-wrap gap-2.5">
                <a href="https://github.com/VictorPoiani" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full border border-border bg-background text-sm font-bold text-primary hover:border-accent">
                  <Github className="w-4 h-4" /> GitHub
                </a>
                <a href="https://www.instagram.com/victorpoiani/" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full border border-border bg-background text-sm font-bold text-primary hover:border-accent">
                  Instagram <ArrowUpRight className="w-4 h-4" />
                </a>
                <Link href="/u/victorpoiani" className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-accent text-white text-sm font-bold">
                  Ver perfil no Insight
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============================== COLABORE ============================== */}
      <section className="px-5 sm:px-10 pb-20 max-w-6xl mx-auto">
        <p className="ab-reveal font-mono text-[11px] uppercase tracking-[0.3em] text-accent">Construído em público</p>
        <h2 className="ab-reveal mt-3 text-3xl sm:text-4xl font-black tracking-tight text-primary" data-delay="1">
          Tem lugar para você aqui.
        </h2>
        <div className="mt-10 grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {COLLAB.map(({ icon: Icon, title, text }, i) => (
            <div key={title} onMouseMove={trackGlow} className="ab-reveal ab-glow rounded-2xl border border-border bg-surface/50 p-5" data-delay={String(i + 1)}>
              <Icon className="w-6 h-6 text-accent" />
              <h3 className="mt-3 font-extrabold text-primary">{title}</h3>
              <p className="mt-1.5 text-sm text-secondary leading-relaxed">{text}</p>
            </div>
          ))}
        </div>
        <ol className="ab-reveal mt-8 grid md:grid-cols-3 gap-4 text-sm text-secondary" data-delay="2">
          {[
            <>Acompanhe o código e abra <em>issues</em> ou <em>pull requests</em> no GitHub.</>,
            <>Achou um bug ou teve uma ideia? Publique com a tag <strong className="text-primary">#projetos</strong> ou mande uma mensagem para o criador.</>,
            <>Quem tiver código, design ou ideia implementada entra na lista oficial de colaboradores.</>,
          ].map((step, i) => (
            <li key={i} className="flex gap-3 rounded-2xl border border-border p-4">
              <span className="grid place-items-center w-7 h-7 rounded-full bg-accent/15 text-accent text-xs font-black shrink-0">
                <Check className="w-4 h-4" />
              </span>
              <span className="leading-relaxed">{step}</span>
            </li>
          ))}
        </ol>
      </section>

      {/* ============================== CTA FINAL ============================== */}
      <section className="px-5 sm:px-10 pb-24">
        <div className="ab-reveal relative max-w-6xl mx-auto rounded-[2rem] overflow-hidden p-8 sm:p-12 text-center">
          <div className="absolute inset-0 bg-gradient-to-r from-sky-500 via-fuchsia-500 to-amber-400 opacity-90" aria-hidden />
          <div className="absolute -right-16 -top-16 w-64 h-64 opacity-25" aria-hidden>
            <InsightAsterisk fill="solid" color="#fff" className="w-full h-full ab-spin" />
          </div>
          <div className="relative">
            <h2 className="text-3xl sm:text-5xl font-black text-white tracking-tight">Apenas poste.</h2>
            <p className="mt-3 text-white/85 max-w-lg mx-auto">O resto a gente constrói junto. Sem anúncios, sem algoritmo pago, com a comunidade mantendo o projeto de pé.</p>
            <div className="mt-7 flex flex-wrap justify-center gap-3">
              <Link href="/" className="px-5 py-3 rounded-full bg-white text-black text-sm font-extrabold hover:scale-[1.03] transition-transform">
                Ir para o feed
              </Link>
              <Link href="/apoie" className="inline-flex items-center gap-1.5 px-5 py-3 rounded-full bg-black/25 text-white text-sm font-extrabold border border-white/40 hover:bg-black/35">
                <Heart className="w-4 h-4" /> Apoiar o Insight
              </Link>
              <Link href="/atualizacoes" className="inline-flex items-center gap-1.5 px-5 py-3 rounded-full bg-black/25 text-white text-sm font-extrabold border border-white/40 hover:bg-black/35">
                <Feather className="w-4 h-4" /> Mural de atualizações
              </Link>
            </div>
          </div>
        </div>
        <p className="mt-6 text-center text-xs text-muted">
          <Users className="inline w-3.5 h-3.5 mr-1" /> Insight* · feito no Brasil por Victor Poiani e pela comunidade
        </p>
      </section>
    </div>
  );
}
