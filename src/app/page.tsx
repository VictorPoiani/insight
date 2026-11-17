'use client';

import { useEffect, useState, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Post, Profile } from '@/types/database';
import { ProfileHeader } from '@/components/feed/ProfileHeader';
import { PostComposer } from '@/components/feed/PostComposer';
import { PostCard, resolvePostVisibility } from '@/components/feed/PostCard';
import {
  TopicTabsManager,
  DEFAULT_TABS,
  FeedTabItem,
} from '@/components/feed/TopicTabsManager';
import { Lock, Globe, Layers } from 'lucide-react';

const DEFAULT_PROFILE_ID =
  process.env.NEXT_PUBLIC_DEFAULT_PROFILE_ID ||
  '96d271a9-9102-49b1-b593-9279c5dfe3f4';

const FALLBACK_PROFILE: Profile = {
  id: DEFAULT_PROFILE_ID,
  username: 'Victor Poiani',
  full_name: 'Victor Poiani',
  display_name: 'Victor Poiani',
  nickname: 'Desenvolvedor Médio',
  nickname_color: '#E63946',
  location: 'Rio Paranaíba, MG',
  bio: 'Criador do Insight (antigo Post It). Plataforma comunitária afim de compartilhar ideias e tudo o que piscar em sua mente. Aproveite.',
  avatar_url: '/assets/net/default-perfil',
  banner_url: null,
  social_links: {
    instagram: 'https://www.instagram.com/victorpoiani/',
  },
  created_at: new Date().toISOString(),
};

