'use client';

import { showCopyLink } from '@/lib/ui/feedback';
import { ask as confirmDialog } from '@/lib/ui/feedback';
import { notify as toast } from '@/lib/ui/feedback';
import { moderateNow, moderationErrorMessage } from '@/components/moderation/ModerationHost';
import { loginHref } from '@/lib/account/loginRedirect';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, MessagesSquare } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { Post, Profile, Reply } from '@/types/database';
import { PostCard, resolvePostVisibility } from '@/components/feed/PostCard';
import { AsteriskLoader } from '@/components/ui/AsteriskLoader';
import { ReplyComposer, ReplySubmitPayload } from '@/components/replies/ReplyComposer';
import { ReplyCarousel } from '@/components/replies/ReplyCarousel';
import { ReplyThread, AuthorProfiles } from '@/components/replies/ReplyThread';
import { ReplyNode, ReplySort, buildReplyTree } from '@/components/replies/utils';

const FOUNDER_PROFILE_ID = '96d271a9-9102-49b1-b593-9279c5dfe3f4';
const CAROUSEL_SIZE = 10;

const SORT_OPTIONS: { id: ReplySort; label: string }[] = [
  { id: 'top', label: 'Relevantes' },
  { id: 'recent', label: 'Recentes' },
  { id: 'oldest', label: 'Antigas' },
];

