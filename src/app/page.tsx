'use client';

import { OnlineDot, usePresence } from '@/components/presence/PresenceProvider';
import { useEffect, useState, useCallback, useMemo, useRef, Suspense } from 'react';
import Link from 'next/link';
import { CosmeticAvatar, CosmeticName, CosmeticTag } from '@/components/nitro/Cosmetics';
import { useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Post, Profile } from '@/types/database';
import { PostCard, resolvePostVisibility } from '@/components/feed/PostCard';
import { NewsCard } from '@/components/news/NewsCard';
import { NewsFeed, NewsTopicPicker } from '@/components/news/NewsFeed';
import { useNewsFeed, useNewsFollows, useNewsSearch, type NewsItem } from '@/components/news/useNews';
import dynamic from 'next/dynamic';
import { useProgressiveList } from '@/lib/useProgressiveList';
// o editor só é baixado quando a pessoa abre o compositor
import { WeeklyRankingCard } from '@/components/feed/WeeklyRankingCard';
import { DonorThanksBar } from '@/components/feed/DonorThanksBar';
const PostComposer = dynamic(() => import('@/components/feed/PostComposer').then((m) => m.PostComposer), { ssr: false });
import { InsightAsterisk } from '@/components/brand/InsightAsterisk';
import {
  Search,
  Users,
  Sparkles,
  UserPlus,
  UserCheck,
  ShieldCheck,
  X,
  Hash,
  PenSquare,
  ChevronLeft,
  ChevronRight,
  Newspaper,
  ArrowUp,
} from 'lucide-react';

const FOUNDER_PROFILE_ID = '96d271a9-9102-49b1-b593-9279c5dfe3f4';

/**
 * Animação de Carregamento Oficial do Asterisco de 8 pontas (*) do Insight
 */
function AsteriskLoader({
  size = 'md',
  label,
  fullHeight = false,
}: {
  size?: 'xs' | 'sm' | 'md' | 'lg';
  label?: string;
  fullHeight?: boolean;
}) {
  const sizeMap = { xs: 14, sm: 22, md: 38, lg: 52 };
  const px = sizeMap[size];

  if (size === 'xs') {
    return (
      <span
        style={{ width: px, height: px }}
        className="inline-flex items-center justify-center shrink-0"
      >
        <InsightAsterisk fill="solid" className="w-full h-full animate-spin text-accent" style={{ animationDuration: '1.15s' }} />
      </span>
    );
  }

  return (
    <div
      className={`w-full flex flex-col items-center justify-center gap-3 select-none ${
        fullHeight ? 'min-h-[55vh] py-16' : 'py-14'
      }`}
    >
      <style jsx>{`
        @keyframes insightAsteriskSpin3D {
          0% {
            transform: perspective(400px) rotateX(16deg) rotateY(-16deg) rotateZ(0deg) scale(0.94);
          }
          50% {
            transform: perspective(400px) rotateX(-16deg) rotateY(16deg) rotateZ(180deg) scale(1.05);
          }
          100% {
            transform: perspective(400px) rotateX(16deg) rotateY(-16deg) rotateZ(360deg) scale(0.94);
          }
        }
      `}</style>

      <div className="relative flex items-center justify-center">
        <div
          style={{ width: px * 1.5, height: px * 1.5 }}
          className="absolute rounded-full bg-accent/20 blur-xl animate-pulse pointer-events-none"
        />

        <div
          style={{
            width: px,
            height: px,
            animation: 'insightAsteriskSpin3D 1.55s cubic-bezier(0.4, 0, 0.2, 1) infinite',
          }}
          className="relative z-10 drop-shadow-[0_6px_16px_rgba(37,99,235,0.35)]"
        >
          <InsightAsterisk fill="gradient" stroke="#93c5fd" className="w-full h-full" />
        </div>
      </div>

      {label && (
        <span className="text-xs font-mono font-medium text-muted tracking-wide animate-pulse">
          {label}
        </span>
      )}
    </div>
  );
}

