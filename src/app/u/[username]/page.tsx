'use client';

import { useEffect, useState, useCallback, useMemo, Suspense } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Post, Profile } from '@/types/database';
import { ProfileHeader } from '@/components/feed/ProfileHeader';
import {
  TopicTabsManager,
  DEFAULT_TABS,
  FeedTabItem,
} from '@/components/feed/TopicTabsManager';
import { PostComposer } from '@/components/feed/PostComposer';
import { PostCard, resolvePostVisibility } from '@/components/feed/PostCard';
import ContributorLevelPill from '@/components/ContributorLevelPill';
import {
  ShieldAlert,
  Trash2,
  UserCheck,
  ArrowLeft,
  Lock,
  Globe,
  Layers,
  X,
} from 'lucide-react';

const FOUNDER_PROFILE_ID = '96d271a9-9102-49b1-b593-9279c5dfe3f4';

/**
 * Animação do Asterisco de 8 pontas (*) para carregamento do perfil e troca de abas
 */
function ProfileAsteriskLoader({
  size = 'md',
  color = '#3898ec',
  label,
  fullHeight = false,
}: {
  size?: 'sm' | 'md' | 'lg';
  color?: string;
  label?: string;
  fullHeight?: boolean;
}) {
  const sizeMap = { sm: 24, md: 38, lg: 52 };
  const px = sizeMap[size];
  const armAngles = [0, 45, 90, 135];

  return (
    <div
      className={`w-full flex flex-col items-center justify-center gap-3 select-none ${
        fullHeight ? 'min-h-[65vh] py-16' : 'py-12'
      }`}
    >
      <style jsx>{`
        @keyframes profileAsteriskSpin3D {
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
          style={{
            width: px * 1.5,
            height: px * 1.5,
            backgroundColor: color,
          }}
          className="absolute rounded-full opacity-20 blur-xl animate-pulse pointer-events-none"
        />

        <div
          style={{
            width: px,
            height: px,
            animation: 'profileAsteriskSpin3D 1.55s cubic-bezier(0.4, 0, 0.2, 1) infinite',
          }}
          className="relative z-10 drop-shadow-[0_6px_16px_rgba(37,99,235,0.32)]"
        >
          <svg viewBox="0 0 200 200" className="w-full h-full overflow-visible">
            <g transform="translate(100, 100)">
              {armAngles.map((angle) => (
                <rect
                  key={angle}
                  x="-17"
                  y="-86"
                  width="34"
                  height="172"
                  rx="6"
                  ry="6"
                  transform={`rotate(${angle})`}
                  fill={color}
                  stroke="#93c5fd"
                  strokeWidth="1.2"
                />
              ))}
              <circle r="26" fill={color} />
            </g>
          </svg>
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

function UserProfileContent() {
  const params = useParams<{ username: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();

  const decodedUsername = decodeURIComponent(params.username || '');
  const queryFilter = searchParams.get('q')?.trim().toLowerCase() || '';
  const tagParam = searchParams.get('tag')?.trim().toLowerCase() || '';

  const [profile, setProfile] = useState<Profile | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [activeTab, setActiveTab] = useState<FeedTabItem>(DEFAULT_TABS[0]);
  const [tabSwitching, setTabSwitching] = useState(false);

  const [adminVisibilityFilter, setAdminVisibilityFilter] = useState<
    'all' | 'public' | 'private'
  >('all');

  const [isOwner, setIsOwner] = useState(false);
  const [isStaff, setIsStaff] = useState(false);
  const [loading, setLoading] = useState(true);

  function handleSelectTopicTab(nextTab: FeedTabItem) {
    if (nextTab.id !== activeTab.id) {
      setTabSwitching(true);
      setTimeout(() => {
        setTabSwitching(false);
      }, 280);
    }
    setActiveTab(nextTab);
  }

  const loadProfileAndPosts = useCallback(async () => {
    setLoading(true);

    // 1. Busca o perfil pelo @username na URL (inclui total_donated, contributor_points e contributor_level)
    const { data: targetProfile } = await supabase
      .from('profiles')
      .select('*')
      .ilike('username', decodedUsername)
      .maybeSingle();

    if (!targetProfile) {
      setProfile(null);
      setLoading(false);
      return;
    }

    const typedProfile = targetProfile as Profile;
    setProfile(typedProfile);

    // 2. Verifica a sessão atual (Dono do Perfil vs. Equipe Dev)
    const {
      data: { session },
    } = await supabase.auth.getSession();

    const currentAuthId = session?.user?.id || null;

    if (currentAuthId) {
      const ownerMatch =
        typedProfile.user_id === currentAuthId ||
        typedProfile.id === currentAuthId;

      const { data: myProfile } = await supabase
        .from('profiles')
        .select('id, role')
        .or(`user_id.eq.${currentAuthId},id.eq.${currentAuthId}`)
        .maybeSingle();

      const staffMatch =
        myProfile?.role === 'admin' ||
        myProfile?.role === 'moderator' ||
        myProfile?.id === FOUNDER_PROFILE_ID;

      const founderSelfMatch =
        typedProfile.id === FOUNDER_PROFILE_ID &&
        myProfile?.id === FOUNDER_PROFILE_ID;

      setIsOwner(ownerMatch || founderSelfMatch);
      setIsStaff(Boolean(staffMatch));
    } else {
      setIsOwner(false);
      setIsStaff(false);
    }

    // 3. Busca as publicações deste perfil (incluindo posts legados caso seja o perfil fundador)
    const isFounder = typedProfile.id === FOUNDER_PROFILE_ID;

    const { data: allPostsData } = await supabase
      .from('posts')
      .select('*')
      .order('is_pinned', { ascending: false })
      .order('created_at', { ascending: false });

    if (allPostsData) {
      const belongingToThisProfile = (allPostsData as Post[]).filter((p) => {
        if (p.profile_id === typedProfile.id || p.author_id === typedProfile.id) {
          return true;
        }
        // Posts antigos sem profile_id pertencem exclusivamente ao perfil fundador
        if (isFounder && !p.profile_id && !p.author_id) {
          return true;
        }
        return false;
      });
      setPosts(belongingToThisProfile);
    }

    setLoading(false);
  }, [decodedUsername, supabase]);

  useEffect(() => {
    loadProfileAndPosts();
  }, [loadProfileAndPosts]);

  // Ação de Moderação: Excluir perfil tóxico
  async function handleStaffDeleteProfile() {
    if (!profile || !isStaff) return;
    if (profile.id === FOUNDER_PROFILE_ID) {
      alert('O perfil fundador não pode ser removido.');
      return;
    }

    const confirmed = window.confirm(
      `[MODERAÇÃO DEV] Tem certeza que deseja EXCLUIR permanentemente o perfil @${profile.username} e todas as suas publicações?`
    );
    if (!confirmed) return;

    const { error } = await supabase.from('profiles').delete().eq('id', profile.id);
    if (error) {
      alert('Erro ao remover perfil: ' + error.message);
      return;
    }

    router.push('/');
  }

  // Ação de Moderação: Promover/Rebaixar Moderador
  async function handleToggleModeratorRole() {
    if (!profile || !isStaff) return;
    const nextRole = profile.role === 'moderator' ? 'user' : 'moderator';
    const { error } = await supabase
      .from('profiles')
      .update({ role: nextRole })
      .eq('id', profile.id);

    if (!error) {
      setProfile({ ...profile, role: nextRole as any });
    }
  }

  const canManageProfile = isOwner || isStaff;

  const { visiblePosts, counts } = useMemo(() => {
    let publicTotal = 0;
    let privateTotal = 0;

    const byTopicAndSearch = posts.filter((post) => {
      const vis = resolvePostVisibility(post);
      if (vis === 'private') privateTotal++;
      else publicTotal++;

      if (!canManageProfile && vis === 'private') {
        return false;
      }

      if (activeTab.tag) {
        const hasTopicTag = post.tags?.some(
          (t) => t.toLowerCase() === activeTab.tag!.toLowerCase()
        );
        if (!hasTopicTag) return false;
      }

      if (tagParam) {
        const hasUrlTag = post.tags?.some(
          (t) => t.toLowerCase() === tagParam
        );
        if (!hasUrlTag) return false;
      }

      if (queryFilter) {
        const inContent = post.content?.toLowerCase().includes(queryFilter);
        const inTags = post.tags?.some((t) =>
          t.toLowerCase().includes(queryFilter)
        );
        if (!inContent && !inTags) return false;
      }

      return true;
    });

    const afterVisibilityFilter = byTopicAndSearch.filter((post) => {
      if (!canManageProfile || adminVisibilityFilter === 'all') return true;
      return resolvePostVisibility(post) === adminVisibilityFilter;
    });

    return {
      visiblePosts: afterVisibilityFilter,
      counts: {
        all: publicTotal + privateTotal,
        public: publicTotal,
        private: privateTotal,
      },
    };
  }, [posts, canManageProfile, activeTab.tag, tagParam, queryFilter, adminVisibilityFilter]);

  if (loading) {
    return (
      <div className="w-full min-h-screen bg-background">
        <ProfileAsteriskLoader
          size="lg"
          fullHeight
          label={`Carregando @${decodedUsername}...`}
        />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="p-12 text-center space-y-4">
        <h1 className="text-xl font-extrabold text-primary">
          Perfil @{decodedUsername} não encontrado
        </h1>
        <p className="text-xs text-secondary">
          Este usuário não existe ou teve a conta encerrada pela moderação.
        </p>
        <Link
          href="/"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-accent text-white text-xs font-bold"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Voltar ao Início</span>
        </Link>
      </div>
    );
  }

  return (
    <div className="w-full min-h-screen bg-background">
      {/* Barra Superior de Navegação Rápida */}
      <div className="sticky top-0 z-30 px-4 sm:px-6 py-2.5 bg-background/85 backdrop-blur-md border-b border-border flex items-center justify-between gap-3">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-xs font-bold text-secondary hover:text-primary transition-colors shrink-0"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Explorar Comunidade</span>
        </Link>

        <div className="flex items-center gap-2 min-w-0">
          <span className="text-xs font-mono text-muted truncate">
            @{profile.username}
          </span>
          <ContributorLevelPill
            points={profile.contributor_points}
            totalDonated={profile.total_donated}
            level={profile.contributor_level}
            size="sm"
            showName={false}
          />
        </div>
      </div>

      {/* BARRA EXCLUSIVA DE MODERAÇÃO (Visível para Você e sua Equipe Dev em perfis de terceiros) */}
      {isStaff && !isOwner && (
        <div className="px-4 py-2.5 bg-amber-500/10 border-b border-amber-500/30 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2 text-amber-400 font-bold">
            <ShieldAlert className="w-4 h-4" />
            <span>
              Equipe Dev · Moderação (@{profile.username} · Cargo: {profile.role || 'user'})
            </span>
          </div>

          <div className="flex items-center gap-2">
            {profile.id !== FOUNDER_PROFILE_ID && (
              <>
                <button
                  type="button"
                  onClick={handleToggleModeratorRole}
                  className="px-2.5 py-1 rounded-lg bg-elevated border border-border hover:border-accent text-primary font-semibold flex items-center gap-1 transition-colors"
                >
                  <UserCheck className="w-3.5 h-3.5 text-accent" />
                  <span>
                    {profile.role === 'moderator'
                      ? 'Remover Moderador'
                      : 'Tornar Moderador'}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={handleStaffDeleteProfile}
                  className="px-2.5 py-1 rounded-lg bg-danger/15 border border-danger/40 hover:bg-danger text-danger hover:text-white font-bold flex items-center gap-1 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Banir / Excluir Conta</span>
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* 1. Cabeçalho do Perfil */}
      <ProfileHeader
        profile={profile}
        postsCount={visiblePosts.length}
        isAdmin={canManageProfile}
        onProfileUpdated={loadProfileAndPosts}
      />

      {/* 2. Abas de Tópicos e Workspaces (Isolados por profile.id) */}
      <TopicTabsManager
        activeTabId={activeTab.id}
        onSelectTab={handleSelectTopicTab}
        isAdmin={canManageProfile}
        profileId={profile.id}
      />

      {/* 3. Filtro de Visibilidade (Todos / Públicos / Privados) para o Dono do Perfil */}
      {canManageProfile && (
        <div className="px-4 sm:px-6 py-2.5 border-b border-border bg-surface/30 flex flex-wrap items-center justify-between gap-2">
          <span className="text-[11px] font-bold text-secondary uppercase tracking-wider">
            Visibilidade do Mural
          </span>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setAdminVisibilityFilter('all')}
              className={`px-2.5 py-1 rounded-full text-[11px] font-bold border flex items-center gap-1 transition-colors ${
                adminVisibilityFilter === 'all'
                  ? 'bg-accent text-white border-accent'
                  : 'bg-elevated border-border text-secondary hover:text-primary'
              }`}
            >
              <Layers className="w-3 h-3" />
              <span>Todos ({counts.all})</span>
            </button>

            <button
              type="button"
              onClick={() => setAdminVisibilityFilter('public')}
              className={`px-2.5 py-1 rounded-full text-[11px] font-bold border flex items-center gap-1 transition-colors ${
                adminVisibilityFilter === 'public'
                  ? 'bg-accent text-white border-accent'
                  : 'bg-elevated border-border text-secondary hover:text-primary'
              }`}
            >
              <Globe className="w-3 h-3" />
              <span>Públicos ({counts.public})</span>
            </button>

            <button
              type="button"
              onClick={() => setAdminVisibilityFilter('private')}
              className={`px-2.5 py-1 rounded-full text-[11px] font-bold border flex items-center gap-1 transition-colors ${
                adminVisibilityFilter === 'private'
                  ? 'bg-accent text-white border-accent'
                  : 'bg-elevated border-border text-secondary hover:text-primary'
              }`}
            >
              <Lock className="w-3 h-3" />
              <span>Privados ({counts.private})</span>
            </button>
          </div>
        </div>
      )}

      {/* Aviso de Filtro por URL (?q= ou ?tag=) */}
      {(queryFilter || tagParam) && (
        <div className="px-4 sm:px-6 py-2.5 border-b border-border bg-accent/10 flex items-center justify-between text-xs">
          <span className="text-primary font-medium">
            Filtrando por:{' '}
            <b className="text-accent">
              {tagParam ? `#${tagParam}` : `"${queryFilter}"`}
            </b>
          </span>
          <Link
            href={`/u/${encodeURIComponent(profile.username)}`}
            className="inline-flex items-center gap-1 text-secondary hover:text-primary font-bold"
          >
            <X className="w-3.5 h-3.5" />
            <span>Limpar filtro</span>
          </Link>
        </div>
      )}

      {/* 4. Editor de Blocos (Exibido para o dono do perfil) */}
      {canManageProfile && (
        <PostComposer
          authorId={profile.id}
          isAdmin={canManageProfile}
          defaultTag={activeTab.tag}
          onPostCreated={loadProfileAndPosts}
        />
      )}

      {/* 5. Lista de Publicações com Animação do Asterisco na Troca de Aba */}
      {tabSwitching ? (
        <ProfileAsteriskLoader size="md" color={activeTab.color} />
      ) : visiblePosts.length === 0 ? (
        <div className="py-16 text-center text-xs text-muted">
          Nenhuma publicação encontrada nesta aba.
        </div>
      ) : (
        <div>
          {visiblePosts.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              author={profile}
              isAdmin={canManageProfile}
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

export default function UserProfilePage() {
  return (
    <Suspense
      fallback={
        <div className="w-full min-h-screen bg-background">
          <ProfileAsteriskLoader size="lg" fullHeight label="Carregando perfil..." />
        </div>
      }
    >
      <UserProfileContent />
    </Suspense>
  );
}