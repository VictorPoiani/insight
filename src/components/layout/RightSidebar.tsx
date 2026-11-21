'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Search,
  Hash,
  Github,
  ArrowUpRight,
  Newspaper,
  SlidersHorizontal,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Code2,
  Gamepad2,
  Sparkles,
  Music,
  Trophy,
  Globe,
  Check,
  RefreshCw,
  Headset,
  Mail,
  MessageCircle,
  ChevronDown,
  Copy,
  PanelRightClose,
  PanelRightOpen,
} from 'lucide-react';

const SUPPORT_EMAIL = 'contato.insightproject@gmail.com';
const SUPPORT_WHATSAPP_NUMBER =
  process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP || '5517996131181';

const DEFAULT_TOPICS = [
  'dev',
  'ia',
  'projetos',
  'rock',
  'musica',
  'artigue',
];

type NewsCategoryId = 'tech' | 'games' | 'science' | 'music' | 'sports' | 'world';

interface NewsCategoryConfig {
  id: NewsCategoryId;
  label: string;
  color: string;
  rssQuery: string;
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
}

interface NewsItem {
  id: string;
  categoryId: NewsCategoryId;
  title: string;
  source: string;
  url: string;
}

const NEWS_CATEGORIES: NewsCategoryConfig[] = [
  {
    id: 'tech',
    label: 'Tech & Dev',
    color: '#38bdf8',
    rssQuery: 'tecnologia programacao software inteligencia artificial',
    icon: Code2,
  },
  {
    id: 'games',
    label: 'Games & Geek',
    color: '#a855f7',
    rssQuery: 'jogos videogames rpg marvel anime',
    icon: Gamepad2,
  },
  {
    id: 'science',
    label: 'Ciência & IA',
    color: '#10b981',
    rssQuery: 'ciencia espaco fisica descobertas',
    icon: Sparkles,
  },
  {
    id: 'music',
    label: 'Música & Rock',
    color: '#f43f5e',
    rssQuery: 'musica rock guitarra shows albuns',
    icon: Music,
  },
  {
    id: 'sports',
    label: 'Futebol',
    color: '#f59e0b',
    rssQuery: 'futebol premier league brasileirao champions',
    icon: Trophy,
  },
  {
    id: 'world',
    label: 'Brasil & Mundo',
    color: '#3b82f6',
    rssQuery: 'brasil mundo atualidades economia',
    icon: Globe,
  },
];

const FALLBACK_NEWS: NewsItem[] = [
  {
    id: 'fb-tech-1',
    categoryId: 'tech',
    title: 'Ecossistema React e Next.js avança com foco em Server Actions e performance',
    source: 'TabNews · Dev',
    url: 'https://www.tabnews.com.br',
  },
  {
    id: 'fb-science-1',
    categoryId: 'science',
    title: 'Modelos de visão computacional leves permitem execução direta no navegador',
    source: 'Ciência & IA',
    url: 'https://news.google.com',
  },
  {
    id: 'fb-games-1',
    categoryId: 'games',
    title: 'Estúdios independentes impulsionam nova onda de RPGs em pixel art e estratégia',
    source: 'Geek & Games',
    url: 'https://store.steampowered.com',
  },
  {
    id: 'fb-music-1',
    categoryId: 'music',
    title: 'Pedaleiras compactas com modelagem digital dominam setups de estudo e gravação',
    source: 'Música & Áudio',
    url: 'https://open.spotify.com',
  },
  {
    id: 'fb-sports-1',
    categoryId: 'sports',
    title: 'Temporada europeia esquenta disputa pela liderança na Premier League',
    source: 'Esportes',
    url: 'https://ge.globo.com',
  },
  {
    id: 'fb-world-1',
    categoryId: 'world',
    title: 'Universidades federais ampliam projetos de extensão e tecnologia aberta',
    source: 'Educação & Brasil',
    url: 'https://news.google.com',
  },
];

const DEFAULT_SELECTED_CATEGORIES: NewsCategoryId[] = [
  'tech',
  'science',
  'games',
  'music',
];

const AUTO_ADVANCE_MS = 6000;
const DEFAULT_WIDTH = 256;
const MIN_WIDTH = 200;
const MAX_WIDTH = 400;
const SNAP_COLLAPSE_WIDTH = 130;