function CommunityHomeFeed() {
  const supabase = createClient();
  const searchParams = useSearchParams();

  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [profilesMap, setProfilesMap] = useState<Record<string, Profile>>({});

  const [loggedProfile, setLoggedProfile] = useState<Profile | null>(null);
  const [followingIds, setFollowingIds] = useState<Set<string>>(new Set());
  const [followLoadingId, setFollowLoadingId] = useState<string | null>(null);
  const [isStaff, setIsStaff] = useState(false);

  const [activeTab, setActiveTab] = useState<'for_you' | 'news' | 'following' | 'members'>('for_you');
  const [tabSwitching, setTabSwitching] = useState(false);
  const [search, setSearch] = useState('');
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [showQuickComposer, setShowQuickComposer] = useState(false);
  const [loading, setLoading] = useState(true);

  const carouselRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  useEffect(() => {
    const qParam = searchParams.get('q');
    const tParam = searchParams.get('tag');
    if (qParam !== null) {
      setSearch(qParam);
      if (qParam.trim()) setMobileSearchOpen(true);
    }
    if (tParam !== null) setSelectedTag(tParam.toLowerCase());
  }, [searchParams]);

  function handleSelectTab(nextTab: 'for_you' | 'news' | 'following' | 'members') {
    if (nextTab === activeTab) return;
    setActiveTab(nextTab);
    setTabSwitching(true);
    setTimeout(() => {
      setTabSwitching(false);
    }, 280);
  }

  const updateCarouselButtons = useCallback(() => {
    const el = carouselRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 8);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 8);
  }, []);

  function handleScrollCarousel(direction: 'left' | 'right') {
    const el = carouselRef.current;
    if (!el) return;
    const scrollAmount = 480;
    el.scrollBy({
      left: direction === 'left' ? -scrollAmount : scrollAmount,
      behavior: 'smooth',
    });
  }

  const loadExploreData = useCallback(async () => {
    setLoading(true);

    const {
      data: { session },
    } = await supabase.auth.getSession();

    let currentLogged: Profile | null = null;

    if (session?.user) {
      const { data: myProf } = await supabase
        .from('profiles')
        .select('*')
        .or(`user_id.eq.${session.user.id},id.eq.${session.user.id}`)
        .maybeSingle();

      if (myProf) {
        currentLogged = myProf as Profile;
        setLoggedProfile(currentLogged);
        setIsStaff(
          currentLogged.role === 'admin' ||
            currentLogged.role === 'moderator' ||
            currentLogged.id === FOUNDER_PROFILE_ID
        );

        const { data: followRows } = await supabase
          .from('follows')
          .select('following_id')
          .eq('follower_id', currentLogged.id);

        if (followRows) {
          setFollowingIds(new Set(followRows.map((r) => r.following_id)));
        }
      }
    } else {
      setLoggedProfile(null);
      setIsStaff(false);
      setFollowingIds(new Set());
    }

    const [{ data: profilesData }, { data: postsData }] = await Promise.all([
      supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false }),
      supabase
        .from('posts')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(80),
    ]);

    const map: Record<string, Profile> = {};
    if (profilesData) {
      const typedProfiles = profilesData as Profile[];
      setProfiles(typedProfiles);
      typedProfiles.forEach((p) => {
        map[p.id] = p;
      });
    }
    setProfilesMap(map);

    if (postsData) {
      const publicPosts = (postsData as Post[]).filter(
        (p) => resolvePostVisibility(p) === 'public'
      );
      setPosts(publicPosts);
    }

    setLoading(false);
    setTimeout(updateCarouselButtons, 150);
  }, [supabase, updateCarouselButtons]);

  // Insight publicado fora do compositor (ex.: repost com comentário) recarrega o feed
  useEffect(() => {
    const onCreated = () => void loadExploreData();
    window.addEventListener('insight:post-created', onCreated);
    return () => window.removeEventListener('insight:post-created', onCreated);
  }, [loadExploreData]);

  useEffect(() => {
    loadExploreData();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      loadExploreData();
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [loadExploreData, supabase]);

  async function handleToggleFollow(targetProfile: Profile, e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();

    if (!loggedProfile) {
      window.location.href = '/login';
      return;
    }

    if (loggedProfile.id === targetProfile.id || followLoadingId === targetProfile.id) {
      return;
    }

    setFollowLoadingId(targetProfile.id);
    const alreadyFollowing = followingIds.has(targetProfile.id);

    try {
      if (alreadyFollowing) {
        await supabase
          .from('follows')
          .delete()
          .eq('follower_id', loggedProfile.id)
          .eq('following_id', targetProfile.id);

        setFollowingIds((prev) => {
          const next = new Set(prev);
          next.delete(targetProfile.id);
          return next;
        });
      } else {
        await supabase.from('follows').insert({
          follower_id: loggedProfile.id,
          following_id: targetProfile.id,
        });

        setFollowingIds((prev) => {
          const next = new Set(prev);
          next.add(targetProfile.id);
          return next;
        });
      }
    } finally {
      setFollowLoadingId(null);
    }
  }

  const trendingTags = useMemo(() => {
    const counts: Record<string, number> = {};
    posts.forEach((p) => {
      (p.tags || []).forEach((raw) => {
        const clean = raw.trim().toLowerCase();
        if (clean) counts[clean] = (counts[clean] || 0) + 1;
      });
    });
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 7)
      .map(([tag, count]) => ({ tag, count }));
  }, [posts]);

  const query = search.trim().toLowerCase();

  const filteredProfiles = useMemo(() => {
    return profiles.filter((p) => {
      if (!query) return true;
      return (
        p.full_name?.toLowerCase().includes(query) ||
        p.display_name?.toLowerCase().includes(query) ||
        p.username?.toLowerCase().includes(query) ||
        p.nickname?.toLowerCase().includes(query) ||
        p.bio?.toLowerCase().includes(query)
      );
    });
  }, [profiles, query]);

  const filteredPosts = useMemo(() => {
    return posts.filter((post) => {
      const ownerId = post.profile_id || post.author_id;
      const author = profilesMap[ownerId];

      if (activeTab === 'following') {
        if (!followingIds.has(ownerId) && ownerId !== loggedProfile?.id) {
          return false;
        }
      }

      if (selectedTag) {
        const hasTag = post.tags?.some((t) => t.toLowerCase() === selectedTag);
        if (!hasTag) return false;
      }

      if (!query) return true;

      return (
        post.content?.toLowerCase().includes(query) ||
        post.tags?.some((t) => t.toLowerCase().includes(query)) ||
        author?.username?.toLowerCase().includes(query) ||
        author?.full_name?.toLowerCase().includes(query) ||
        author?.display_name?.toLowerCase().includes(query)
      );
    });
  }, [posts, profilesMap, activeTab, followingIds, loggedProfile, selectedTag, query]);

  // ---------------------------------------------------- notícias no Para você
  // Só temas que a pessoa segue; a aba Notícias mostra todos.
  const newsFollows = useNewsFollows(loggedProfile?.id ?? null);
  const searchNews = useNewsSearch(activeTab === 'members' ? '' : search, 8);
  const [showAllSearchNews, setShowAllSearchNews] = useState(false);
  useEffect(() => setShowAllSearchNews(false), [search]);
  const mixNews = activeTab === 'for_you' && !selectedTag && !search.trim() && Boolean(loggedProfile);
  const followsKey = Array.from(newsFollows.follows).sort().join(',');
  const forYouNews = useNewsFeed('for_you', {
    enabled: mixNews && newsFollows.follows.size > 0,
    pageSize: 15,
    version: followsKey,
  });
  // o convite para escolher temas fica até sair da página (dá para marcar vários)
  const [showNewsOnboarding, setShowNewsOnboarding] = useState(false);
  useEffect(() => {
    if (mixNews && newsFollows.ready && newsFollows.follows.size === 0) setShowNewsOnboarding(true);
  }, [mixNews, newsFollows.ready, newsFollows.follows.size]);

  type FeedEntry = { kind: 'post'; post: Post } | { kind: 'news'; item: NewsItem } | { kind: 'onboarding' };
  const mixedFeed = useMemo<FeedEntry[]>(() => {
    const out: FeedEntry[] = [];
    const news = mixNews ? forYouNews.items : [];
    const onboarding = mixNews && showNewsOnboarding;
    let k = 0;
    filteredPosts.forEach((post, i) => {
      out.push({ kind: 'post', post });
      if (onboarding && i === 2) out.push({ kind: 'onboarding' });
      // uma notícia a cada 4 posts
      if ((i + 1) % 4 === 0 && k < news.length) out.push({ kind: 'news', item: news[k++] });
    });
    if (onboarding && filteredPosts.length < 3) out.push({ kind: 'onboarding' });
    // feed curto: completa com mais algumas notícias
    const extra = filteredPosts.length < 12 ? 6 : 2;
    for (let n = 0; n < extra && k < news.length; n++) out.push({ kind: 'news', item: news[k++] });
    return out;
  }, [filteredPosts, forYouNews.items, mixNews, showNewsOnboarding]);
  const progressiveFeed = useProgressiveList(mixedFeed, 8, 8, `${activeTab}|${selectedTag}|${query}`);

  const { isOnline } = usePresence();

  // Quem está online agora (sem contar quem está vendo)
  const onlineNow = useMemo(
    () => profiles.filter((p) => p.id !== loggedProfile?.id && isOnline(p.id, p.last_seen_at)),
    [profiles, loggedProfile?.id, isOnline]
  );

  // "Novos posts ↑": confere de tempos em tempos se chegou algo depois do mais recente carregado
  const [freshPosts, setFreshPosts] = useState<{ id: string; author: string }[]>([]);
  useEffect(() => {
    setFreshPosts([]);
    if (loading || (activeTab !== 'for_you' && activeTab !== 'following')) return;
    const newest = posts.reduce((m, p) => (p.created_at > m ? p.created_at : m), '');
    if (!newest) return;
    let alive = true;
    const check = async () => {
      if (document.visibilityState !== 'visible') return;
      const { data } = await supabase
        .from('posts')
        .select('id, profile_id, author_id, visibility, firstVisibility:blocks->0->>postVisibility')
        .gt('created_at', newest)
        .order('created_at', { ascending: false })
        .limit(20);
      if (!alive || !data) return;
      const fresh = (data as { id: string; profile_id: string | null; author_id: string | null; visibility: string | null; firstVisibility: string | null }[])
        .filter((p) => p.visibility !== 'private' && p.firstVisibility !== 'private')
        .map((p) => ({ id: p.id, author: (p.profile_id || p.author_id) as string }))
        .filter((p) => p.author && p.author !== loggedProfile?.id)
        .filter((p) => activeTab !== 'following' || followingIds.has(p.author));
      setFreshPosts(fresh);
    };
    const t = setInterval(() => void check(), 45_000);
    const onVisible = () => void check();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      alive = false;
      clearInterval(t);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [posts, loading, activeTab, followingIds, loggedProfile?.id, supabase]);

  const showFreshPosts = async () => {
    setFreshPosts([]);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    await loadExploreData();
  };
  // quem está online aparece primeiro no carrossel
  const carouselMembers = useMemo(() => {
    const on = filteredProfiles.filter((p) => isOnline(p.id, p.last_seen_at));
    const off = filteredProfiles.filter((p) => !isOnline(p.id, p.last_seen_at));
    return [...on, ...off];
  }, [filteredProfiles, isOnline]);

  return (
    <div className="w-full min-h-screen bg-background">
      {/* Agradecimento à doação mais recente (cada pessoa vê uma vez) */}
      <DonorThanksBar />

      {/* 1. CABEÇALHO UNIFICADO: 1 LINHA LIMPA NO MOBILE + BUSCA EXPANSÍVEL */}
      <header className="sticky top-0 z-30 bg-background/85 backdrop-blur-md border-b border-border">
        <div className="px-4 sm:px-6 flex items-center justify-between gap-2">
          <div
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
            className="flex items-center gap-4 sm:gap-6 text-xs sm:text-sm font-bold overflow-x-auto [&::-webkit-scrollbar]:hidden"
          >
            <button
              type="button"
              onClick={() => handleSelectTab('for_you')}
              className={`py-3 relative transition-colors whitespace-nowrap flex items-center gap-1.5 ${
                activeTab === 'for_you'
                  ? 'text-primary'
                  : 'text-secondary hover:text-primary'
              }`}
            >
              {tabSwitching && activeTab === 'for_you' && <AsteriskLoader size="xs" />}
              <span>Para você</span>
              {activeTab === 'for_you' && (
                <span className="absolute bottom-0 left-0 right-0 h-[2.5px] rounded-full bg-accent" />
              )}
            </button>

            <button
              type="button"
              onClick={() => handleSelectTab('news')}
              className={`py-3 relative transition-colors whitespace-nowrap flex items-center gap-1.5 ${
                activeTab === 'news'
                  ? 'text-primary'
                  : 'text-secondary hover:text-primary'
              }`}
            >
              {tabSwitching && activeTab === 'news' && <AsteriskLoader size="xs" />}
              <span>Notícias</span>
              {activeTab === 'news' && (
                <span className="absolute bottom-0 left-0 right-0 h-[2.5px] rounded-full bg-accent" />
              )}
            </button>

            <button
              type="button"
              onClick={() => handleSelectTab('following')}
              className={`py-3 relative transition-colors whitespace-nowrap flex items-center gap-1.5 ${
                activeTab === 'following'
                  ? 'text-primary'
                  : 'text-secondary hover:text-primary'
              }`}
            >
              {tabSwitching && activeTab === 'following' && <AsteriskLoader size="xs" />}
              <span>Seguindo</span>
              {activeTab === 'following' && (
                <span className="absolute bottom-0 left-0 right-0 h-[2.5px] rounded-full bg-accent" />
              )}
            </button>

            <button
              type="button"
              onClick={() => handleSelectTab('members')}
              className={`py-3 relative transition-colors flex items-center gap-1.5 whitespace-nowrap ${
                activeTab === 'members'
                  ? 'text-primary'
                  : 'text-secondary hover:text-primary'
              }`}
            >
              {tabSwitching && activeTab === 'members' && <AsteriskLoader size="xs" />}
              <span>Membros</span>
              <span className="px-1.5 py-0.2 rounded-full bg-elevated border border-border text-[10px] font-mono text-muted">
                {filteredProfiles.length}
              </span>
              {activeTab === 'members' && (
                <span className="absolute bottom-0 left-0 right-0 h-[2.5px] rounded-full bg-accent" />
              )}
            </button>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {/* Botão de lupa compacto no mobile */}
            <button
              type="button"
              onClick={() => setMobileSearchOpen((prev) => !prev)}
              aria-label="Buscar"
              className={`sm:hidden w-8 h-8 rounded-full border flex items-center justify-center transition-colors ${
                mobileSearchOpen || search
                  ? 'bg-accent/15 border-accent text-accent'
                  : 'bg-surface border-border text-secondary hover:text-primary'
              }`}
            >
              <Search className="w-3.5 h-3.5" />
            </button>

            {/* Campo de busca fixo no desktop */}
            <div className="relative hidden sm:block">
              <Search className="w-3.5 h-3.5 text-muted absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar..."
                className="w-44 focus:w-60 h-8 pl-8 pr-7 rounded-full bg-surface border border-border text-xs text-primary placeholder:text-muted focus:outline-none focus:border-accent focus:bg-background transition-all duration-200"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  aria-label="Limpar busca"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted hover:text-primary"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            {loggedProfile && (
              <button
                type="button"
                onClick={() => setShowQuickComposer(!showQuickComposer)}
                title="Publicar Insight"
                aria-label="Publicar Insight"
                className={`h-8 px-2.5 sm:px-3 rounded-full text-xs font-bold flex items-center gap-1.5 transition-all shrink-0 ${
                  showQuickComposer
                    ? 'bg-elevated text-primary border border-border'
                    : 'bg-accent hover:bg-accent-hover text-white shadow-sm'
                }`}
              >
                <PenSquare className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Publicar Insight</span>
              </button>
            )}
          </div>
        </div>

        {/* Barra de busca expansível exclusiva para mobile */}
        {mobileSearchOpen && (
          <div className="sm:hidden px-4 pb-2.5 pt-0.5">
            <div className="relative">
              <Search className="w-4 h-4 text-muted absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                autoFocus
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar posts, #tags ou membros..."
                className="w-full h-9 pl-10 pr-8 rounded-full bg-surface border border-border text-primary placeholder:text-muted focus:outline-none focus:border-accent"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  aria-label="Limpar busca"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-primary"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        )}
      </header>

      {/* Novos posts chegaram: pílula flutuante logo abaixo do cabeçalho */}
      {freshPosts.length > 0 && (activeTab === 'for_you' || activeTab === 'following') && (
        <div className="sticky top-14 z-20 h-0 pointer-events-none">
          <button
            type="button"
            onClick={() => void showFreshPosts()}
            className="pointer-events-auto absolute left-1/2 -translate-x-1/2 top-2 insight-slide-down inline-flex items-center gap-2 pl-1.5 pr-3.5 py-1.5 rounded-full bg-accent text-white text-xs font-bold shadow-lg shadow-accent/30 hover:bg-accent-hover transition-colors"
          >
            <span className="flex -space-x-1.5">
              {[...new Set(freshPosts.map((f) => f.author))].slice(0, 3).map((aid) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={aid}
                  src={profilesMap[aid]?.avatar_url || '/assets/net/default-perfil'}
                  alt=""
                  className="w-5 h-5 rounded-full object-cover ring-2 ring-accent bg-elevated"
                />
              ))}
            </span>
            <ArrowUp className="w-3.5 h-3.5" />
            {freshPosts.length === 1 ? '1 novo post' : `${freshPosts.length >= 20 ? '20+' : freshPosts.length} novos posts`}
          </button>
        </div>
      )}

      {/* 2. COMPOSER EXPANSÍVEL */}
      {loggedProfile && showQuickComposer && (
        <div className="border-b border-border bg-surface/20">
          <PostComposer
            authorId={loggedProfile.id}
            isAdmin={true}
            onPostCreated={() => {
              setShowQuickComposer(false);
              loadExploreData();
            }}
          />
        </div>
      )}

      {/* 3. PÍLULAS DE HASHTAGS EM ALTA */}
      {activeTab !== 'members' && activeTab !== 'news' && trendingTags.length > 0 && (
        <div
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
          className="px-4 sm:px-6 py-2 border-b border-border flex items-center gap-1.5 overflow-x-auto [&::-webkit-scrollbar]:hidden"
        >
          <span className="text-[11px] font-bold text-muted flex items-center gap-1 shrink-0 mr-1">
            <Sparkles className="w-3 h-3 text-accent" />
            <span>Em alta:</span>
          </span>

          {selectedTag && (
            <button
              type="button"
              onClick={() => setSelectedTag(null)}
              className="px-2 py-0.5 rounded-full bg-elevated border border-border text-[11px] font-semibold text-secondary hover:text-primary shrink-0"
            >
              Todas
            </button>
          )}

          {trendingTags.map(({ tag, count }) => {
            const isSelected = selectedTag === tag;
            return (
              <button
                key={tag}
                type="button"
                onClick={() => setSelectedTag(isSelected ? null : tag)}
                className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full border text-[11px] font-mono font-semibold transition-colors shrink-0 ${
                  isSelected
                    ? 'bg-accent text-white border-accent'
                    : 'bg-surface border-border text-secondary hover:text-primary hover:border-accent/50'
                }`}
              >
                <Hash className="w-2.5 h-2.5" />
                <span>{tag}</span>
                <span className="opacity-60 text-[10px]">({count})</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Domingo: ranking semanal de contribuição */}
      {activeTab !== 'members' && activeTab !== 'news' && !search.trim() && <WeeklyRankingCard />}

      {/* 4. CONTEÚDO COM ANIMAÇÃO DO ASTERISCO GIRANDO */}
      {loading || tabSwitching ? (
        <AsteriskLoader
          size="md"
          label={loading ? 'Sincronizando comunidade...' : undefined}
        />
      ) : activeTab === 'news' ? (
        <NewsFeed profileId={loggedProfile?.id ?? null} />
      ) : activeTab === 'members' ? (
        <div className="divide-y divide-border">
          {filteredProfiles.length === 0 ? (
            <p className="py-14 text-center text-xs text-muted">
              Nenhum membro encontrado para &ldquo;{search}&rdquo;.
            </p>
          ) : (
            filteredProfiles.map((prof) => {
              const isFounder = prof.id === FOUNDER_PROFILE_ID;
              const profileHref = `/u/${encodeURIComponent(prof.username)}`;
              const isFollowing = followingIds.has(prof.id);
              const isMe = loggedProfile?.id === prof.id;

              return (
                <Link
                  key={prof.id}
                  href={profileHref}
                  className="px-4 sm:px-6 py-4 hover:bg-surface/40 transition-colors flex items-start justify-between gap-3 group"
                >
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    <span className="relative shrink-0">
                      <CosmeticAvatar profile={prof} size={44}>
                        <img
                          src={prof.avatar_url || '/assets/net/default-perfil'}
                          alt={prof.full_name}
                          className="w-10 h-10 sm:w-11 sm:h-11 rounded-full object-cover border border-border bg-elevated"
                        />
                      </CosmeticAvatar>
                      <OnlineDot profileId={prof.id} lastSeenAt={prof.last_seen_at} size={12} />
                    </span>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
                        <span className="text-sm font-extrabold text-primary group-hover:text-accent transition-colors truncate">
                          <CosmeticName profile={prof}>{prof.display_name || prof.full_name}</CosmeticName>
                        </span>

                        <ShieldCheck className="w-3.5 h-3.5 text-[#00ccff] shrink-0" />

                        <CosmeticTag profile={prof} className="shrink-0" />

                        {prof.nickname && (
                          <span
                            style={{ color: prof.nickname_color || '#facc15' }}
                            className="text-xs font-bold truncate"
                          >
                            · {prof.nickname}
                          </span>
                        )}
                      </div>

                      <p className="text-xs text-muted truncate">
                        @{prof.username}
                        {isFounder && (
                          <span className="ml-2 text-[10px] font-mono text-accent">
                            Fundador
                          </span>
                        )}
                      </p>

                      {prof.bio && (
                        <p className="text-xs text-secondary mt-1.5 line-clamp-2 leading-relaxed">
                          {prof.bio}
                        </p>
                      )}
                    </div>
                  </div>

                  {!isMe ? (
                    <button
                      type="button"
                      disabled={followLoadingId === prof.id}
                      onClick={(e) => handleToggleFollow(prof, e)}
                      className={`px-3 sm:px-3.5 py-1.5 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 ${
                        isFollowing
                          ? 'bg-elevated border border-border text-primary hover:border-danger hover:text-danger'
                          : 'bg-primary text-background hover:opacity-90'
                      }`}
                    >
                      {isFollowing ? (
                        <>
                          <UserCheck className="w-3.5 h-3.5" />
                          <span>Seguindo</span>
                        </>
                      ) : (
                        <>
                          <UserPlus className="w-3.5 h-3.5" />
                          <span>Seguir</span>
                        </>
                      )}
                    </button>
                  ) : (
                    <span className="px-3 py-1 rounded-full bg-elevated border border-border text-[11px] font-semibold text-muted shrink-0">
                      Meu Perfil
                    </span>
                  )}
                </Link>
              );
            })
          )}
        </div>
      ) : (
        <div>
          {/* Online agora: quem está no Insight neste momento */}
          {activeTab === 'for_you' && !selectedTag && onlineNow.length > 0 && (
            <section className="px-4 sm:px-6 py-2.5 border-b border-border flex items-center gap-3 min-w-0" aria-label="Online agora">
              <span className="flex items-center gap-1.5 text-xs font-semibold text-secondary shrink-0">
                <span className="relative flex w-2 h-2">
                  <span className="absolute inline-flex w-full h-full rounded-full bg-emerald-500 opacity-60 animate-ping" />
                  <span className="relative inline-flex w-2 h-2 rounded-full bg-emerald-500" />
                </span>
                {onlineNow.length} online agora
              </span>
              <div className="flex items-center -space-x-2 min-w-0 overflow-hidden py-0.5">
                {onlineNow.slice(0, 12).map((prof) => (
                  <Link
                    key={prof.id}
                    href={`/u/${encodeURIComponent(prof.username)}`}
                    title={prof.display_name || prof.full_name || prof.username}
                    className="shrink-0 transition-transform hover:-translate-y-0.5 hover:z-10"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={prof.avatar_url || '/assets/net/default-perfil'}
                      alt={prof.display_name || prof.full_name || prof.username}
                      className="w-7 h-7 rounded-full object-cover ring-2 ring-background bg-elevated"
                    />
                  </Link>
                ))}
              </div>
              {onlineNow.length > 12 && <span className="text-xs text-muted shrink-0">+{onlineNow.length - 12}</span>}
            </section>
          )}

          {activeTab === 'for_you' && !selectedTag && carouselMembers.length > 0 && (
            <section className="px-4 sm:px-6 py-3 border-b border-border bg-surface/20 relative">
              <div className="flex items-center justify-between mb-2.5 gap-2">
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-secondary flex items-center gap-1.5 truncate">
                  <Users className="w-3.5 h-3.5 text-accent shrink-0" />
                  <span className="truncate">
                    Membros da Comunidade ({carouselMembers.length})
                  </span>
                </span>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleScrollCarousel('left')}
                    disabled={!canScrollLeft}
                    title="Anterior"
                    className="hidden sm:flex w-6 h-6 rounded-full bg-surface border border-border items-center justify-center text-secondary hover:text-primary hover:border-accent disabled:opacity-30 disabled:pointer-events-none transition-all"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleScrollCarousel('right')}
                    disabled={!canScrollRight}
                    title="Próximo"
                    className="hidden sm:flex w-6 h-6 rounded-full bg-surface border border-border items-center justify-center text-secondary hover:text-primary hover:border-accent disabled:opacity-30 disabled:pointer-events-none transition-all"
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSelectTab('members')}
                    className="sm:ml-1.5 text-[11px] font-semibold text-accent hover:underline"
                  >
                    Ver lista
                  </button>
                </div>
              </div>

              <div
                ref={carouselRef}
                onScroll={updateCarouselButtons}
                style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                className="flex items-stretch gap-2.5 overflow-x-auto scroll-smooth [&::-webkit-scrollbar]:hidden py-1.5"
              >
                {carouselMembers.map((prof) => {
                  const profileHref = `/u/${encodeURIComponent(prof.username)}`;
                  const isFollowing = followingIds.has(prof.id);
                  const isMe = loggedProfile?.id === prof.id;

                  return (
                    <Link
                      key={prof.id}
                      href={profileHref}
                      className="w-[240px] sm:w-[272px] shrink-0 p-2.5 rounded-xl bg-surface border border-border hover:border-accent/60 transition-all flex items-center justify-between gap-2 group"
                    >
                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        <span className="relative shrink-0">
                          <CosmeticAvatar profile={prof} size={36}>
                            <img
                              src={prof.avatar_url || '/assets/net/default-perfil'}
                              alt={prof.full_name}
                              className="w-9 h-9 rounded-full object-cover border border-border bg-elevated"
                            />
                          </CosmeticAvatar>
                          <OnlineDot profileId={prof.id} lastSeenAt={prof.last_seen_at} size={11} />
                        </span>
                        <div className="min-w-0 flex-1 overflow-hidden">
                          <div className="flex items-center gap-1">
                            <p className="text-xs font-bold text-primary group-hover:text-accent transition-colors truncate">
                              <CosmeticName profile={prof}>{prof.display_name || prof.full_name}</CosmeticName>
                            </p>
                            <ShieldCheck className="w-3 h-3 text-[#00ccff] shrink-0" />
                          </div>
                          <p className="text-[11px] text-muted truncate">@{prof.username}</p>
                          <CosmeticTag profile={prof} className="mt-0.5 max-w-full" />
                        </div>
                      </div>

                      {!isMe ? (
                        <button
                          type="button"
                          disabled={followLoadingId === prof.id}
                          onClick={(e) => handleToggleFollow(prof, e)}
                          className={`px-2.5 py-1 rounded-full text-[11px] font-bold transition-colors shrink-0 ${
                            isFollowing
                              ? 'bg-elevated border border-border text-secondary'
                              : 'bg-primary text-background hover:opacity-90'
                          }`}
                        >
                          {isFollowing ? 'Seguindo' : 'Seguir'}
                        </button>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full bg-elevated border border-border text-[10px] font-semibold text-muted shrink-0">
                          Você
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            </section>
          )}

          {search.trim().length >= 2 && searchNews.items.length > 0 && (
            <section className="border-b border-border" aria-label="Notícias relacionadas à busca">
              <div className="px-4 sm:px-6 pt-3 pb-1 flex items-center justify-between">
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-secondary flex items-center gap-1.5">
                  <Newspaper className="w-3.5 h-3.5 text-sky-400" /> Notícias sobre &ldquo;{search.trim()}&rdquo;
                </span>
                {searchNews.items.length > 3 && (
                  <button type="button" onClick={() => setShowAllSearchNews((v) => !v)} className="text-[11px] font-semibold text-accent hover:underline">
                    {showAllSearchNews ? 'Ver menos' : `Ver todas (${searchNews.items.length})`}
                  </button>
                )}
              </div>
              {(showAllSearchNews ? searchNews.items : searchNews.items.slice(0, 3)).map((item) => (
                <NewsCard key={`sn-${item.id}`} item={item} onPatch={searchNews.patch} compact />
              ))}
            </section>
          )}

          {filteredPosts.length === 0 && !mixNews ? (
            <div className="py-16 px-6 text-center space-y-2">
              <p className="text-sm font-bold text-primary">
                {activeTab === 'following'
                  ? 'Nenhum Insight das contas que você segue ainda'
                  : 'Nenhum Insight encontrado'}
              </p>
              <p className="text-xs text-muted max-w-sm mx-auto">
                {activeTab === 'following'
                  ? 'Siga outros membros da comunidade no carrossel acima para personalizar este feed.'
                  : 'Tente buscar outro termo ou limpar o filtro de hashtag.'}
              </p>
            </div>
          ) : (
            <div>
              {progressiveFeed.visible.map((entry) => {
                if (entry.kind === 'news') {
                  return (
                    <NewsCard
                      key={`news-${entry.item.id}`}
                      item={entry.item}
                      onPatch={forYouNews.patch}
                      follows={newsFollows.follows}
                      onToggleFollow={(t) => void newsFollows.toggle(t)}
                    />
                  );
                }
                if (entry.kind === 'onboarding') {
                  return (
                    <div key="news-onboarding" className="px-4 sm:px-6 py-5 border-b border-border bg-gradient-to-br from-accent/10 via-transparent to-transparent">
                      <NewsTopicPicker
                        follows={newsFollows.follows}
                        onToggle={(t) => void newsFollows.toggle(t)}
                        title="Notícias no seu Para você"
                        hint="Siga temas e as melhores notícias deles aparecem aqui, entre os posts. Na aba Notícias tem de tudo."
                      />
                    </div>
                  );
                }
                const post = entry.post;
                const ownerId = post.profile_id || post.author_id;
                const postAuthor = profilesMap[ownerId] || profiles[0];
                if (!postAuthor) return null;

                const canManagePost =
                  isStaff || loggedProfile?.id === postAuthor.id;

                return (
                  <PostCard
                    key={post.id}
                    post={post}
                    author={postAuthor}
                    isAdmin={canManagePost}
                    onDelete={(deletedId) =>
                      setPosts((prev) => prev.filter((p) => p.id !== deletedId))
                    }
                  />
                );
              })}
              {progressiveFeed.hasMore && <div ref={progressiveFeed.sentinelRef} className="h-24" aria-hidden />}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function HomePage() {
  return (
    <Suspense fallback={<AsteriskLoader size="lg" fullHeight />}>
      <CommunityHomeFeed />
    </Suspense>
  );
}