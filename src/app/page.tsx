'use client';

import { useEffect, useState, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Post, Profile } from '@/types/database';
import { ProfileHeader } from '@/components/feed/ProfileHeader';
import { PostComposer } from '@/components/feed/PostComposer';
import { PostCard } from '@/components/feed/PostCard';
import {
  TopicTabsManager,
  DEFAULT_TABS,
  FeedTabItem,
} from '@/components/feed/TopicTabsManager';

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
  avatar_url: '/assets/net/logo.png',
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

    // Atualiza os botões de Admin instantaneamente quando você faz login ou logout
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsAdmin(Boolean(session?.user));
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [loadData, supabase]);

  const filteredPosts = posts.filter((post) => {
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
    <div>
      {/* 1. Cabeçalho do Perfil (Edição visível apenas para Admin) */}
      <ProfileHeader
        profile={profile}
        postsCount={posts.length}
        isAdmin={isAdmin}
        onProfileUpdated={loadData}
      />

      {/* 2. Abas de Tópicos (Botão '+' e exclusão visíveis apenas para Admin) */}
      <TopicTabsManager
        activeTabId={activeTab.id}
        onSelectTab={(tab) => setActiveTab(tab)}
        isAdmin={isAdmin}
      />

      {/* 3. Editor de Postagens (Exclusivo para Admin) */}
      {isAdmin && (
        <PostComposer
          authorId={profile.id}
          onPostCreated={loadData}
          defaultTag={activeTab.tag}
        />
      )}

      {/* 4. Lista de Publicações (Visitantes podem curtir, comentar e compartilhar) */}
      {loading ? (
        <p className="text-xs text-muted text-center py-12">
          Carregando insights...
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