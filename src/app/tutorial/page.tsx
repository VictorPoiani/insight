'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import {
  AlignLeft,
  Heading1,
  Heading2,
  Quote,
  Sparkles,
  List,
  Code2,
  Image as ImageIcon,
  Film,
  Clapperboard,
  Network,
  Compass,
  BarChart3,
  SquareCheck,
  Table2,
  Paperclip,
  Music,
  Minus,
  Check,
  ArrowUpRight,
  Maximize2,
  Lightbulb,
} from 'lucide-react';
import { Kbd, SHORTCUTS } from '@/components/layout/GlobalShortcuts';
import { NOTEBOOK_NAME } from '@/lib/notebook/copy';

const ImageLightbox = dynamic(() => import('@/components/media/ImageLightbox').then((m) => m.ImageLightbox), { ssr: false });

const serif = { fontFamily: "var(--tut-serif), Georgia, 'Times New Roman', serif" } as const;

/* -------------------------------------------------------------------------- */
/* Peças                                                                      */
/* -------------------------------------------------------------------------- */

interface Fig {
  src: string;
  alt: string;
  caption: string;
}

function Figure({ fig, n, onOpen, tilt = 0 }: { fig: Fig; n: string; onOpen: (src: string) => void; tilt?: number }) {
  return (
    <figure className="group my-8">
      <button
        type="button"
        onClick={() => onOpen(fig.src)}
        aria-label={`Ampliar: ${fig.alt}`}
        style={{ transform: `rotate(${tilt}deg)` }}
        className="relative block w-full text-left rounded-[14px] border border-border bg-surface shadow-[0_24px_60px_-30px_rgba(0,0,0,0.65)] overflow-hidden transition-transform duration-500 hover:!rotate-0 hover:-translate-y-1"
      >
        <span className="flex items-center gap-1.5 px-3.5 h-7 border-b border-border bg-elevated/70">
          <span className="w-2.5 h-2.5 rounded-full bg-[#ff5f57]/80" />
          <span className="w-2.5 h-2.5 rounded-full bg-[#febc2e]/80" />
          <span className="w-2.5 h-2.5 rounded-full bg-[#28c840]/80" />
          <span className="ml-3 text-[10px] font-mono text-muted truncate">insight.app.br</span>
          <Maximize2 className="ml-auto w-3 h-3 text-muted opacity-0 group-hover:opacity-100 transition-opacity" />
        </span>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={fig.src} alt={fig.alt} loading="lazy" className="block w-full h-auto" />
      </button>
      <figcaption className="mt-3 flex gap-3 text-xs text-muted leading-relaxed">
        <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-primary shrink-0 pt-0.5">Fig. {n}</span>
        <span style={serif} className="italic text-[13px]">
          {fig.caption}
        </span>
      </figcaption>
    </figure>
  );
}

function Tip({ children, label = 'Dica' }: { children: React.ReactNode; label?: string }) {
  return (
    <aside className="my-6 relative pl-5 py-1 border-l-2 border-accent">
      <p className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.22em] text-accent">
        <Lightbulb className="w-3 h-3" /> {label}
      </p>
      <div className="mt-1 text-sm text-secondary leading-relaxed">{children}</div>
    </aside>
  );
}

function Steps({ items }: { items: React.ReactNode[] }) {
  return (
    <ol className="my-6 space-y-3">
      {items.map((it, i) => (
        <li key={i} className="grid grid-cols-[2rem_1fr] gap-3 text-[15px] text-secondary leading-relaxed">
          <span style={serif} className="text-xl leading-6 text-primary/40 tabular-nums text-right">
            {i + 1}
          </span>
          <span>{it}</span>
        </li>
      ))}
    </ol>
  );
}

function P({ children }: { children: React.ReactNode }) {
  return <p className="my-4 text-[15px] text-secondary leading-[1.8]">{children}</p>;
}