export function RightSidebar() {
  const [searchQuery, setSearchQuery] = useState('');
  const [showAllTopics, setShowAllTopics] = useState(false);
  const [showSupportOptions, setShowSupportOptions] = useState(false);
  const [copiedEmail, setCopiedEmail] = useState(false);
  const router = useRouter();

  const [selectedCategories, setSelectedCategories] = useState<NewsCategoryId[]>(
    DEFAULT_SELECTED_CATEGORIES
  );
  const [newsList, setNewsList] = useState<NewsItem[]>(FALLBACK_NEWS);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [showNewsConfig, setShowNewsConfig] = useState(false);
  const [loadingNews, setLoadingNews] = useState(false);

  // Estados de Redimensionamento e Recolhimento
  const [width, setWidth] = useState(DEFAULT_WIDTH);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const sidebarRef = useRef<HTMLElement>(null);

  useEffect(() => {
    try {
      const savedCats = localStorage.getItem('insight-news-categories');
      if (savedCats) {
        const parsed = JSON.parse(savedCats) as NewsCategoryId[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          setSelectedCategories(parsed);
        }
      }

      const savedLayout = localStorage.getItem('insight-right-sidebar');
      if (savedLayout) {
        const parsed = JSON.parse(savedLayout);
        if (typeof parsed.width === 'number') setWidth(parsed.width);
        if (typeof parsed.isCollapsed === 'boolean') setIsCollapsed(parsed.isCollapsed);
      }
    } catch {
      // Mantém padrão
    }

    function handleFocusMode(e: Event) {
      const customEvent = e as CustomEvent<{ collapse?: boolean }>;
      if (typeof customEvent.detail?.collapse === 'boolean') {
        setIsCollapsed(customEvent.detail.collapse);
      } else {
        setIsCollapsed((prev) => !prev);
      }
    }

    window.addEventListener('insight-toggle-focus-mode', handleFocusMode);
    return () => {
      window.removeEventListener('insight-toggle-focus-mode', handleFocusMode);
    };
  }, []);

  function saveSidebarState(nextWidth: number, nextCollapsed: boolean) {
    try {
      localStorage.setItem(
        'insight-right-sidebar',
        JSON.stringify({ width: nextWidth, isCollapsed: nextCollapsed })
      );
    } catch {
      // Ignora erro
    }
  }

  useEffect(() => {
    if (!isResizing) return;

    function handleMouseMove(e: MouseEvent) {
      if (!sidebarRef.current) return;
      const rect = sidebarRef.current.getBoundingClientRect();
      const newWidth = rect.right - e.clientX;

      if (newWidth < SNAP_COLLAPSE_WIDTH) {
        setIsCollapsed(true);
        saveSidebarState(width, true);
      } else {
        const clamped = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, Math.round(newWidth)));
        setIsCollapsed(false);
        setWidth(clamped);
        saveSidebarState(clamped, false);
      }
    }

    function handleMouseUp() {
      setIsResizing(false);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    }

    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing, width]);

  const fetchDailyNews = useCallback(
    async (forceRefresh = false) => {
      const todayKey = new Date().toISOString().slice(0, 10);
      const cacheKey = `insight-daily-news-${todayKey}-${selectedCategories
        .slice()
        .sort()
        .join('_')}`;

      if (!forceRefresh) {
        const cached = localStorage.getItem(cacheKey);
        if (cached) {
          try {
            const parsed = JSON.parse(cached) as NewsItem[];
            if (Array.isArray(parsed) && parsed.length > 0) {
              setNewsList(parsed);
              return;
            }
          } catch {
            // Segue para busca online
          }
        }
      }

      setLoadingNews(true);
      const collected: NewsItem[] = [];

      try {
        if (selectedCategories.includes('tech')) {
          try {
            const res = await fetch(
              'https://www.tabnews.com.br/api/v1/contents?page=1&per_page=6&strategy=relevant'
            );
            if (res.ok) {
              const data = await res.json();
              if (Array.isArray(data)) {
                data.slice(0, 4).forEach((item: any) => {
                  if (item.title && item.owner_username && item.slug) {
                    collected.push({
                      id: `tn-${item.id}`,
                      categoryId: 'tech',
                      title: item.title,
                      source: `TabNews · @${item.owner_username}`,
                      url: `https://www.tabnews.com.br/${item.owner_username}/${item.slug}`,
                    });
                  }
                });
              }
            }
          } catch {
            // Ignora falha individual
          }
        }

        const otherCategories = NEWS_CATEGORIES.filter(
          (c) =>
            selectedCategories.includes(c.id) &&
            (c.id !== 'tech' || collected.length === 0)
        );

        await Promise.all(
          otherCategories.map(async (cat) => {
            try {
              const rssUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(
                cat.rssQuery
              )}&hl=pt-BR&gl=BR&ceid=BR:pt-419`;
              const apiUrl = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(
                rssUrl
              )}`;

              const res = await fetch(apiUrl);
              if (!res.ok) return;
              const data = await res.json();

              if (Array.isArray(data.items)) {
                data.items.slice(0, 3).forEach((item: any, idx: number) => {
                  const rawTitle = String(item.title || '');
                  const parts = rawTitle.split(' - ');
                  const cleanSource =
                    parts.length > 1 ? parts.pop()!.trim() : cat.label;
                  const cleanTitle = parts.join(' - ').trim() || rawTitle;

                  collected.push({
                    id: `rss-${cat.id}-${idx}-${Date.now()}`,
                    categoryId: cat.id,
                    title: cleanTitle,
                    source: cleanSource,
                    url: item.link || 'https://news.google.com',
                  });
                });
              }
            } catch {
              // Ignora falha individual
            }
          })
        );
      } finally {
        setLoadingNews(false);
      }

      if (collected.length > 0) {
        const interleaved = collected.sort(() => Math.random() - 0.5);
        setNewsList(interleaved);
        setCurrentIndex(0);
        try {
          localStorage.setItem(cacheKey, JSON.stringify(interleaved));
        } catch {
          // Ignora limite
        }
      } else {
        const filteredFallback = FALLBACK_NEWS.filter((item) =>
          selectedCategories.includes(item.categoryId)
        );
        setNewsList(
          filteredFallback.length > 0 ? filteredFallback : FALLBACK_NEWS
        );
        setCurrentIndex(0);
      }
    },
    [selectedCategories]
  );

  useEffect(() => {
    fetchDailyNews();
  }, [fetchDailyNews]);

  const activeNews = useMemo(() => {
    const filtered = newsList.filter((item) =>
      selectedCategories.includes(item.categoryId)
    );
    return filtered.length > 0 ? filtered : FALLBACK_NEWS;
  }, [newsList, selectedCategories]);

  useEffect(() => {
    if (isPaused || showNewsConfig || activeNews.length <= 1) return;

    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % activeNews.length);
    }, AUTO_ADVANCE_MS);

    return () => clearInterval(timer);
  }, [isPaused, showNewsConfig, activeNews.length]);

  function toggleCategory(catId: NewsCategoryId) {
    setSelectedCategories((prev) => {
      const exists = prev.includes(catId);
      const next = exists
        ? prev.length > 1
          ? prev.filter((id) => id !== catId)
          : prev
        : [...prev, catId];

      localStorage.setItem('insight-news-categories', JSON.stringify(next));
      return next;
    });
    setCurrentIndex(0);
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = searchQuery.trim();
    if (trimmed) {
      router.push(`/?q=${encodeURIComponent(trimmed)}`);
    } else {
      router.push('/');
    }
  }

  function handleCopySupportEmail(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    navigator.clipboard.writeText(SUPPORT_EMAIL);
    setCopiedEmail(true);
    setTimeout(() => setCopiedEmail(false), 2000);
  }

  function toggleCollapse() {
    const next = !isCollapsed;
    setIsCollapsed(next);
    saveSidebarState(width, next);
  }

  const displayedTopics = showAllTopics
    ? [...DEFAULT_TOPICS, 'python', 'nextjs']
    : DEFAULT_TOPICS;

  const currentNews =
    activeNews[currentIndex % activeNews.length] || activeNews[0];
  const currentCategoryMeta =
    NEWS_CATEGORIES.find((c) => c.id === currentNews?.categoryId) ||
    NEWS_CATEGORIES[0];
  const CategoryIcon = currentCategoryMeta.icon;

  const whatsappUrl = `https://wa.me/${SUPPORT_WHATSAPP_NUMBER}?text=${encodeURIComponent(
    'Olá! Vim pelo Insight* e gostaria de falar com o suporte/DEV.'
  )}`;
  const gmailComposeUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${SUPPORT_EMAIL}&su=${encodeURIComponent(
    'Suporte Oficial — Plataforma Insight*'
  )}`;

  return (
    <aside
      ref={sidebarRef}
      style={{ width: isCollapsed ? 52 : width }}
      className={`shrink-0 hidden lg:flex flex-col justify-between h-screen sticky top-0 bg-background py-5 select-none group/rsidebar ${
        isResizing ? '' : 'transition-[width] duration-150 ease-out'
      } ${isCollapsed ? 'px-2 items-center' : 'px-3.5'}`}
    >
      {/* Alça Vertical Esquerda para Redimensionar Arrastando */}
      <div
        title="Arraste para ajustar a largura ou recolher"
        onMouseDown={(e) => {
          e.preventDefault();
          setIsResizing(true);
        }}
        className="absolute left-0 top-0 bottom-0 w-1.5 cursor-col-resize z-30 flex items-center justify-center group/handle hover:bg-accent/30 transition-colors"
      >
        <div className="w-[1px] h-10 bg-transparent group-hover/handle:bg-accent rounded-full" />
      </div>

      {isCollapsed ? (
        /* MODO RECOLHIDO DISCRETO */
        <div className="flex flex-col items-center gap-3 w-full">
          <button
            type="button"
            onClick={toggleCollapse}
            title="Expandir painel direito"
            className="p-2 rounded-lg text-muted hover:text-primary hover:bg-surface border border-transparent hover:border-border transition-colors"
          >
            <PanelRightOpen className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={toggleCollapse}
            title="Buscar no Insight"
            className="p-2 rounded-lg text-secondary hover:text-accent hover:bg-surface transition-colors"
          >
            <Search className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={toggleCollapse}
            title="Radar Diário de Notícias"
            className="p-2 rounded-lg text-secondary hover:text-accent hover:bg-surface transition-colors"
          >
            <Newspaper className="w-4 h-4" />
          </button>

          <a
            href="https://github.com/VictorPoiani"
            target="_blank"
            rel="noopener noreferrer"
            title="GitHub @VictorPoiani"
            className="p-2 rounded-lg text-secondary hover:text-accent hover:bg-surface transition-colors"
          >
            <Github className="w-4 h-4" />
          </a>
        </div>
      ) : (
        <>
          <div className="space-y-3 overflow-y-auto no-scrollbar pr-0.5">
            {/*  Botão Discreto de Recolher */}
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={toggleCollapse}
                title="Recolher painel direito"
                className="p-1.5 rounded-lg text-muted hover:text-primary hover:bg-surface border border-transparent hover:border-border transition-colors shrink-0"
              >
                <PanelRightClose className="w-4 h-4 opacity-60 group-hover/rsidebar:opacity-100 transition-opacity" />
              </button>

              <form onSubmit={handleSearch} className="relative flex-1 min-w-0">
                <Search className="w-3.5 h-3.5 text-muted absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Buscar no Insight..."
                  className="w-full bg-surface border border-border rounded-full pl-8 pr-3 py-1.5 text-[11px] text-primary placeholder:text-muted focus:outline-none focus:border-accent transition-colors"
                />
              </form>
            </div>

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

            {/* 3. Hall Lateral */}
            <div
              onMouseEnter={() => setIsPaused(true)}
              onMouseLeave={() => setIsPaused(false)}
              className="p-3 rounded-xl bg-surface border border-border space-y-2.5 transition-colors hover:border-border/90"
            >
              <div className="flex items-center justify-between gap-1">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="relative flex h-1.5 w-1.5 shrink-0">
                    {!isPaused && !showNewsConfig && (
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75" />
                    )}
                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-accent" />
                  </span>
                  <Newspaper className="w-3 h-3 text-accent shrink-0" />
                  <span className="text-[11px] font-extrabold text-primary uppercase tracking-wider truncate">
                    Radar Diário
                  </span>
                </div>

                <div className="flex items-center gap-0.5 shrink-0">
                  {!showNewsConfig && activeNews.length > 1 && (
                    <>
                      <button
                        type="button"
                        onClick={() =>
                          setCurrentIndex(
                            (prev) =>
                              (prev - 1 + activeNews.length) % activeNews.length
                          )
                        }
                        title="Notícia anterior"
                        className="p-1 rounded text-muted hover:text-primary hover:bg-elevated transition-colors"
                      >
                        <ChevronLeft className="w-3 h-3" />
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setCurrentIndex((prev) => (prev + 1) % activeNews.length)
                        }
                        title="Próxima notícia"
                        className="p-1 rounded text-muted hover:text-primary hover:bg-elevated transition-colors"
                      >
                        <ChevronRight className="w-3 h-3" />
                      </button>
                    </>
                  )}

                  <button
                    type="button"
                    onClick={() => setShowNewsConfig(!showNewsConfig)}
                    title="Escolher tipos de notícias diárias"
                    className={`p-1 rounded transition-colors ${
                      showNewsConfig
                        ? 'bg-accent text-white'
                        : 'text-muted hover:text-accent hover:bg-elevated'
                    }`}
                  >
                    <SlidersHorizontal className="w-3 h-3" />
                  </button>
                </div>
              </div>

              {showNewsConfig ? (
                <div className="space-y-2 pt-0.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-muted">
                      O que ver diariamente:
                    </span>
                    <button
                      type="button"
                      onClick={() => fetchDailyNews(true)}
                      title="Atualizar notícias agora"
                      className="text-[10px] text-accent hover:underline flex items-center gap-1"
                    >
                      <RefreshCw
                        className={`w-2.5 h-2.5 ${loadingNews ? 'animate-spin' : ''}`}
                      />
                      <span>Atualizar</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-1 gap-1">
                    {NEWS_CATEGORIES.map((cat) => {
                      const Icon = cat.icon;
                      const active = selectedCategories.includes(cat.id);
                      return (
                        <button
                          key={cat.id}
                          type="button"
                          onClick={() => toggleCategory(cat.id)}
                          className={`flex items-center justify-between px-2 py-1 rounded-lg border text-[11px] font-semibold transition-all ${
                            active
                              ? 'bg-elevated border-border text-primary'
                              : 'bg-transparent border-transparent text-muted hover:text-secondary'
                          }`}
                        >
                          <span className="flex items-center gap-1.5 truncate">
                            <Icon
                              className="w-3 h-3 shrink-0"
                              style={{ color: active ? cat.color : undefined }}
                            />
                            <span className="truncate">{cat.label}</span>
                          </span>
                          {active && (
                            <Check
                              className="w-3 h-3 shrink-0"
                              style={{ color: cat.color }}
                            />
                          )}
                        </button>
                      );
                    })}
                  </div>

                  <button
                    type="button"
                    onClick={() => setShowNewsConfig(false)}
                    className="w-full py-1 rounded-lg bg-elevated border border-border text-[10px] font-bold text-primary hover:border-accent transition-colors"
                  >
                    Concluir
                  </button>
                </div>
              ) : (
                currentNews && (
                  <a
                    href={currentNews.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block space-y-1.5 group"
                  >
                    <div className="flex items-center justify-between gap-1.5">
                      <span
                        style={{
                          backgroundColor: `${currentCategoryMeta.color}15`,
                          color: currentCategoryMeta.color,
                          borderColor: `${currentCategoryMeta.color}35`,
                        }}
                        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[9px] font-bold"
                      >
                        <CategoryIcon className="w-2.5 h-2.5 shrink-0" />
                        <span>{currentCategoryMeta.label}</span>
                      </span>

                      <span className="text-[9px] text-muted">
                        {currentIndex + 1}/{activeNews.length}
                      </span>
                    </div>

                    <p className="text-[11px] font-medium text-primary/90 leading-snug line-clamp-3 group-hover:text-accent transition-colors min-h-[45px]">
                      {currentNews.title}
                    </p>

                    <div className="flex items-center justify-between text-[9px] text-muted pt-0.5">
                      <span className="truncate max-w-[130px]">
                        {currentNews.source}
                      </span>
                      <span className="inline-flex items-center gap-0.5 text-secondary group-hover:text-accent shrink-0">
                        <span>Ler</span>
                        <ExternalLink className="w-2.5 h-2.5" />
                      </span>
                    </div>
                  </a>
                )
              )}

              {!showNewsConfig && activeNews.length > 1 && (
                <div className="flex items-center gap-1 pt-0.5">
                  {activeNews.slice(0, 8).map((item, idx) => {
                    const isCurrent = idx === currentIndex % activeNews.length;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setCurrentIndex(idx)}
                        className={`h-0.5 rounded-full transition-all duration-300 ${
                          isCurrent
                            ? 'flex-1 bg-accent'
                            : 'w-2 bg-border hover:bg-muted'
                        }`}
                      />
                    );
                  })}
                </div>
              )}
            </div>

            {/* 4. Botão Discreto do GitHub */}
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

            {/* 5. Botão de Suporte Oficial */}
            <div className="rounded-xl bg-surface border border-border overflow-hidden transition-all hover:border-accent/60">
              <button
                type="button"
                onClick={() => setShowSupportOptions(!showSupportOptions)}
                className="w-full group flex items-center justify-between px-3 py-2 text-left transition-colors"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <div
                    className={`w-6 h-6 rounded-lg border flex items-center justify-center transition-colors shrink-0 ${
                      showSupportOptions
                        ? 'bg-accent/15 border-accent text-accent'
                        : 'bg-elevated border-border text-secondary group-hover:text-accent group-hover:border-accent/40'
                    }`}
                  >
                    <Headset className="w-3.5 h-3.5" />
                  </div>
                  <div className="truncate">
                    <p className="text-[11px] font-bold text-primary leading-tight truncate">
                      Suporte Oficial
                    </p>
                    <p className="text-[10px] text-muted truncate">
                      Gmail ou WhatsApp
                    </p>
                  </div>
                </div>

                <ChevronDown
                  className={`w-3.5 h-3.5 text-muted group-hover:text-accent transition-transform duration-200 shrink-0 ml-1.5 ${
                    showSupportOptions ? 'rotate-180 text-accent' : ''
                  }`}
                />
              </button>

              {showSupportOptions && (
                <div className="px-2.5 pb-2.5 pt-1.5 border-t border-border space-y-1.5 bg-elevated/30">
                  <div className="flex items-center gap-1">
                    <a
                      href={gmailComposeUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      title={`Enviar e-mail para ${SUPPORT_EMAIL}`}
                      className="flex-1 flex items-center gap-2 px-2 py-1.5 rounded-lg bg-surface border border-border hover:border-accent transition-colors min-w-0 group"
                    >
                      <Mail className="w-3.5 h-3.5 text-[#EA4335] shrink-0" />
                      <div className="truncate">
                        <p className="text-[10px] font-bold text-primary group-hover:text-accent truncate">
                          Gmail Oficial
                        </p>
                        <p className="text-[9px] text-muted truncate">
                          {SUPPORT_EMAIL}
                        </p>
                      </div>
                    </a>

                    <button
                      type="button"
                      onClick={handleCopySupportEmail}
                      title="Copiar endereço de e-mail"
                      className="p-2 rounded-lg bg-surface border border-border text-muted hover:text-accent hover:border-accent transition-colors shrink-0"
                    >
                      {copiedEmail ? (
                        <Check className="w-3.5 h-3.5 text-[#1DB954]" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>

                  <a
                    href={whatsappUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg bg-surface border border-border hover:border-[#25D366] transition-colors group"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <MessageCircle className="w-3.5 h-3.5 text-[#25D366] shrink-0" />
                      <div className="truncate">
                        <p className="text-[10px] font-bold text-primary group-hover:text-[#25D366] truncate">
                          Falar com um desenvolvedor
                        </p>
                        <p className="text-[9px] text-muted truncate">
                          Atendimento via WhatsApp
                        </p>
                      </div>
                    </div>
                    <ArrowUpRight className="w-3 h-3 text-muted group-hover:text-[#25D366] shrink-0" />
                  </a>
                </div>
              )}
            </div>
          </div>

          {/* 6. Rodapé  Compacto */}
          <footer className="px-1 pt-2 space-y-1 text-[10px] text-muted leading-tight shrink-0">
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
        </>
      )}
    </aside>
  );
}