export default function PostDiscussionPage() {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const postId = params?.id;

  const [loading, setLoading] = useState(true);
  const [post, setPost] = useState<Post | null>(null);
  const [author, setAuthor] = useState<Profile | null>(null);
  const [loggedUser, setLoggedUser] = useState<Profile | null>(null);
  const [replies, setReplies] = useState<Reply[]>([]);
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set());
  const [authorProfiles, setAuthorProfiles] = useState<AuthorProfiles>({});
  const [sort, setSort] = useState<ReplySort>('top');
  const [activeComposerId, setActiveComposerId] = useState<string | null>(null);
  const [highlightedId, setHighlightedId] = useState<string | null>(null);

  const mainComposerRef = useRef<HTMLTextAreaElement>(null);
  const highlightTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingLikes = useRef<Set<string>>(new Set());

  const isStaff =
    loggedUser?.role === 'admin' ||
    loggedUser?.role === 'moderator' ||
    loggedUser?.id === FOUNDER_PROFILE_ID;
  const canManagePost = Boolean(isStaff || (author && loggedUser?.id === author.id));

  // ==========================================================================
  // CARREGAMENTO
  // ==========================================================================

  const loadAll = useCallback(async () => {
    if (!postId) return;

    const {
      data: { session },
    } = await supabase.auth.getSession();

    let me: Profile | null = null;
    if (session?.user) {
      const { data: prof } = await supabase
        .from('profiles')
        .select('*')
        .or(`user_id.eq.${session.user.id},id.eq.${session.user.id}`)
        .maybeSingle();
      me = (prof as Profile) || null;
    }
    setLoggedUser(me);

    const [{ data: postData }, { data: repliesData }] = await Promise.all([
      supabase.from('posts').select('*').eq('id', postId).maybeSingle(),
      supabase
        .from('replies')
        .select('*')
        .eq('post_id', postId)
        .order('created_at', { ascending: true }),
    ]);

    const typedPost = (postData as Post) || null;
    setPost(typedPost);

    if (typedPost) {
      const ownerId = typedPost.profile_id || typedPost.author_id;
      const { data: authorData } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', ownerId)
        .maybeSingle();
      setAuthor((authorData as Profile) || null);
    }

    const typedReplies = (repliesData as Reply[]) || [];
    setReplies(typedReplies);

    // Perfis atuais dos autores (molduras/títulos do Insight Nitro)
    const authorIds = [
      ...new Set(typedReplies.map((r) => r.profile_id).filter((v): v is string => Boolean(v))),
    ];
    if (authorIds.length > 0) {
      const { data: authorsData } = await supabase
        .from('profiles')
        .select('id, cosmetics')
        .in('id', authorIds);
      const map: AuthorProfiles = {};
      (authorsData || []).forEach((p: { id: string; cosmetics?: Profile['cosmetics'] }) => {
        map[p.id] = p;
      });
      if (me) map[me.id] = me;
      setAuthorProfiles(map);
    } else {
      setAuthorProfiles(me ? { [me.id]: me } : {});
    }

    if (me && typedReplies.length > 0) {
      const { data: likesData } = await supabase
        .from('reply_likes')
        .select('reply_id')
        .eq('profile_id', me.id)
        .in(
          'reply_id',
          typedReplies.map((r) => r.id)
        );
      setLikedIds(new Set((likesData || []).map((l: { reply_id: string }) => l.reply_id)));
    } else {
      setLikedIds(new Set());
    }

    setLoading(false);
  }, [postId, supabase]);

  useEffect(() => {
    loadAll();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => loadAll());
    return () => subscription.unsubscribe();
  }, [loadAll, supabase]);

  // Link direto para uma resposta (?reply=ID ou #reply-ID)
  useEffect(() => {
    if (loading || typeof window === 'undefined') return;
    const fromQuery = new URLSearchParams(window.location.search).get('reply');
    const fromHash = window.location.hash.startsWith('#reply-')
      ? window.location.hash.slice('#reply-'.length)
      : null;
    const target = fromQuery || fromHash;
    if (target) setTimeout(() => focusReply(target), 200);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);

  useEffect(() => () => {
    if (highlightTimer.current) clearTimeout(highlightTimer.current);
  }, []);

  // ==========================================================================
  // DERIVADOS
  // ==========================================================================

  const tree = useMemo(() => buildReplyTree(replies, sort), [replies, sort]);

  const carouselItems = useMemo(() => {
    const roots = buildReplyTree(replies, 'top');
    return [...roots]
      .sort((a, b) => {
        const score = (n: ReplyNode) => (n.likes_count || 0) * 2 + n.descendantsCount;
        return score(b) - score(a);
      })
      .slice(0, CAROUSEL_SIZE);
  }, [replies]);

  // ==========================================================================
  // AÇÕES
  // ==========================================================================

  function focusReply(replyId: string) {
    const el = document.getElementById(`reply-${replyId}`);
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setHighlightedId(replyId);
    if (highlightTimer.current) clearTimeout(highlightTimer.current);
    highlightTimer.current = setTimeout(() => setHighlightedId(null), 2400);
  }

  function requireLogin(): Profile | null {
    if (!loggedUser) {
      router.push(loginHref());
      return null;
    }
    return loggedUser;
  }

  async function notify(recipientId: string | null | undefined, actor: Profile, preview: string) {
    if (!recipientId || recipientId === actor.id || !post) return;
    await supabase.from('notifications').insert({
      recipient_id: recipientId,
      actor_id: actor.id,
      type: 'reply',
      post_id: post.id,
      content_preview: preview.slice(0, 110),
      message: preview.slice(0, 110) || 'respondeu ao seu insight',
    });
  }

  async function submitReply(parent: ReplyNode | null, { blocks, content }: ReplySubmitPayload): Promise<boolean> {
    const me = requireLogin();
    if (!me || !post) return false;

    const payload: Record<string, unknown> = {
      post_id: post.id,
      profile_id: me.id,
      author_name: me.display_name || me.full_name || me.username,
      author_handle: me.username,
      avatar_url: me.avatar_url || '/assets/net/default-perfil',
      content,
      blocks,
      // compatibilidade: primeira faixa/imagem também nas colunas antigas
      spotify_track_id: blocks.find((b) => b.type === 'spotify')?.trackId || null,
      image_url: blocks.find((b) => b.type === 'image')?.url || null,
    };
    if (parent) payload.parent_reply_id = parent.id;

    const { data, error } = await supabase.from('replies').insert(payload).select().single();

    if (error || !data) {
      toast(moderationErrorMessage(error) || 'Erro ao publicar resposta: ' + (error?.message || 'desconhecido'));
      return false;
    }

    let created = { likes_count: 0, ...(data as Reply) };
    setReplies((prev) => [...prev, created]);

    // moderação: resposta só "vale" (e avisa alguém) depois do veredito
    const outcome = await moderateNow('reply', created.id);
    if (outcome) {
      created = { ...created, moderation_status: outcome.status as Reply['moderation_status'], is_nsfw: outcome.isNsfw, moderation_reason: outcome.reason || null };
      setReplies((prev) => prev.map((r) => (r.id === created.id ? { ...r, ...created } : r)));
    }
    const approved = !outcome || outcome.status === 'approved';

    // O dono do post já é notificado pelo trigger notify_on_reply do banco.
    // Aqui notificamos só o autor da resposta respondida (se for outra pessoa).
    if (approved && parent?.profile_id && parent.profile_id !== author?.id) {
      notify(parent.profile_id, me, outcome?.isNsfw ? '[Conteúdo +18]' : content);
    }

    if (!parent) {
      // Nova resposta direta: garante que ela apareça logo e a destaca.
      setTimeout(() => focusReply(created.id), 120);
    }
    return true;
  }

  async function toggleLike(replyId: string) {
    const me = requireLogin();
    if (!me || pendingLikes.current.has(replyId)) return;
    pendingLikes.current.add(replyId);

    const wasLiked = likedIds.has(replyId);
    const applyLocal = (liked: boolean, count?: number) => {
      setLikedIds((prev) => {
        const next = new Set(prev);
        if (liked) next.add(replyId);
        else next.delete(replyId);
        return next;
      });
      setReplies((prev) =>
        prev.map((r) =>
          r.id === replyId
            ? {
                ...r,
                likes_count:
                  count ?? Math.max(0, (r.likes_count || 0) + (liked ? 1 : -1)),
              }
            : r
        )
      );
    };

    applyLocal(!wasLiked);

    try {
      const { data, error } = await supabase.rpc('toggle_reply_like', {
        target_reply_id: replyId,
      });

      if (!error && data) {
        const res = data as { liked: boolean; likes_count: number };
        applyLocal(Boolean(res.liked), Number(res.likes_count) || 0);
        return;
      }

      // Fallback sem a RPC: manipula a tabela diretamente.
      const { error: tableError } = wasLiked
        ? await supabase
            .from('reply_likes')
            .delete()
            .eq('reply_id', replyId)
            .eq('profile_id', me.id)
        : await supabase.from('reply_likes').insert({ reply_id: replyId, profile_id: me.id });

      if (tableError) {
        applyLocal(wasLiked);
        toast('Não foi possível registrar a curtida agora. Tente novamente.');
      }
    } finally {
      pendingLikes.current.delete(replyId);
    }
  }

  function canDelete(node: ReplyNode) {
    return Boolean(
      canManagePost || isStaff || (loggedUser && node.profile_id === loggedUser.id)
    );
  }

  async function deleteReply(node: ReplyNode) {
    if (!canDelete(node)) return;
    const msg =
      node.descendantsCount > 0
        ? `Excluir esta resposta e as ${node.descendantsCount} respostas abaixo dela?`
        : 'Excluir esta resposta?';
    if (!(await confirmDialog({ message: msg }))) return;

    const { error } = await supabase.from('replies').delete().eq('id', node.id);
    if (error) {
      toast('Erro ao excluir: ' + error.message);
      return;
    }

    const removed = new Set<string>();
    const collect = (n: ReplyNode) => {
      removed.add(n.id);
      n.children.forEach(collect);
    };
    collect(node);
    setReplies((prev) => prev.filter((r) => !removed.has(r.id)));
  }

  async function copyReplyLink(replyId: string) {
    const url = `${window.location.origin}/post/${postId}?reply=${replyId}`;
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      void showCopyLink(url, 'Copie o link da resposta');
    }
  }

  function goBack() {
    if (window.history.length > 1) router.back();
    else router.push('/');
  }

  // ==========================================================================
  // RENDER
  // ==========================================================================

  const header = (
    <div className="sticky top-0 z-30 bg-background/85 backdrop-blur-xl border-b border-border px-2 sm:px-4 h-14 flex items-center gap-3">
      <button
        type="button"
        onClick={goBack}
        aria-label="Voltar"
        className="p-2 rounded-full text-primary hover:bg-surface transition-colors"
      >
        <ArrowLeft className="w-5 h-5" />
      </button>
      <div className="leading-tight">
        <h1 className="text-base font-extrabold text-primary">Publicação</h1>
        {!loading && post && (
          <p className="text-[11px] text-muted">
            {replies.length} {replies.length === 1 ? 'resposta' : 'respostas'}
          </p>
        )}
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="w-full">
        {header}
        <AsteriskLoader size="lg" fullHeight label="Carregando discussão..." />
      </div>
    );
  }

  const isHidden =
    post && resolvePostVisibility(post) === 'private' && !canManagePost;

  if (!post || !author || isHidden) {
    return (
      <div className="w-full">
        {header}
        <div className="py-20 px-6 text-center space-y-3">
          <p className="text-sm font-bold text-primary">Insight não encontrado</p>
          <p className="text-xs text-muted">Ela pode ter sido excluída ou ser privada.</p>
          <Link href="/" className="inline-block text-xs font-semibold text-accent hover:underline">
            Voltar para o início
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full pb-24 md:pb-8">
      {header}

      <PostCard
        post={post}
        author={author}
        isAdmin={canManagePost}
        variant="detail"
        repliesCountOverride={replies.length}
        onReplyClick={() => {
          mainComposerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
          mainComposerRef.current?.focus({ preventScroll: true });
          if (!loggedUser) router.push(loginHref());
        }}
        onDelete={() => router.push('/')}
      />

      {/* Carrossel de respostas em destaque */}
      {carouselItems.length >= 2 && (
        <ReplyCarousel
          replies={carouselItems}
          likedIds={likedIds}
          onSelect={focusReply}
          onToggleLike={toggleLike}
          authorProfiles={authorProfiles}
        />
      )}

      {/* Composer principal */}
      <div className="px-4 sm:px-6 py-4 border-b border-border">
        <ReplyComposer
          loggedUser={loggedUser}
          textareaRef={mainComposerRef}
          replyingTo={author.username}
          placeholder="Comente este Insight..."
          submitLabel="Comentar Insight"
          draftScope={`reply:${post.id}:root`}
          onSubmit={(payload) => submitReply(null, payload)}
        />
      </div>

      {/* Discussão */}
      <div className="px-4 sm:px-6 pt-4 pb-2 flex items-center justify-between gap-2 border-b border-border">
        <h2 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-primary">
          <MessagesSquare className="w-3.5 h-3.5 text-accent" />
          <span>Discussão</span>
        </h2>
        <div className="flex items-center gap-1 p-0.5 rounded-full bg-surface border border-border mb-2">
          {SORT_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => setSort(opt.id)}
              className={`px-2.5 py-1 rounded-full text-[11px] font-semibold transition-colors ${
                sort === opt.id ? 'bg-accent text-white' : 'text-secondary hover:text-primary'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {tree.length === 0 ? (
        <div className="py-14 px-6 text-center space-y-1">
          <p className="text-sm font-bold text-primary">Nenhuma resposta ainda</p>
          <p className="text-xs text-muted">Seja a primeira pessoa a comentar.</p>
        </div>
      ) : (
        <ReplyThread
          nodes={tree}
          loggedUser={loggedUser}
          authorProfiles={authorProfiles}
          likedIds={likedIds}
          highlightedId={highlightedId}
          activeComposerId={activeComposerId}
          setActiveComposerId={(id) => {
            if (id && !loggedUser) {
              router.push(loginHref());
              return;
            }
            setActiveComposerId(id);
          }}
          canDelete={canDelete}
          onToggleLike={toggleLike}
          onSubmitReply={(parent, payload) => submitReply(parent, payload)}
          onDelete={deleteReply}
          onCopyLink={copyReplyLink}
        />
      )}
    </div>
  );
}