const BLOCKS: { icon: typeof AlignLeft; name: string; use: string }[] = [
  { icon: AlignLeft, name: 'Texto', use: 'O parágrafo do dia a dia. Enter pula linha.' },
  { icon: Heading1, name: 'Título H1', use: 'Abre o post ou uma grande seção.' },
  { icon: Heading2, name: 'Subtítulo H2', use: 'Divide o texto em partes.' },
  { icon: Quote, name: 'Citação', use: 'Trecho com barra lateral.' },
  { icon: Sparkles, name: 'Nota técnica', use: 'Caixa de destaque para avisos.' },
  { icon: List, name: 'Lista', use: 'Marcadores, um item por linha.' },
  { icon: Code2, name: 'Código', use: 'Fonte monoespaçada, sem corretor.' },
  { icon: ImageIcon, name: 'Imagem', use: 'Com legenda, tamanho e alinhamento.' },
  { icon: Film, name: 'Vídeo', use: 'Compactado no próprio navegador.' },
  { icon: Clapperboard, name: 'GIF', use: 'Busca no catálogo do GIPHY.' },
  { icon: Network, name: 'Mapa mental', use: 'Quadro 2D com zoom e arraste.' },
  { icon: Compass, name: 'Roadmap', use: 'Fases e entregas de um projeto.' },
  { icon: BarChart3, name: 'Gráfico', use: 'Barras ou rosca a partir de valores.' },
  { icon: SquareCheck, name: 'Enquete', use: 'Votação ao vivo, uma ou várias opções.' },
  { icon: Table2, name: 'Tabela', use: 'Linhas e colunas editáveis.' },
  { icon: Paperclip, name: 'Arquivo', use: 'Anexo dentro da sua cota.' },
  { icon: Music, name: 'Música', use: 'Digite o nome e escolha a faixa.' },
  { icon: Minus, name: 'Divisória', use: 'Uma pausa visual entre ideias.' },
];

/* -------------------------------------------------------------------------- */
/* Capítulos                                                                  */
/* -------------------------------------------------------------------------- */

interface Chapter {
  id: string;
  kicker: string;
  title: string;
  lead: string;
  body: (open: (src: string) => void) => React.ReactNode;
}

const F = (name: string, alt: string, caption: string): Fig => ({ src: `/tutorial/${name}.webp`, alt, caption });

/** Todas as figuras, na ordem de leitura (o lightbox navega por elas). */
const FIGS: Record<string, Fig> = {
  'composer-slash': F('composer-slash', 'Editor com o catálogo de blocos aberto', 'O catálogo que aparece ao digitar “/”: dezoito tipos de bloco, do parágrafo ao mapa mental.'),
  'composer-side': F('composer-side', 'Dois blocos de texto lado a lado', 'Dois blocos dividindo a mesma linha, cada um com 50%. A alça ⋮⋮ fica no topo de cada bloco.'),
  'composer-height': F('composer-height', 'Alça inferior ajustando a altura do bloco', 'Barrinha azul na base: arrastar ajusta a altura do bloco sem cortar o texto.'),
  'carousel': F('carousel', 'Post com carrossel de imagens', 'Carrossel no feed: a mídia da vez em destaque, a próxima esmaecida e o contador embaixo.'),
  'mention': F('mention', 'Sugestões de membros ao digitar arroba', 'Sugestões ao digitar “@ma”: quem combina com o começo do nome aparece primeiro.'),
  'topic-gallery': F('topic-gallery', 'Galeria de modelos de tópico', 'A galeria de modelos: cada cartão mostra uma prévia de como o tópico vai ficar.'),
  'topic-poemas': F('topic-poemas', 'Tópico Poemas e Livros', `Poemas & Livros: um mural de escritos com tipografia de livro, ligado ao ${NOTEBOOK_NAME}.`),
  'topic-habitos': F('topic-habitos', 'Tópico de hábitos', 'Matriz de hábitos: marque os dias e acompanhe a consistência da semana.'),
  'ranking': F('ranking', 'Card do ranking semanal', 'O card de domingo: a manchete muda conforme o que aconteceu na semana.'),
  'notifs': F('notifs', 'Seleção de notificações', 'Modo seleção: notificações marcadas e o botão Apagar à direita.'),
  'shortcuts': F('shortcuts', 'Janela de atalhos', 'Aperte “?” em qualquer tela para lembrar dos atalhos.'),
  'activity': F('activity', 'Painel Sua atividade', 'Sua atividade: tempo de tela por dia, posts vistos, curtidas, comentários e mais.'),
  'config-visual': F('config-visual', 'Configurações de aparência', 'Em Configurações → Leitura & Visual: fundos, modo de leitura e a luz noturna com horário.'),
  'nitro': F('nitro', 'Galeria do Insight Nitro', 'A galeria do Nitro com o provador à direita: tudo pode ser testado no seu próprio perfil.'),
};
const ALL_FIGS = Object.values(FIGS).map((f) => ({ src: f.src, alt: f.alt }));