function FeedContent() {
  const [profile, setProfile] = useState<Profile>(FALLBACK_PROFILE);
  const [posts, setPosts] = useState<Post[]>([]);
  const [activeTab, setActiveTab] = useState<FeedTabItem>(DEFAULT_TABS[0]);
  const [adminVisibilityFilter, setAdminVisibilityFilter] = useState<
    'all' | 'public' | 'private'
  >('all');
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  const searchParams = useSearchParams();
  const queryFilter = searchParams.get('q')?.trim().toLowerCase() || '';
  const tagParam = searchParams.get('tag')?.trim().toLowerCase() || '';

  const supabase = createClient();

  const loadData = useCallback(async () => {
    setLoading(true);

    const {
      data: { session },
    } = await supabase.auth.getSession();
    setIsAdmin(Boolean(session?.user));

    const { data: profileData } = await supabase
      .from('profiles')
      .select('*')
      .limit(1)
      .maybeSingle();

    if (profileData) {
      setProfile(profileData as Profile);
    }

    const { data: postsData } = await supabase
      .from('posts')
      .select('*')
      .order('is_pinned', { ascending: false })
      .order('created_at', { ascending: false });

    if (postsData) {
      setPosts(postsData as Post[]);
    }

    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    loadData();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsAdmin(Boolean(session?.user));
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [loadData, supabase]);

  // Verifica se a aba ativa é um modelo de Workspace proprio
  const isModelWorkspace =
    !activeTab.isDefault &&
    Boolean(activeTab.templateType && activeTab.templateType !== 'blank_page');

  const visiblePostsForRole = posts.filter((post) => {
    const vis = resolvePostVisibility(post);
    if (!isAdmin && vis === 'private') return false;
    return true;
  });

  const privatePostsCount = posts.filter(
    (p) => resolvePostVisibility(p) === 'private'
  ).length;

  const filteredPosts = visiblePostsForRole.filter((post) => {
    const vis = resolvePostVisibility(post);

    if (isAdmin && adminVisibilityFilter !== 'all') {
      if (adminVisibilityFilter !== vis) return false;
    }

    if (queryFilter) {
      const matchText = post.content?.toLowerCase().includes(queryFilter);
      const matchTag = post.tags?.some((t) =>
        t.toLowerCase().includes(queryFilter)
      );
      if (!matchText && !matchTag) return false;
    }

    if (tagParam) {
      return post.tags?.some((t) => t.toLowerCase() === tagParam);
    }

    if (activeTab.id === 'principal') return true;
    if (activeTab.id === 'reposts') return (post.reposts_count || 0) > 0;
    if (activeTab.tag) {
      return post.tags?.some(
        (t) => t.toLowerCase() === activeTab.tag!.toLowerCase()
      );
    }

    return true;
  });

  return (
    <div className="w-full">
      {/* 1. Cabeçalho do Perfil */}
      <ProfileHeader
        profile={profile}
        postsCount={visiblePostsForRole.length}
        isAdmin={isAdmin}
        onProfileUpdated={loadData}
      />

      {/* 2. Abas de Tópicos + Renderizador de Workspaces de Modelo */}
      <TopicTabsManager
        activeTabId={activeTab.id}
        onSelectTab={(tab) => setActiveTab(tab)}
        isAdmin={isAdmin}
      />

      {/* 3. Se for Tópico de Feed ou Página Vazia, mostra o Composer e a Lista de Posts */}
      {!isModelWorkspace && (
        <>
          {isAdmin && (
            <PostComposer
              authorId={profile.id}
              onPostCreated={loadData}
              defaultTag={activeTab.tag}
            />
          )}

          {isAdmin && privatePostsCount > 0 && (
            <div className="px-6 py-2.5 border-b border-border bg-surface/30 flex items-center justify-between gap-2 text-xs">
              <span className="text-[11px] font-semibold text-secondary">
                Visualização do Autor:
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setAdminVisibilityFilter('all')}
                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-colors ${
                    adminVisibilityFilter === 'all'
                      ? 'bg-accent text-white border-accent'
                      : 'bg-elevated border-border text-secondary hover:text-primary'
                  }`}
                >
                  <Layers className="w-3 h-3" />
                  <span>Todos ({posts.length})</span>
                </button>

                <button
                  type="button"
                  onClick={() => setAdminVisibilityFilter('public')}
                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-colors ${
                    adminVisibilityFilter === 'public'
                      ? 'bg-accent text-white border-accent'
                      : 'bg-elevated border-border text-secondary hover:text-primary'
                  }`}
                >
                  <Globe className="w-3 h-3" />
                  <span>Públicos ({posts.length - privatePostsCount})</span>
                </button>

                <button
                  type="button"
                  onClick={() => setAdminVisibilityFilter('private')}
                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-colors ${
                    adminVisibilityFilter === 'private'
                      ? 'bg-zinc-200 text-zinc-950 border-white'
                      : 'bg-elevated border-border text-secondary hover:text-primary'
                  }`}
                >
                  <Lock className="w-3 h-3" />
                  <span>Privados ({privatePostsCount})</span>
                </button>
              </div>
            </div>
          )}

          {loading ? (
            <p className="text-xs text-muted text-center py-12">
              Carregando publicações...
            </p>
          ) : filteredPosts.length === 0 ? (
            <div className="text-center py-14 px-6 space-y-1">
              <p className="text-sm font-bold text-primary">
                Nenhuma publicação encontrada em &ldquo;{activeTab.label}&rdquo;
              </p>
              <p className="text-xs text-muted">
                {activeTab.tag
                  ? `Ainda não há insights publicados com a tag #${activeTab.tag}.`
                  : 'Ainda não há publicações nesta seção.'}
              </p>
            </div>
          ) : (
            <div>
              {filteredPosts.map((post) => (
                <PostCard
                  key={post.id}
                  post={post}
                  author={profile}
                  isAdmin={isAdmin}
                  onDelete={(deletedId) =>
                    setPosts((prev) => prev.filter((p) => p.id !== deletedId))
                  }
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default function HomePage() {
  return (
    <Suspense
      fallback={
        <p className="text-xs text-muted text-center py-12">Carregando...</p>
      }
    >
      <FeedContent />
    </Suspense>
  );
}