const CHAPTERS: Chapter[] = [
  {
    id: 'escrever',
    kicker: 'O editor',
    title: 'Escrever um Insight',
    lead: 'O editor do Insight funciona em blocos, como um caderno: cada parágrafo, imagem ou enquete é uma peça que você move e redimensiona.',
    body: (open) => (
      <>
        <Steps
          items={[
            <>Toque em <strong className="text-primary">Publicar Insight</strong> no topo do feed. O primeiro bloco já espera por você: “Compartilhe seu Insight…”.</>,
            <>Digite <Kbd>/</Kbd> num bloco vazio, ou use o <strong className="text-primary">+</strong>, para abrir o catálogo de blocos.</>,
            <><Kbd>Enter</Kbd> pula linha dentro do mesmo bloco. Para começar outro bloco, use <Kbd>Ctrl</Kbd> + <Kbd>Enter</Kbd> (no Mac, <Kbd>⌘</Kbd> + <Kbd>Enter</Kbd>).</>,
            <>Selecione um trecho para <strong className="text-primary">negrito</strong>, <em>itálico</em>, sublinhado, tachado ou realce. A barra de cima também troca a fonte (Sans, Serif, Mono) e o alinhamento.</>,
          ]}
        />
        <Figure n="1.1" onOpen={open} tilt={-0.6} fig={FIGS['composer-slash']} />
        <h3 style={serif} className="mt-10 text-xl text-primary">Catálogo de blocos</h3>
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-px rounded-xl overflow-hidden border border-border bg-border">
          {BLOCKS.map(({ icon: Icon, name, use }) => (
            <div key={name} className="flex items-start gap-3 bg-background p-3.5">
              <Icon className="w-4 h-4 mt-0.5 text-accent shrink-0" />
              <p className="text-sm leading-snug">
                <span className="font-semibold text-primary">{name}</span>
                <span className="block text-xs text-muted mt-0.5">{use}</span>
              </p>
            </div>
          ))}
        </div>
        <Tip>
          O rascunho é salvo sozinho enquanto você escreve. Se fechar a aba, ele estará lá quando voltar. O botão <strong className="text-primary">Corretor</strong> sublinha erros de português antes de publicar.
        </Tip>
      </>
    ),
  },
  {
    id: 'layout',
    kicker: 'Edição de blocos',
    title: 'Montar o layout',
    lead: 'Um post não precisa ser uma coluna só. Os blocos vivem numa grade de 12 colunas e você decide onde cada um fica.',
    body: (open) => (
      <>
        <Steps
          items={[
            <><strong className="text-primary">Reordenar:</strong> segure a alça <span className="font-mono text-primary">⋮⋮</span> do bloco e arraste para cima ou para baixo. As setas ↑ ↓ fazem o mesmo, um passo de cada vez.</>,
            <><strong className="text-primary">Lado a lado:</strong> solte o bloco na <em>borda esquerda ou direita</em> de outro. Uma linha azul mostra onde ele vai entrar, e os dois dividem a linha.</>,
            <><strong className="text-primary">Largura:</strong> puxe a alça na lateral direita do bloco ou abra o botão de largura (25%, 50%, 75%, 100% e a coluna onde começa).</>,
            <><strong className="text-primary">Altura:</strong> puxe a barrinha na base do bloco para cima ou para baixo. Dois cliques nela voltam à altura automática.</>,
          ]}
        />
        <Figure n="2.1" onOpen={open} tilt={0.5} fig={FIGS['composer-side']} />
        <Figure n="2.2" onOpen={open} tilt={-0.4} fig={FIGS['composer-height']} />
        <Tip>
          O menu <span className="font-mono text-primary">⋯</span> de cada bloco esconde um extra: <strong className="text-primary">Spoiler</strong>. O bloco aparece borrado no feed até a pessoa tocar nele. Serve para finais de filme, respostas de enquete e surpresas.
        </Tip>
        <P>
          Na parte de baixo do editor ficam as escolhas de publicação: <strong className="text-primary">Público</strong> ou <strong className="text-primary">Só para mim</strong>, fixar no topo do perfil, tags e “Publicar também nos tópicos”, que manda o mesmo post para uma ou mais abas do seu perfil.
        </P>
      </>
    ),
  },
  {
    id: 'midia',
    kicker: 'Fotos, vídeos e som',
    title: 'Mídia que respira',
    lead: 'Imagens e vídeos entram com metade da largura no computador, para o feed não virar um mural de fotos gigantes. Dá para ampliar até 100% quando fizer sentido.',
    body: (open) => (
      <>
        <P>
          Duas ou mais mídias seguidas viram um <strong className="text-primary">carrossel</strong>: a próxima aparece ao lado, mais apagada, convidando a deslizar. No computador surgem setas; no celular, é só arrastar. Tocar numa foto abre em tela cheia, com zoom.
        </P>
        <Figure n="3.1" onOpen={open} tilt={0.4} fig={FIGS['carousel']} />
        <Steps
          items={[
            <>Vídeos são compactados no seu próprio aparelho antes de subir, então o envio é mais rápido e gasta menos dados.</>,
            <>No bloco <strong className="text-primary">GIF</strong>, pesquise no GIPHY sem sair do editor.</>,
            <>No bloco <strong className="text-primary">Música</strong> (e nas respostas), escreva o nome da faixa e escolha na lista. Link do Spotify também funciona.</>,
          ]}
        />
      </>
    ),
  },
  {
    id: 'conversar',
    kicker: 'Comunidade',
    title: 'Conversar e marcar pessoas',
    lead: 'Respostas, menções e reposts são como as ideias circulam pelo Insight.',
    body: (open) => (
      <>
        <P>
          Digite <Kbd>@</Kbd> em qualquer post ou resposta e os membros aparecem conforme você escreve. Escolha com as setas e <Kbd>Enter</Kbd> (ou com um clique). A menção vira um link para o perfil, e a pessoa recebe a notificação “mencionou você”.
        </P>
        <Figure n="4.1" onOpen={open} tilt={-0.5} fig={FIGS['mention']} />
        <Steps
          items={[
            <><strong className="text-primary">Responder:</strong> as respostas aceitam texto, citação, código, lista, imagens, GIF, vídeo e música.</>,
            <><strong className="text-primary">Repostar:</strong> o botão de repost oferece “Repostar” (direto) ou “Repostar com comentário”, que mostra seu texto com o post original embaixo.</>,
            <><strong className="text-primary">Curtir</strong> funciona em posts e em respostas. Quem você segue aparece na aba Seguindo.</>,
            <><strong className="text-primary">Salvar:</strong> o marcador ao lado de Compartilhar guarda o Insight para ler depois. Só você vê os seus salvos.</>,
          ]}
        />
      </>
    ),
  },
  {
    id: 'topicos',
    kicker: 'Seu perfil',
    title: 'Tópicos: abas que trabalham por você',
    lead: 'Cada perfil pode ter abas próprias. Uma aba pode ser um feed temático ou um espaço de trabalho pronto, montado a partir de um modelo.',
    body: (open) => (
      <>
        <P>
          No seu perfil, toque no <strong className="text-primary">+</strong> ao lado das abas. Escolha entre página vazia, base de dados ou um dos modelos: metas, hábitos, tarefas, roadmap, mapa mental, plano nutricional, agenda e <strong className="text-primary">Poemas &amp; Livros</strong>. Cada tópico pode ser público ou privado.
        </P>
        <Figure n="5.1" onOpen={open} tilt={0.4} fig={FIGS['topic-gallery']} />
        <Figure n="5.2" onOpen={open} tilt={-0.5} fig={FIGS['topic-poemas']} />
        <Figure n="5.3" onOpen={open} tilt={0.3} fig={FIGS['topic-habitos']} />
        <Tip>
          Em Poemas &amp; Livros, o botão “Trazer do Notebook” copia um capítulo do {NOTEBOOK_NAME} para o mural, e o ícone de caderno abre o original para continuar escrevendo.
        </Tip>
      </>
    ),
  },
  {
    id: 'feed',
    kicker: 'O que acontece por aqui',
    title: 'Feed, notícias e o domingo',
    lead: 'O feed mistura o que a comunidade publica com algumas tradições da casa.',
    body: (open) => (
      <>
        <Steps
          items={[
            <><strong className="text-primary">Para você, Notícias, Seguindo e Membros:</strong> as abas do topo. A busca encontra posts, pessoas e notícias.</>,
            <><strong className="text-primary">Todo domingo</strong> o feed mostra o ranking semanal de contribuição, com frases que contam a história: quem está há semanas no topo, quem quebrou uma hegemonia, quem recuperou o pódio.</>,
            <>Quando alguém apoia o Insight, uma faixa de agradecimento aparece uma vez para cada pessoa da comunidade.</>,
          ]}
        />
        <Figure n="6.1" onOpen={open} tilt={-0.4} fig={FIGS['ranking']} />
      </>
    ),
  },
  {
    id: 'notificacoes',
    kicker: 'Avisos',
    title: 'Notificações sob controle',
    lead: 'Curtidas, respostas, menções, enquetes, seguidores e reposts chegam em tempo real, e você decide o que fica.',
    body: (open) => (
      <>
        <Steps
          items={[
            <>Use os filtros do topo para ver só um tipo de aviso.</>,
            <>Toque no ícone de lista para entrar no modo seleção. Marque uma a uma ou use <strong className="text-primary">Selecionar todas</strong> e depois Apagar.</>,
            <>A engrenagem liga e desliga cada tipo. O que estiver desligado nem chega a ser gravado.</>,
          ]}
        />
        <Figure n="7.1" onOpen={open} tilt={0.4} fig={FIGS['notifs']} />
      </>
    ),
  },
  {
    id: 'ritmo',
    kicker: 'Produtividade',
    title: 'Atalhos e seu ritmo',
    lead: 'Para quem gosta de agilidade, quase tudo tem atalho. E para quem gosta de números, existe o painel de atividade.',
    body: (open) => (
      <>
        <div className="my-6 rounded-xl border border-border overflow-hidden">
          {SHORTCUTS.map((s, i) => (
            <div key={s.label} className={`flex items-center justify-between gap-4 px-4 py-2.5 text-sm ${i % 2 ? 'bg-surface/40' : ''}`}>
              <span className="text-secondary">{s.label}</span>
              <span className="flex items-center gap-1 shrink-0">
                {s.keys.map((k) => (
                  <Kbd key={k}>{k}</Kbd>
                ))}
              </span>
            </div>
          ))}
        </div>
        <div className="grid gap-6 sm:grid-cols-2 items-start">
          <Figure n="8.1" onOpen={open} tilt={-0.6} fig={FIGS['shortcuts']} />
          <Figure n="8.2" onOpen={open} tilt={0.6} fig={FIGS['activity']} />
        </div>
        <P>
          O painel abre pelo ícone de gráfico na barra direita (no celular, em “Sua atividade”, no menu ☰). Além do resumo, ele tem as abas <strong className="text-primary">Salvos</strong>, <strong className="text-primary">Curtidos</strong> e <strong className="text-primary">Publicados</strong>; tocar em “Curtidas dadas”, “Insights publicados” ou “Salvos” abre a lista correspondente. O tempo de tela só conta enquanto o Insight está aberto e em uso, e os números são só seus.
        </P>
      </>
    ),
  },
  {
    id: 'visual',
    kicker: 'Aparência',
    title: 'Deixe do seu jeito',
    lead: 'Leitura confortável de dia e de noite, com quatro fundos, cor de destaque e luz noturna automática.',
    body: (open) => (
      <>
        <Figure n="9.1" onOpen={open} tilt={0.4} fig={FIGS['config-visual']} />
        <Steps
          items={[
            <><strong className="text-primary">Plano de fundo:</strong> Claro, Obsidian, Âmbar ou Lights out (preto total para telas OLED).</>,
            <><strong className="text-primary">Luz noturna automática:</strong> escolha o horário (por exemplo, das 21h às 6h) e a intensidade. O filtro laranja liga e desliga sozinho.</>,
            <><strong className="text-primary">Modo leitura</strong> aumenta o espaço entre linhas, e a <strong className="text-primary">tipografia</strong> troca a fonte dos posts.</>,
            <><strong className="text-primary">Modo foco automático:</strong> as barras laterais se recolhem enquanto você escreve e voltam quando termina.</>,
          ]}
        />
      </>
    ),
  },
  {
    id: 'apoie',
    kicker: 'Sustentar o projeto',
    title: 'Apoie e Insight Nitro',
    lead: 'O Insight não tem anúncios nem algoritmo pago. Ele vive do apoio da comunidade, e quem apoia ganha mais espaço e mais estilo.',
    body: (open) => (
      <>
        <Steps
          items={[
            <><strong className="text-primary">Apoie via Pix:</strong> cada real vira um ponto de contribuição. Os níveis liberam mais espaço para anexos, tópicos extras e efeitos de patente.</>,
            <><strong className="text-primary">Insight Nitro:</strong> molduras, aberturas animadas, temas, estilos de nome, tags, títulos e o selo Nitro. Use o provador para testar antes.</>,
            <>Quem chega ao <strong className="text-primary">Nível 5</strong> de contribuinte ganha o Nitro vitalício.</>,
          ]}
        />
        <Figure n="10.1" onOpen={open} tilt={-0.4} fig={FIGS['nitro']} />
        <div className="flex flex-wrap gap-3">
          <Link href="/apoie" className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full border border-border text-sm font-semibold text-primary hover:border-accent">
            Ver como apoiar <ArrowUpRight className="w-4 h-4" />
          </Link>
          <Link href="/nitro" className="nitro-rainbow-border inline-flex rounded-full p-[1.5px]">
            <span className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-background text-sm font-semibold text-primary">
              Conhecer o Nitro <ArrowUpRight className="w-4 h-4" />
            </span>
          </Link>
        </div>
      </>
    ),
  },
  {
    id: 'notebook',
    kicker: 'Em breve',
    title: NOTEBOOK_NAME,
    lead: 'Um caderno privado para pensar antes de publicar. Ainda está em testes fechados.',
    body: () => (
      <P>
        Notas em Markdown, diário, modo escritor para livros (com capítulos, metas de palavras e leitura contínua) e um grafo que liga as ideias. Quando abrir para todos, o botão logo abaixo de Início deixa de mostrar o cadeado.
      </P>
    ),
  },
];

/* -------------------------------------------------------------------------- */
/* Página                                                                     */
/* -------------------------------------------------------------------------- */

const STORE = 'insight-tutorial-done';

export default function TutorialPage() {
  const [done, setDone] = useState<string[]>([]);
  const [active, setActive] = useState(CHAPTERS[0].id);
  const [lightbox, setLightbox] = useState<number | null>(null);
  const refs = useRef<Record<string, HTMLElement | null>>({});

  const figures = ALL_FIGS;

  useEffect(() => {
    try {
      const v = JSON.parse(localStorage.getItem(STORE) || '[]');
      if (Array.isArray(v)) setDone(v.map(String));
    } catch {
      /* começa do zero */
    }
  }, []);

  // capítulo visível destaca o índice
  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => {
        const vis = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (vis[0]) setActive(vis[0].target.id);
      },
      { rootMargin: '-20% 0px -60% 0px' }
    );
    Object.values(refs.current).forEach((el) => el && io.observe(el));
    return () => io.disconnect();
  }, []);

  const toggle = (id: string) =>
    setDone((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      try {
        localStorage.setItem(STORE, JSON.stringify(next));
      } catch {
        /* modo privado */
      }
      return next;
    });

  const count = done.filter((d) => CHAPTERS.some((c) => c.id === d)).length;
  const pct = Math.round((count / CHAPTERS.length) * 100);
  const open = (src: string) => setLightbox(Math.max(0, figures.findIndex((f) => f.src === src)));

  return (
    <div className="relative min-h-screen bg-background">
      {/* textura de papel quadriculado, bem sutil */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[560px] opacity-[0.35]"
        style={{
          backgroundImage:
            'linear-gradient(to right, rgba(127,127,127,0.12) 1px, transparent 1px), linear-gradient(to bottom, rgba(127,127,127,0.12) 1px, transparent 1px)',
          backgroundSize: '28px 28px',
          maskImage: 'linear-gradient(to bottom, black, transparent)',
          WebkitMaskImage: 'linear-gradient(to bottom, black, transparent)',
        }}
      />

      {/* CAPA */}
      <header className="relative px-5 sm:px-10 pt-12 sm:pt-16 pb-10 max-w-5xl mx-auto">
        <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-muted">Insight* · Manual do usuário · edição 2026</p>
        <h1 style={serif} className="mt-5 text-[2.6rem] sm:text-6xl leading-[1.02] tracking-tight text-primary">
          Tudo o que cabe
          <br />
          <em className="text-accent">num Insight.</em>
        </h1>
        <p className="mt-6 max-w-xl text-[15px] sm:text-base text-secondary leading-relaxed">
          Um guia em onze capítulos: do primeiro parágrafo ao layout em grade, dos tópicos que viram ferramentas aos atalhos que poupam cliques. Leia na ordem ou pule para o que interessa.
        </p>
        <div className="mt-8 flex items-center gap-4">
          <div className="relative w-12 h-12">
            <svg viewBox="0 0 36 36" className="w-12 h-12 -rotate-90">
              <circle cx="18" cy="18" r="15.5" fill="none" stroke="var(--border)" strokeWidth="2.5" />
              <circle
                cx="18"
                cy="18"
                r="15.5"
                fill="none"
                stroke="var(--accent)"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeDasharray={`${(pct / 100) * 97.4} 97.4`}
                className="transition-[stroke-dasharray] duration-700"
              />
            </svg>
            <span className="absolute inset-0 grid place-items-center text-[11px] font-mono font-bold text-primary">{pct}%</span>
          </div>
          <p className="text-xs text-muted leading-snug">
            {count === 0 ? 'Marque cada capítulo como lido' : `${count} de ${CHAPTERS.length} capítulos lidos`}
            <br />o progresso fica salvo neste aparelho.
          </p>
        </div>
      </header>

      <div className="relative max-w-5xl mx-auto px-5 sm:px-10 pb-24 lg:grid lg:grid-cols-[200px_1fr] lg:gap-14">
        {/* ÍNDICE */}
        <nav aria-label="Capítulos" className="hidden lg:block">
          <ol className="sticky top-8 space-y-0.5 border-l border-border">
            {CHAPTERS.map((c, i) => {
              const isActive = active === c.id;
              const isDone = done.includes(c.id);
              return (
                <li key={c.id}>
                  <a
                    href={`#${c.id}`}
                    className={`-ml-px flex items-baseline gap-2.5 border-l-2 py-1.5 pl-3.5 text-[13px] transition-colors ${
                      isActive ? 'border-accent text-primary' : 'border-transparent text-muted hover:text-secondary'
                    }`}
                  >
                    <span className="font-mono text-[10px] tabular-nums w-4">{String(i + 1).padStart(2, '0')}</span>
                    <span className="flex-1">{c.title}</span>
                    {isDone && <Check className="w-3 h-3 text-accent shrink-0" />}
                  </a>
                </li>
              );
            })}
          </ol>
        </nav>

        {/* índice compacto no celular */}
        <nav aria-label="Capítulos" className="lg:hidden -mx-5 px-5 mb-6 flex gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {CHAPTERS.map((c, i) => (
            <a
              key={c.id}
              href={`#${c.id}`}
              className={`shrink-0 px-3 py-1.5 rounded-full border text-xs ${
                done.includes(c.id) ? 'border-accent text-accent' : 'border-border text-secondary'
              }`}
            >
              {String(i + 1).padStart(2, '0')} · {c.title}
            </a>
          ))}
        </nav>

        <main className="min-w-0">
          {CHAPTERS.map((c, i) => {
            const isDone = done.includes(c.id);
            return (
              <section
                key={c.id}
                id={c.id}
                ref={(el) => {
                  refs.current[c.id] = el;
                }}
                className="scroll-mt-8 pt-4 pb-16 border-b border-border/60 last:border-0"
              >
                <div className="flex items-end gap-5">
                  <span
                    aria-hidden
                    style={{ ...serif, WebkitTextStroke: '1.25px', WebkitTextStrokeColor: 'color-mix(in srgb, var(--accent) 45%, rgba(127,127,127,0.5))' }}
                    className="text-7xl sm:text-8xl leading-[0.8] text-transparent select-none"
                  >
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <p className="pb-1 font-mono text-[10px] uppercase tracking-[0.25em] text-accent">{c.kicker}</p>
                </div>
                <h2 style={serif} className="mt-4 text-3xl sm:text-[2.4rem] leading-tight tracking-tight text-primary">
                  {c.title}
                </h2>
                <p style={serif} className="mt-4 text-lg sm:text-xl leading-relaxed text-secondary italic">
                  {c.lead}
                </p>

                {c.body(open)}

                <button
                  type="button"
                  onClick={() => toggle(c.id)}
                  aria-pressed={isDone}
                  className={`mt-6 inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold transition-colors ${
                    isDone ? 'bg-accent text-white' : 'border border-border text-secondary hover:text-primary hover:border-accent'
                  }`}
                >
                  <Check className="w-3.5 h-3.5" />
                  {isDone ? 'Capítulo lido' : 'Marcar como lido'}
                </button>
              </section>
            );
          })}

          <footer className="pt-10 text-center">
            <p style={serif} className="text-2xl text-primary italic">
              Agora é com você.
            </p>
            <Link href="/" className="mt-4 inline-flex items-center gap-1.5 px-5 py-2.5 rounded-full bg-accent text-white text-sm font-semibold">
              Compartilhar meu primeiro Insight <ArrowUpRight className="w-4 h-4" />
            </Link>
          </footer>
        </main>
      </div>

      {lightbox !== null && figures[lightbox] && (
        <ImageLightbox images={figures} index={lightbox} onClose={() => setLightbox(null)} onIndexChange={setLightbox} />
      )}
    </div>
  );
}
