'use client';

import { askReport } from '@/lib/ui/feedback';
import { useMyBlocks, setProfileBlock } from '@/lib/blocks';
import { ask as confirmDialog } from '@/lib/ui/feedback';
import { notify } from '@/lib/ui/feedback';
import { NsfwGate } from '@/components/moderation/NsfwGate';
import { ModerationBanner } from '@/components/moderation/ModerationBanner';
import { moderateNow } from '@/components/moderation/ModerationHost';
import { MediaCarousel } from '@/components/media/MediaCarousel';
import { MediaStrip } from '@/components/media/MediaStrip';
import { linkifyMentionsHtml, sanitizeUserHtml } from '@/lib/security/sanitizeHtml';
import { useNitro } from '@/components/nitro/NitroProvider';
import { getPostFlags, setPostFlag } from '@/lib/postFlags';
import { VideoPlayer } from '@/components/media/VideoPlayer';
import { MindMapViewer } from '@/components/canvas/MindMapViewer';
import { QuotedPostCard, QuoteComposerModal } from './QuotedPost';
import { SpoilerBlock } from './SpoilerBlock';
import { ImageLightbox } from '@/components/media/ImageLightbox';
import { loginHref } from '@/lib/account/loginRedirect';
import { VerifiedBadge } from '@/components/account/VerifiedBadge';
import { useState, useEffect, useRef, useMemo } from 'react';
import Link from 'next/link';
import {
  Post,
  Profile,
  FontStyleType,
  ImageAlignType,
  PostBlock,
  PostVisibility,
} from '@/types/database';
import { createClient } from '@/lib/supabase/client';
import { gridCellStyle } from '@/lib/grid';
import { CosmeticAvatar, CosmeticName, CosmeticTag } from '@/components/nitro/Cosmetics';
import { PostTime } from './PostTime';
import { LikedBy, ReplyPreview, ReactionChips, ReactionButton, HeartBurst } from './PostSocial';
import { ProfileHoverCard } from './ProfileHoverCard';
import { LinkPreview, firstLinkIn } from './LinkPreview';
import {
  getPostSocial,
  patchPostSocial,
  subscribePostSocial,
  setMyReaction,
  type PostSocial,
  type ReactionId,
} from '@/lib/postSocial';
import { PostComposer } from './PostComposer';
import { SharePostModal } from './SharePostModal';
import {
  MessageCircle,
  Repeat2,
  Heart,
  Share2,
  Bookmark,
  Trash2,
  Pencil,
  Pin,
  Check,
  Download,
  FileText,
  Lock,
  Globe,
  Sparkles,
  Compass,
  Network,
  Flag,
  AtSign,
  MoreHorizontal,
  VolumeX,
  Ban,
  Eye,
} from 'lucide-react';

interface PostCardProps {
  post: Post;
  author: Profile;
  isAdmin: boolean;
  onDelete?: (postId: string) => void;
  /** 'feed' (padrão): botão de respostas abre a página da discussão.
   *  'detail': usado dentro da própria página da discussão. */
  variant?: 'feed' | 'detail';
  /** Contagem de respostas controlada externamente (página de discussão). */
  repliesCountOverride?: number;
  /** Ação do botão de respostas no modo 'detail' (ex.: focar o composer). */
  onReplyClick?: () => void;
}

// HTML de usuário passa pelo DOMPurify (lista branca); o filtro por regex anterior era contornável
const sanitizeBlockHtml = (html?: string | null) => linkifyMentionsHtml(sanitizeUserHtml(html));

/** Mídia que pode entrar no carrossel: imagem/vídeo/GIF ocupando a linha toda, sem spoiler. */
function isCarouselMedia(b: PostBlock) {
  const full = !b.gridSpan || b.gridSpan >= 12;
  const media = (b.type === 'image' && Boolean(b.imageUrl)) || ((b.type === 'video' || b.type === 'gif') && Boolean(b.videoUrl));
  return media && full && !b.spoiler;
}

function isBlankText(b: PostBlock) {
  return b.type === 'paragraph' && !b.spoiler && !(b.html || '').replace(/<[^>]*>|&nbsp;|\s/g, '');
}

type BlockRun = { kind: 'block'; block: PostBlock; index: number } | { kind: 'carousel'; blocks: PostBlock[]; start: number };

/** Duas ou mais mídias seguidas viram um carrossel (estilo Instagram). */
function groupMediaRuns(blocks: PostBlock[]): BlockRun[] {
  const out: BlockRun[] = [];
  for (let i = 0; i < blocks.length; ) {
    if (isCarouselMedia(blocks[i])) {
      // junta as mídias seguidas, pulando parágrafos vazios entre elas
      const media: PostBlock[] = [blocks[i]];
      let end = i + 1;
      let k = i + 1;
      while (k < blocks.length) {
        if (isCarouselMedia(blocks[k])) {
          media.push(blocks[k]);
          end = ++k;
        } else if (isBlankText(blocks[k])) {
          k++;
        } else break;
      }
      if (media.length >= 2) {
        out.push({ kind: 'carousel', blocks: media, start: i });
        i = end;
        continue;
      }
    }
    out.push({ kind: 'block', block: blocks[i], index: i });
    i++;
  }
  return out;
}

function getProfileHref(_profileId?: string | null, username?: string | null) {
  if (username) return `/u/${encodeURIComponent(username)}`;
  return '/';
}

function getFontClass(font?: FontStyleType) {
  if (font === 'serif') return 'font-serif tracking-normal';
  if (font === 'mono') return 'font-mono text-[0.92em]';
  return 'font-sans';
}

function getImageAlignClass(align?: ImageAlignType) {
  if (align === 'left') return 'mr-auto';
  if (align === 'right') return 'ml-auto';
  return 'mx-auto';
}

function formatBytes(bytes?: number) {
  if (!bytes) return '';
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  return `${(kb / 1024).toFixed(2)} MB`;
}

export function resolvePostVisibility(
  post: Post,
  blocks?: PostBlock[] | null
): PostVisibility {
  if (post.visibility === 'private') return 'private';
  const targetBlocks = blocks ?? post.blocks;
  if (Array.isArray(targetBlocks) && targetBlocks[0]?.postVisibility === 'private') {
    return 'private';
  }
  return 'public';
}

export function PostCard({
  post,
  author,
  isAdmin,
  onDelete,
  variant = 'feed',
  repliesCountOverride,
  onReplyClick,
}: PostCardProps) {
  const supabase = createClient();
  const articleRef = useRef<HTMLElement>(null);

  const [isHighlightedFromUrl, setIsHighlightedFromUrl] = useState(false);

  // Conteúdo do Post
  const [postContent, setPostContent] = useState(post.content);
  const [blocksState, setBlocksState] = useState<PostBlock[]>(post.blocks || []);
  const [postTags, setPostTags] = useState<string[]>(post.tags || []);
  const [isPostPinned, setIsPostPinned] = useState<boolean>(Boolean(post.is_pinned));
  const [postVisibility, setPostVisibility] = useState<PostVisibility>(() =>
    resolvePostVisibility(post, post.blocks || [])
  );
  const [postImageUrl, setPostImageUrl] = useState<string | null>(post.image_url);
  const [postSpotifyId, setPostSpotifyId] = useState<string | null>(
    post.spotify_track_id || null
  );
  const [editedAt, setEditedAt] = useState<string | null>(post.edited_at || null);

  // Enquetes
  const [votedOptions, setVotedOptions] = useState<Record<string, string[]>>({});
  const [votingBlockId, setVotingBlockId] = useState<string | null>(null);

  // Interações Sociais
  const [likes, setLikes] = useState(post.likes_count || 0);
  const [hasLiked, setHasLiked] = useState(false);
  const [reposts, setReposts] = useState(post.reposts_count || 0);
  const [hasReposted, setHasReposted] = useState(false);
  const [repostMenu, setRepostMenu] = useState(false);
  const [quoteOpen, setQuoteOpen] = useState(false);
  const [repliesCount, setRepliesCount] = useState(post.replies_count || 0);

  // UI & Modais
  const [isEditing, setIsEditing] = useState(false);
  const [openShareModal, setOpenShareModal] = useState(false);

  const [loggedUserProfile, setLoggedUserProfile] = useState<Profile | null>(null);

  const hasRichBlocks = Array.isArray(blocksState) && blocksState.length > 0;

  // Destaca e rola até o post se aberto via link compartilhado (?post=ID)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('post') === post.id) {
      setIsHighlightedFromUrl(true);
      const timer = setTimeout(() => {
        articleRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 250);
      return () => clearTimeout(timer);
    }
  }, [post.id]);

  // Sincroniza quando as props mudam
  useEffect(() => {
    const nextBlocks = Array.isArray(post.blocks) ? post.blocks : [];
    setPostContent(post.content);
    setBlocksState(nextBlocks);
    setPostTags(post.tags || []);
    setIsPostPinned(Boolean(post.is_pinned));
    setPostVisibility(resolvePostVisibility(post, nextBlocks));
    setPostImageUrl(post.image_url);
    setPostSpotifyId(post.spotify_track_id || null);
    setEditedAt(post.edited_at || null);
    setLikes(post.likes_count || 0);
    setReposts(post.reposts_count || 0);
    setRepliesCount(post.replies_count || 0);
  }, [post]);

  // Usuário logado vem do provedor global (uma consulta para o site todo) e
  // curtida/repost são buscados em lote com os outros cartões da tela.
  const { viewer } = useNitro();
  // moderação: status e +18 (atualizados ao vivo quando o veredito chega)
  const [modStatus, setModStatus] = useState(post.moderation_status || 'approved');
  const [isNsfw, setIsNsfw] = useState(Boolean(post.is_nsfw));
  const [modReason, setModReason] = useState(post.moderation_reason || null);
  useEffect(() => {
    setModStatus(post.moderation_status || 'approved');
    setIsNsfw(Boolean(post.is_nsfw));
    setModReason(post.moderation_reason || null);
  }, [post.id, post.moderation_status, post.is_nsfw, post.moderation_reason]);
  useEffect(() => {
    const onUpdate = (e: Event) => {
      const o = (e as CustomEvent<{ entityType?: string; kind?: string; entityId?: string; id?: string; status?: string; verdict?: string; isNsfw?: boolean; reason?: string }>).detail;
      if ((o?.entityType || o?.kind) !== 'post' || (o?.entityId || o?.id) !== post.id) return;
      const st = o.status || (o.verdict === 'BLOCK' ? 'blocked' : o.verdict === 'REVIEW' ? 'review' : 'approved');
      setModStatus(st as typeof modStatus);
      setIsNsfw(Boolean(o.isNsfw ?? o.verdict === 'NSFW'));
      if (o.reason) setModReason(o.reason);
    };
    window.addEventListener('insight-moderation-updated', onUpdate);
    return () => window.removeEventListener('insight-moderation-updated', onUpdate);
  }, [post.id]);
  const isPostOwner = Boolean(viewer && (viewer.id === post.author_id || viewer.id === post.profile_id));
  // o próprio autor ainda pendente: pede o veredito (se o editor não pediu)
  useEffect(() => {
    if (isPostOwner && modStatus === 'pending') {
      const t = setTimeout(() => void moderateNow('post', post.id), 2500);
      return () => clearTimeout(t);
    }
  }, [isPostOwner, modStatus, post.id]);
  const [hasSaved, setHasSaved] = useState(false);
  const [savingPost, setSavingPost] = useState(false);

  // Contexto social (quem curtiu, resposta em destaque, reações) — em lote com os outros cartões
  const [social, setSocial] = useState<PostSocial | null>(null);
  const [likePulse, setLikePulse] = useState(0);
  const [burst, setBurst] = useState(0);
  useEffect(() => {
    let alive = true;
    getPostSocial(post.id, viewer?.id ?? null).then((s) => alive && setSocial(s));
    const off = subscribePostSocial(post.id, (s) => alive && setSocial(s));
    return () => {
      alive = false;
      off();
    };
  }, [post.id, viewer?.id]);

  async function handleReact(r: ReactionId) {
    if (!viewer) {
      window.location.href = loginHref();
      return;
    }
    const prev = social;
    const next: ReactionId | null = social?.myReaction === r ? null : r;
    patchPostSocial(post.id, viewer.id, (s) => {
      const counts = { ...s.reactions };
      if (s.myReaction) counts[s.myReaction] = Math.max(0, (counts[s.myReaction] || 0) - 1);
      if (next) counts[next] = (counts[next] || 0) + 1;
      return { ...s, reactions: counts, myReaction: next };
    });
    const { error } = await setMyReaction(post.id, viewer.id, next);
    if (error && prev) patchPostSocial(post.id, viewer.id, () => prev);
  }

  // Prévia do primeiro link do texto — só quando o post não tem mídia própria
  const previewUrl = useMemo(() => {
    const hasMedia =
      Boolean(postImageUrl) ||
      blocksState.some((b) => ['image', 'video', 'gif', 'carousel', 'spotify', 'mindmap'].includes(b.type));
    if (hasMedia) return null;
    const texts = blocksState.length ? blocksState.map((b) => b.html || '') : [postContent || ''];
    return firstLinkIn(texts);
  }, [blocksState, postContent, postImageUrl]);

  const blocks = useMyBlocks(viewer?.id ?? null);
  const blockKind = !isPostOwner ? blocks.get(author.id) : undefined;
  const [revealBlocked, setRevealBlocked] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);

  // Menciona quem está vendo (e não é o autor)
  const mentionsViewer = useMemo(() => {
    const handle = viewer?.username;
    if (!handle || viewer?.id === author.id) return false;
    const text = [postContent || '', ...blocksState.map((b) => b.html || '')].join(' ');
    const esc = handle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`(^|[^\\w])@${esc}(?![\\w])`, 'i').test(text);
  }, [viewer?.username, viewer?.id, author.id, postContent, blocksState]);

  // Salvar para ler depois (lista privada em "Sua atividade" → Salvos)
  async function handleToggleSave() {
    if (!viewer) {
      window.location.href = '/login';
      return;
    }
    if (savingPost) return;
    const next = !hasSaved;
    setHasSaved(next);
    setSavingPost(true);
    setPostFlag(post.id, viewer.id, { saved: next });
    const supabase = createClient();
    const { error } = next
      ? await supabase.from('post_saves').insert({ post_id: post.id, profile_id: viewer.id })
      : await supabase.from('post_saves').delete().eq('post_id', post.id).eq('profile_id', viewer.id);
    if (error && !/duplicate/i.test(error.message)) {
      setHasSaved(!next);
      setPostFlag(post.id, viewer.id, { saved: !next });
    } else {
      window.dispatchEvent(new CustomEvent('insight-saves-changed'));
    }
    setSavingPost(false);
  }

  useEffect(() => {
    let active = true;
    setLoggedUserProfile(viewer);
    if (!viewer) {
      setHasLiked(false);
      setHasReposted(false);
      setHasSaved(false);
      return;
    }
    getPostFlags(post.id, viewer.id).then((f) => {
      if (!active) return;
      setHasLiked(f.liked);
      setHasReposted(f.reposted);
      setHasSaved(f.saved);
    });
    return () => {
      active = false;
    };
  }, [post.id, viewer]);

  // Carrega votos locais em enquetes
  useEffect(() => {
    try {
      const savedVotesRaw = localStorage.getItem(`insight-votes-${post.id}`);
      if (savedVotesRaw) {
        setVotedOptions(JSON.parse(savedVotesRaw));
      }
    } catch {
      // Ignora erro local
    }
  }, [post.id]);

  // ==========================================================================
  // AÇÕES DO POST (VISIBILIDADE, ENQUETE, CURTIDA, REPOST, DENÚNCIA, EXCLUSÃO)
  // ==========================================================================

  async function handleToggleVisibility() {
    if (!isAdmin) return;
    const nextVis: PostVisibility =
      postVisibility === 'public' ? 'private' : 'public';
    setPostVisibility(nextVis);

    const updatedBlocks: PostBlock[] =
      blocksState.length > 0
        ? blocksState.map((b) => ({ ...b, postVisibility: nextVis }))
        : [
            {
              id: `blk-${Date.now()}`,
              type: 'paragraph',
              html: (postContent || '').replace(/\n/g, '<br>'),
              postVisibility: nextVis,
            },
          ];

    setBlocksState(updatedBlocks);

    const { error } = await supabase
      .from('posts')
      .update({ blocks: updatedBlocks, visibility: nextVis })
      .eq('id', post.id);

    if (error && error.message?.includes('visibility')) {
      await supabase
        .from('posts')
        .update({ blocks: updatedBlocks })
        .eq('id', post.id);
    }
  }

  async function handleVotePoll(
    blockId: string,
    optionId: string,
    allowMultiple?: boolean
  ) {
    if (!loggedUserProfile) {
      window.location.href = loginHref();
      return;
    }
    if (votingBlockId === blockId) return;

    const currentVoted = votedOptions[blockId] || [];
    const alreadyVoted = currentVoted.includes(optionId);

    const nextVotedForBlock = allowMultiple
      ? alreadyVoted
        ? currentVoted.filter((id) => id !== optionId)
        : [...currentVoted, optionId]
      : alreadyVoted
      ? []
      : [optionId];

    const applyVoteDelta = (sourceBlocks: PostBlock[]): PostBlock[] =>
      sourceBlocks.map((b) => {
        if (b.id !== blockId || b.type !== 'poll') return b;
        return {
          ...b,
          pollOptions: (b.pollOptions || []).map((opt) => {
            const baseVotes = Number(opt.votes) || 0;
            const wasSelected = currentVoted.includes(opt.id);
            const isNowSelected = nextVotedForBlock.includes(opt.id);

            let nextVotes = baseVotes;
            if (!wasSelected && isNowSelected) nextVotes = baseVotes + 1;
            if (wasSelected && !isNowSelected) nextVotes = Math.max(0, baseVotes - 1);

            return { ...opt, votes: nextVotes };
          }),
        };
      });

    const optimisticBlocks = applyVoteDelta(blocksState);
    const nextVotedMap = { ...votedOptions, [blockId]: nextVotedForBlock };

    setBlocksState(optimisticBlocks);
    setVotedOptions(nextVotedMap);

    setVotingBlockId(blockId);
    try {
      // O banco registra o voto por pessoa e ajusta a contagem (vote_poll)
      const { data, error } = await supabase.rpc('vote_poll', {
        target_post_id: post.id,
        target_block_id: blockId,
        option_ids: nextVotedForBlock,
      });

      if (error || !data) {
        setBlocksState(blocksState);
        setVotedOptions(votedOptions);
        notify('Não foi possível registrar seu voto. Tente novamente.');
        return;
      }

      const result = data as { blocks: PostBlock[]; selected: string[] };
      const confirmedMap = { ...votedOptions, [blockId]: result.selected || [] };
      if (Array.isArray(result.blocks)) setBlocksState(result.blocks);
      setVotedOptions(confirmedMap);
      try {
        localStorage.setItem(`insight-votes-${post.id}`, JSON.stringify(confirmedMap));
      } catch {
        // Ignora erro de quota
      }
    } finally {
      setVotingBlockId(null);
    }
  }

  async function handleLike() {
    if (!loggedUserProfile) {
      window.location.href = loginHref();
      return;
    }

    const nextLiked = !hasLiked;
    const nextLikes = nextLiked ? likes + 1 : Math.max(0, likes - 1);
    setHasLiked(nextLiked);
    setLikes(nextLikes);
    if (nextLiked) setLikePulse((n) => n + 1);
    const me = loggedUserProfile;
    patchPostSocial(post.id, me.id, (s) => ({
      ...s,
      likers: nextLiked
        ? [
            { id: me.id, username: me.username, name: me.display_name || me.full_name || me.username, avatar_url: me.avatar_url },
            ...s.likers.filter((x) => x.id !== me.id),
          ].slice(0, 3)
        : s.likers.filter((x) => x.id !== me.id),
    }));

    const { data, error } = await supabase.rpc('toggle_post_like', {
      target_post_id: post.id,
    });

    if (!error && data) {
      setHasLiked(Boolean((data as any).liked));
      setLikes(Number((data as any).likes_count) || 0);
      setPostFlag(post.id, loggedUserProfile.id, { liked: Boolean((data as any).liked) });
    } else if (error) {
      // Reverte o otimista: a curtida só é gravada pela RPC toggle_post_like
      setHasLiked(!nextLiked);
      setLikes(likes);
    }
  }

  async function handleRepost() {
    if (!loggedUserProfile) {
      window.location.href = loginHref();
      return;
    }

    const nextReposted = !hasReposted;
    const nextReposts = nextReposted ? reposts + 1 : Math.max(0, reposts - 1);
    setHasReposted(nextReposted);
    setReposts(nextReposts);

    const { data: repostData, error: repostError } = await supabase.rpc('toggle_post_repost', {
      target_post_id: post.id,
    });

    if (repostError || !repostData) {
      setHasReposted(!nextReposted);
      setReposts(reposts);
      return;
    }

    const repostResult = repostData as { reposted: boolean; reposts_count: number };
    setHasReposted(Boolean(repostResult.reposted));
    setPostFlag(post.id, loggedUserProfile.id, { reposted: Boolean(repostResult.reposted) });
    setReposts(Number(repostResult.reposts_count) || 0);

    if (repostResult.reposted && author.id !== loggedUserProfile.id) {
      const snippet = (postContent || '').slice(0, 110);
      await supabase.from('notifications').insert({
        recipient_id: author.id,
        actor_id: loggedUserProfile.id,
        type: 'repost',
        post_id: post.id,
        content_preview: snippet,
        message: snippet || 'repostou seu Insight',
      });
    }
  }

  async function handleBlock(kind: 'mute' | 'block' | null) {
    setMoreOpen(false);
    if (!viewer) {
      window.location.href = loginHref();
      return;
    }
    const handle = `@${author.username}`;
    if (kind === 'block') {
      const ok = await confirmDialog({
        title: `Bloquear ${handle}?`,
        message: 'Os posts dessa conta somem do seu feed, e ela não vai conseguir seguir você, responder nem reagir aos seus posts. Vocês deixam de se seguir.',
        confirmLabel: 'Bloquear',
        danger: true,
      });
      if (!ok) return;
    }
    const done = await setProfileBlock(viewer.id, author.id, kind);
    if (!done) {
      notify('Não foi possível concluir agora. Tente de novo.', 'error');
      return;
    }
    notify(
      kind === 'block' ? `${handle} foi bloqueado.` : kind === 'mute' ? `${handle} foi silenciado. Os posts dessa conta não aparecem mais no seu feed.` : `${handle} voltou a aparecer no seu feed.`,
      'success'
    );
  }

  async function handleTogglePin() {
    if (!isAdmin) return;
    const next = !isPostPinned;
    setIsPostPinned(next);
    const ownerId = post.profile_id || post.author_id;
    // um fixado por perfil: desafixa os outros
    if (next && ownerId) {
      await supabase.from('posts').update({ is_pinned: false }).eq('is_pinned', true).neq('id', post.id).or(`profile_id.eq.${ownerId},author_id.eq.${ownerId}`);
    }
    const { error } = await supabase.from('posts').update({ is_pinned: next }).eq('id', post.id);
    if (error) {
      setIsPostPinned(!next);
      notify('Não foi possível fixar agora.', 'error');
    } else {
      notify(next ? 'Fixado no topo do seu perfil.' : 'Insight desafixado.', 'success');
    }
  }

  async function handleReportPost() {
    setMoreOpen(false);
    if (!loggedUserProfile) {
      window.location.href = loginHref();
      return;
    }

    const reason = await askReport();
    if (!reason || !reason.trim()) return;

    const { error } = await supabase.from('reports').insert({
      reporter_id: loggedUserProfile.id,
      target_post_id: post.id,
      target_profile_id: author.id,
      reason: reason.trim(),
    });

    if (!error) {
      notify('Denúncia enviada para a Equipe de Moderação do Insight.', 'success');
    } else {
      notify('Erro ao enviar denúncia: ' + error.message);
    }
  }

  async function handleDelete() {
    if (!isAdmin) return;
    if (!(await confirmDialog({ message: 'Excluir este Insight? Esta ação não pode ser desfeita.', danger: true }))) return;

    for (const blk of blocksState) {
      const keys = [blk.r2Key, ...(blk.carouselImages || []).map((img) => img.r2Key)].filter(Boolean);
      for (const r2Key of keys) {
        fetch('/api/upload/r2', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ r2Key }),
        }).catch(() => {});
      }
      if (Array.isArray(blk.mindMapNodes)) {
        for (const node of blk.mindMapNodes) {
          if (node.r2Key) {
            fetch('/api/upload/r2', {
              method: 'DELETE',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ r2Key: node.r2Key }),
            }).catch(() => {});
          }
        }
      }
    }

    const { error } = await supabase.from('posts').delete().eq('id', post.id);
    if (!error && onDelete) {
      onDelete(post.id);
    }
  }

  // Imagens do post em tela cheia (na ordem em que aparecem)
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const lightboxImages = useMemo(() => {
    const list: { src: string; alt: string }[] = [];
    for (const x of blocksState) {
      if (x.type === 'image' && x.imageUrl) list.push({ src: x.imageUrl, alt: x.imageCaption || '' });
      if (x.type === 'carousel') for (const img of x.carouselImages || []) if (img.imageUrl) list.push({ src: img.imageUrl, alt: img.caption || '' });
    }
    if (!list.length && postImageUrl) list.push({ src: postImageUrl, alt: '' });
    return list;
  }, [blocksState, postImageUrl]);
  const lastTouchRef = useRef(0);
  const pointerTypeRef = useRef<string>('mouse');
  const lightboxTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const openLightbox = (src: string) => {
    const i = lightboxImages.findIndex((x) => x.src === src);
    const go = () => setLightboxIndex(i >= 0 ? i : 0);
    if (pointerTypeRef.current !== 'touch') return go();
    if (lightboxTimer.current) clearTimeout(lightboxTimer.current);
    lightboxTimer.current = setTimeout(go, 300);
  };
  // duplo toque no conteúdo (celular) = curtir, como no Instagram
  const onContentPointerUp = (e: React.PointerEvent) => {
    pointerTypeRef.current = e.pointerType;
    if (e.pointerType !== 'touch') return;
    // vídeo, botões e links têm toques próprios (ex.: duplo toque no vídeo avança 10 s)
    if ((e.target as HTMLElement).closest('video, button, a, input, iframe, [role="slider"]')) return;
    const now = Date.now();
    if (now - lastTouchRef.current < 300) {
      lastTouchRef.current = 0;
      if (lightboxTimer.current) clearTimeout(lightboxTimer.current);
      setBurst((n) => n + 1);
      if (!hasLiked) void handleLike();
    } else {
      lastTouchRef.current = now;
    }
  };
  useEffect(() => () => {
    if (lightboxTimer.current) clearTimeout(lightboxTimer.current);
  }, []);

  if (!isAdmin && postVisibility === 'private') {
    return null;
  }
  // autor silenciado/bloqueado por quem vê: post recolhido (dá para mostrar)
  if (blockKind && !revealBlocked && variant === 'feed') {
    return (
      <div className="px-4 sm:px-6 py-3 border-b border-border flex items-center justify-between gap-3 text-xs text-muted">
        <span className="flex items-center gap-1.5 min-w-0">
          {blockKind === 'block' ? <Ban className="w-3.5 h-3.5 shrink-0" /> : <VolumeX className="w-3.5 h-3.5 shrink-0" />}
          <span className="truncate">
            Post de @{author.username} · você {blockKind === 'block' ? 'bloqueou' : 'silenciou'} esta conta
          </span>
        </span>
        <button type="button" onClick={() => setRevealBlocked(true)} className="shrink-0 font-semibold text-secondary hover:text-primary">
          Mostrar
        </button>
      </div>
    );
  }

  const displayedRepliesCount = repliesCountOverride ?? repliesCount;

  const authorProfileHref = getProfileHref(author.id, author.username);

  // Renderiza um bloco rico do post (usado no grid e dentro do aviso de spoiler)
  const renderBlock = (b: PostBlock, idx: number): React.ReactNode => {
            const fontCls = getFontClass(b.fontStyle);
            const alignStyle = { textAlign: b.align || 'left' } as const;
            const cellStyle = gridCellStyle(b.gridSpan, b.gridStart, b.blockHeight);

            if (b.type === 'divider') {
              return (
                <div key={b.id || idx} style={cellStyle}>
                  <hr className="border-border my-2" />
                </div>
              );
            }

            if (b.type === 'h1') {
              return (
                <h2
                  key={b.id || idx}
                  style={{ ...cellStyle, ...alignStyle }}
                  className={`${fontCls} text-xl sm:text-2xl font-extrabold text-primary leading-tight pt-1`}
                  dangerouslySetInnerHTML={{ __html: sanitizeBlockHtml(b.html) }}
                />
              );
            }

            if (b.type === 'h2') {
              return (
                <h3
                  key={b.id || idx}
                  style={{ ...cellStyle, ...alignStyle }}
                  className={`${fontCls} text-base sm:text-lg font-bold text-primary leading-snug pt-1`}
                  dangerouslySetInnerHTML={{ __html: sanitizeBlockHtml(b.html) }}
                />
              );
            }

            if (b.type === 'quote') {
              return (
                <blockquote
                  key={b.id || idx}
                  style={{ ...cellStyle, ...alignStyle }}
                  className={`${fontCls} border-l-4 border-accent pl-4 italic text-secondary`}
                  dangerouslySetInnerHTML={{ __html: sanitizeBlockHtml(b.html) }}
                />
              );
            }

            if (b.type === 'callout') {
              return (
                <div
                  key={b.id || idx}
                  style={cellStyle}
                  className="p-3.5 rounded-xl bg-elevated border border-accent/40 flex items-start gap-3"
                >
                  <Sparkles className="w-4 h-4 text-accent shrink-0 mt-1" />
                  <div
                    style={alignStyle}
                    className={`${fontCls} text-sm text-primary flex-1 min-w-0`}
                    dangerouslySetInnerHTML={{ __html: sanitizeBlockHtml(b.html) }}
                  />
                </div>
              );
            }

            if (b.type === 'code') {
              return (
                <pre
                  key={b.id || idx}
                  style={cellStyle}
                  className="p-3.5 rounded-xl bg-elevated border border-border font-mono text-xs text-primary overflow-x-auto whitespace-pre-wrap"
                  dangerouslySetInnerHTML={{ __html: sanitizeUserHtml(b.html) }}
                />
              );
            }

            if (b.type === 'bullet') {
              return (
                <div
                  key={b.id || idx}
                  style={cellStyle}
                  className="flex items-start gap-2.5 pl-1"
                >
                  <span className="text-accent font-bold">•</span>
                  <div
                    style={alignStyle}
                    className={`${fontCls} flex-1 min-w-0`}
                    dangerouslySetInnerHTML={{ __html: sanitizeBlockHtml(b.html) }}
                  />
                </div>
              );
            }

            if (b.type === 'carousel' && Array.isArray(b.carouselImages) && b.carouselImages.length > 0) {
              const imgs = b.carouselImages.filter((img) => img.imageUrl);
              return (
                <div key={b.id || idx} style={{ ...cellStyle, gridColumn: '1 / -1' }} className="min-w-0 py-1">
                  <MediaStrip images={imgs} onOpen={(i) => openLightbox(imgs[i].imageUrl)} />
                </div>
              );
            }

            if (b.type === 'image' && b.imageUrl) {
              // no PC, foto em coluna cheia aparece em até 50% (clicar abre em tamanho real)
              const fullCell = !b.gridSpan || b.gridSpan >= 12;
              return (
                <div key={b.id || idx} style={cellStyle} className="w-full py-1">
                  <figure
                    style={{ width: b.imageWidth || '100%' }}
                    className={`${getImageAlignClass(b.imageAlign)} space-y-1.5 ${fullCell ? 'md:max-w-[50%]' : ''}`}
                  >
                    <img
                      src={b.imageUrl}
                      alt={b.imageCaption || 'Imagem do post'}
                      className="w-full h-auto rounded-xl border border-border object-cover cursor-zoom-in"
                      loading="lazy"
                      onClick={(e) => {
                        e.stopPropagation();
                        openLightbox(b.imageUrl!);
                      }}
                    />
                    {b.imageCaption && (
                      <figcaption className="text-xs text-muted text-center">
                        {b.imageCaption}
                      </figcaption>
                    )}
                  </figure>
                </div>
              );
            }

            if ((b.type === 'video' || b.type === 'gif') && b.videoUrl) {
              const isGifMode = b.type === 'gif' || Boolean(b.isGif);
              const isRawGif =
                /\.(gif|webp)(\?|$)/i.test(b.videoUrl) ||
                b.videoUrl.includes('giphy.com') ||
                b.videoUrl.includes('tenor.com');

              return (
                <div key={b.id || idx} style={cellStyle} className="w-full py-1">
                  <figure
                    style={{ width: b.videoWidth || '100%' }}
                    className={`${getImageAlignClass(b.videoAlign)} space-y-1.5`}
                  >
                    {/* o player ajusta a própria moldura à proporção do vídeo (sem tarjas pretas) */}
                    <div className={`relative ${isRawGif ? 'rounded-xl overflow-hidden border border-border bg-black/90' : ''}`}>
                      {isRawGif ? (
                        <img
                          src={b.videoUrl}
                          alt={b.videoCaption || 'GIF do post'}
                          className="w-full h-auto max-h-[520px] object-contain mx-auto"
                          loading="lazy"
                        />
                      ) : (
                        <VideoPlayer src={b.videoUrl} gif={isGifMode} label={b.videoCaption || 'Vídeo do post'} autoPlayInView={!isGifMode} className="rounded-xl overflow-hidden border border-border" />
                      )}

                      {isGifMode && isRawGif && (
                        <span className="absolute bottom-2.5 left-2.5 px-2 py-0.5 rounded bg-black/75 text-white font-mono text-[10px] font-bold uppercase tracking-wider backdrop-blur-sm">
                          GIF
                        </span>
                      )}
                    </div>

                    {b.videoCaption && (
                      <figcaption className="text-xs text-muted text-center">
                        {b.videoCaption}
                      </figcaption>
                    )}
                  </figure>
                </div>
              );
            }

            if (b.type === 'mindmap' && Array.isArray(b.mindMapNodes)) {
              return (
                <div
                  key={b.id || idx}
                  style={cellStyle}
                  className="p-3 sm:p-3.5 rounded-xl bg-elevated border border-border"
                >
                  <MindMapViewer
                    nodes={b.mindMapNodes.map((n) => ({ ...n, mediaUrl: n.mediaUrl || undefined }))}
                    edges={Array.isArray(b.mindMapEdges) ? b.mindMapEdges : []}
                  />
                </div>
              );
            }

            if (b.type === 'roadmap' && Array.isArray(b.roadmapSteps)) {
              const statusMeta = {
                planned: {
                  label: 'Planeado',
                  dot: '#71717a',
                  cls: 'bg-zinc-500/15 text-zinc-300 border-zinc-500/30',
                },
                in_progress: {
                  label: 'Em andamento',
                  dot: '#38bdf8',
                  cls: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
                },
                completed: {
                  label: 'Concluído',
                  dot: '#10b981',
                  cls: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
                },
              };

              return (
                <div
                  key={b.id || idx}
                  style={cellStyle}
                  className="p-3.5 sm:p-4 rounded-xl bg-elevated border border-border space-y-3"
                >
                  <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-primary">
                    <Compass className="w-3.5 h-3.5 text-[#38bdf8]" />
                    <span>Roadmap & Marcos</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {b.roadmapSteps.map((step) => {
                      const st = statusMeta[step.status] || statusMeta.planned;
                      return (
                        <div
                          key={step.id}
                          className="p-3 rounded-xl bg-surface border border-border space-y-1.5"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-mono text-[10px] font-bold uppercase text-accent">
                              {step.phase}
                            </span>
                            <span
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[9px] font-semibold ${st.cls}`}
                            >
                              <span
                                style={{ backgroundColor: st.dot }}
                                className="w-1.5 h-1.5 rounded-full"
                              />
                              <span>{st.label}</span>
                            </span>
                          </div>
                          <p className="text-xs font-bold text-primary">
                            {step.title}
                          </p>
                          {step.description && (
                            <p className="text-[11px] text-secondary leading-relaxed">
                              {step.description}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            }

            if (b.type === 'chart' && Array.isArray(b.chartData)) {
              const data = b.chartData;
              const maxVal = Math.max(...data.map((d) => Number(d.value) || 0), 1);

              return (
                <div
                  key={b.id || idx}
                  style={cellStyle}
                  className="p-3.5 sm:p-4 rounded-xl bg-elevated border border-border space-y-3 overflow-x-auto"
                >
                  {b.chartTitle && (
                    <h4 className="text-xs font-bold text-primary">{b.chartTitle}</h4>
                  )}
                  <div className="h-44 pt-4 px-2 flex items-end justify-around gap-3 border-b border-border min-w-[260px]">
                    {data.map((item, i) => {
                      const val = Number(item.value) || 0;
                      return (
                        <div
                          key={i}
                          className="flex-1 flex flex-col items-center gap-1 h-full justify-end"
                        >
                          <span className="text-[10px] font-mono font-bold text-primary">
                            {val}
                          </span>
                          <div
                            style={{
                              height: `${Math.max((val / maxVal) * 100, 6)}%`,
                              backgroundColor: item.color || '#2563eb',
                            }}
                            className="w-full max-w-[44px] rounded-t-lg"
                          />
                          <span className="text-[10px] text-muted truncate max-w-[72px]">
                            {item.label}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            }

            if (b.type === 'poll' && Array.isArray(b.pollOptions)) {
              const userSelected = votedOptions[b.id] || [];
              const normalizedOptions = b.pollOptions.map((opt) => {
                const rawVotes = Number(opt.votes) || 0;
                const isChecked = userSelected.includes(opt.id);
                return {
                  ...opt,
                  effectiveVotes: isChecked && rawVotes === 0 ? 1 : rawVotes,
                  isChecked,
                };
              });

              const totalVotes = normalizedOptions.reduce(
                (sum, o) => sum + o.effectiveVotes,
                0
              );

              return (
                <div
                  key={b.id || idx}
                  style={cellStyle}
                  className="p-3.5 sm:p-4 rounded-xl bg-elevated border border-border space-y-3"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-bold text-primary">
                        {b.pollQuestion || 'Enquete'}
                      </p>
                      <p className="text-[11px] text-muted">
                        {b.pollMultiple
                          ? 'Selecione uma ou mais opções'
                          : 'Selecione uma opção'}
                      </p>
                    </div>
                    <span className="text-[11px] font-mono text-muted shrink-0">
                      {totalVotes} {totalVotes === 1 ? 'voto' : 'votos'}
                    </span>
                  </div>

                  <div className="space-y-2">
                    {normalizedOptions.map((opt) => {
                      const votes = opt.effectiveVotes;
                      const pct =
                        totalVotes > 0 ? Math.round((votes / totalVotes) * 100) : 0;

                      return (
                        <button
                          key={opt.id}
                          type="button"
                          disabled={votingBlockId === b.id}
                          onClick={() => handleVotePoll(b.id, opt.id, b.pollMultiple)}
                          className={`w-full text-left p-2.5 rounded-xl border transition-all space-y-1.5 ${
                            opt.isChecked
                              ? 'border-accent bg-accent/10'
                              : 'border-border bg-surface hover:border-accent/50'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2 text-xs">
                            <div className="flex items-center gap-2 min-w-0">
                              <span
                                className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${
                                  opt.isChecked
                                    ? 'border-accent bg-accent text-white'
                                    : 'border-muted'
                                }`}
                              >
                                {opt.isChecked && <Check className="w-2.5 h-2.5" />}
                              </span>
                              <span className="font-semibold text-primary truncate">
                                {opt.text}
                              </span>
                            </div>
                            <span className="text-[11px] font-mono text-muted shrink-0">
                              {votes} ({pct}%)
                            </span>
                          </div>
                          <div className="w-full h-1.5 rounded-full bg-elevated overflow-hidden">
                            <div
                              style={{ width: `${pct}%` }}
                              className="h-full bg-accent transition-all duration-300"
                            />
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            }

            if (b.type === 'file' && b.fileUrl) {
              return (
                <a
                  key={b.id || idx}
                  style={cellStyle}
                  href={b.fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  download={b.fileName}
                  className="flex items-center justify-between gap-3 p-3 rounded-xl bg-elevated border border-border hover:border-accent transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="p-2 rounded-lg bg-accent/10 text-accent shrink-0">
                      <FileText className="w-4 h-4" />
                    </div>
                    <div className="truncate">
                      <p className="text-xs font-bold text-primary truncate">
                        {b.fileName || 'Arquivo anexado'}
                      </p>
                      <p className="text-[10px] font-mono text-muted">
                        {b.fileType || 'ARQUIVO'} · {formatBytes(b.fileSize)}
                      </p>
                    </div>
                  </div>
                  <Download className="w-4 h-4 text-accent shrink-0" />
                </a>
              );
            }

            if (b.type === 'table' && Array.isArray(b.tableData)) {
              return (
                <div
                  key={b.id || idx}
                  style={cellStyle}
                  className="rounded-xl border border-border overflow-x-auto"
                >
                  <table className="w-full border-collapse text-xs">
                    <tbody>
                      {b.tableData.map((row, rIdx) => (
                        <tr
                          key={rIdx}
                          className={
                            rIdx === 0
                              ? 'bg-elevated font-bold text-primary'
                              : 'bg-surface text-secondary'
                          }
                        >
                          {(Array.isArray(row) ? row : []).map((cell, cIdx) => (
                            <td
                              key={cIdx}
                              className="border border-border px-3 py-2 text-left"
                            >
                              {cell}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              );
            }

            if (b.type === 'spotify' && b.spotifyTrackId) {
              return (
                <div key={b.id || idx} style={cellStyle} className="py-1">
                  <iframe
                    src={`https://open.spotify.com/embed/track/${b.spotifyTrackId}?utm_source=generator&theme=0`}
                    width="100%"
                    height="80"
                    frameBorder="0"
                    allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                    loading="lazy"
                    className="rounded-xl"
                  />
                </div>
              );
            }

            return (
              <div
                key={b.id || idx}
                style={{ ...cellStyle, ...alignStyle }}
                className={`${fontCls} leading-relaxed`}
                dangerouslySetInnerHTML={{ __html: sanitizeBlockHtml(b.html) }}
              />
            );
  };

  return (
    <article
      ref={articleRef}
      id={`post-${post.id}`}
      data-post-view={post.id}
      className={`p-4 sm:p-6 border-b border-border transition-all duration-300 ${
        isHighlightedFromUrl
          ? 'bg-accent/[0.07] ring-1 ring-inset ring-accent/40'
          : postVisibility === 'private'
          ? 'bg-elevated/25 hover:bg-elevated/40'
          : 'hover:bg-surface/30'
      }`}
    >
      {/* Indicadores Superiores: Fixado / Privado */}
      {mentionsViewer && (
        <div className="flex items-center gap-1.5 mb-2 text-xs font-medium text-secondary">
          <AtSign className="w-3.5 h-3.5 text-accent" />
          <span>{author.display_name || author.full_name || author.username} mencionou você</span>
        </div>
      )}
      {(isPostPinned || postVisibility === 'private') && (
        <div className="flex flex-wrap items-center gap-2 mb-3">
          {isPostPinned && (
            <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-accent">
              <Pin className="w-3.5 h-3.5" />
              <span>Insight Fixado</span>
            </div>
          )}

          {postVisibility === 'private' && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-elevated border border-border text-secondary font-mono text-[10px] font-semibold uppercase tracking-wider">
              <Lock className="w-3 h-3" />
              <span>Privado · Só para mim</span>
            </span>
          )}
        </div>
      )}

      {/* Cabeçalho do Post */}
      <div className="flex items-center justify-between gap-2 sm:gap-3">
        <ProfileHoverCard profile={author}>
        <Link
          href={authorProfileHref}
          className="flex items-center gap-2.5 sm:gap-3 group/author min-w-0"
        >
          <CosmeticAvatar profile={author} size={40}>
            <img
              src={author.avatar_url || '/assets/net/default-perfil'}
              alt={author.full_name}
              className="w-9 h-9 sm:w-10 sm:h-10 rounded-full object-cover border border-border bg-elevated shrink-0 group-hover/author:border-accent transition-colors"
            />
          </CosmeticAvatar>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 sm:gap-2 truncate">
              <span className="text-sm font-bold text-primary group-hover/author:text-accent transition-colors truncate">
                <CosmeticName profile={author}>{author.display_name || author.full_name}</CosmeticName>
              </span>
              {author.email_verified_at && <VerifiedBadge size={14} />}
              <span className="text-xs text-muted truncate">
                @{author.username || 'insight'}
              </span>
              <span className="hidden sm:inline-flex shrink-0">
                <CosmeticTag profile={author} />
              </span>
            </div>
            <span className="flex items-center gap-1 text-[11px] sm:text-xs text-muted min-w-0">
              <PostTime iso={post.created_at} className="truncate" />
              {editedAt && (
                <span
                  className="shrink-0"
                  title={`Editado em ${new Date(editedAt).toLocaleString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}`}
                >
                  · editado
                </span>
              )}
            </span>
          </div>
        </Link>
        </ProfileHoverCard>

        {isAdmin && (
          <div className="flex items-center gap-0.5 sm:gap-1 shrink-0">
            <button
              type="button"
              onClick={handleToggleVisibility}
              title={
                postVisibility === 'private'
                  ? 'Privado (Só para mim) — Clique para tornar Público'
                  : 'Público — Clique para trancar (Só para mim)'
              }
              className={`p-1.5 rounded-lg transition-colors ${
                postVisibility === 'private'
                  ? 'text-primary bg-elevated border border-border'
                  : 'text-muted hover:text-primary hover:bg-elevated'
              }`}
            >
              {postVisibility === 'private' ? (
                <Lock className="w-4 h-4" />
              ) : (
                <Globe className="w-4 h-4" />
              )}
            </button>

            <button
              type="button"
              onClick={() => setIsEditing(!isEditing)}
              title={isEditing ? 'Fechar editor' : 'Editar Insight'}
              className={`p-1.5 rounded-lg transition-colors ${
                isEditing
                  ? 'text-accent bg-accent/10'
                  : 'text-muted hover:text-accent hover:bg-elevated'
              }`}
            >
              <Pencil className="w-4 h-4" />
            </button>

            {isPostOwner && (
              <button
                type="button"
                onClick={() => void handleTogglePin()}
                title={isPostPinned ? 'Desafixar do perfil' : 'Fixar no topo do perfil'}
                aria-pressed={isPostPinned}
                className={`p-1.5 rounded-lg transition-colors ${
                  isPostPinned ? 'text-accent bg-accent/10' : 'text-muted hover:text-accent hover:bg-elevated'
                }`}
              >
                <Pin className="w-4 h-4" />
              </button>
            )}

            <button
              type="button"
              onClick={handleDelete}
              title="Excluir Insight"
              className="p-1.5 text-muted hover:text-danger rounded-lg hover:bg-elevated transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* Editor Inline ou Conteúdo Renderizado */}
      {isEditing && isAdmin ? (
        <div className="mt-4">
          <PostComposer
            authorId={author.id}
            isAdmin={isAdmin}
            editingPost={{
              ...post,
              content: postContent,
              blocks: blocksState,
              tags: postTags,
              is_pinned: isPostPinned,
              visibility: postVisibility,
              image_url: postImageUrl,
              spotify_track_id: postSpotifyId,
            }}
            onCancelEdit={() => setIsEditing(false)}
            onPostUpdated={(updated) => {
              const nextBlocks = updated.blocks || [];
              setPostContent(updated.content);
              setBlocksState(nextBlocks);
              setPostTags(updated.tags || []);
              setIsPostPinned(Boolean(updated.is_pinned));
              setPostVisibility(resolvePostVisibility(updated, nextBlocks));
              setPostImageUrl(updated.image_url);
              setPostSpotifyId(updated.spotify_track_id || null);
              setEditedAt(updated.edited_at || new Date().toISOString());
              setIsEditing(false);
            }}
          />
        </div>
      ) : (
        <NsfwGate active={isNsfw && !isPostOwner}>
        <div className="relative" onPointerUp={onContentPointerUp}>
        <HeartBurst show={burst} />
        {hasRichBlocks ? (
        <div className="notion-content mt-4 grid grid-cols-12 gap-3 text-sm sm:text-base lg:text-[17px] lg:leading-[1.75] text-primary leading-relaxed items-start break-words">
          {groupMediaRuns(blocksState).map((item) => {
            if (item.kind === 'carousel') {
              return (
                <MediaCarousel
                  key={`car-${item.blocks[0].id || item.start}`}
                  slides={item.blocks.map((m, k) => ({
                    key: m.id || `m-${item.start + k}`,
                    node: renderBlock({ ...m, imageWidth: '100%', videoWidth: '100%', gridSpan: 11, gridStart: 0 }, item.start + k),
                  }))}
                />
              );
            }
            const { block: b, index: idx } = item;
            const rendered = renderBlock(b, idx);
            // o wrapper assume a célula do grid; dentro dele a posição do bloco é ignorada
            return b.spoiler && rendered ? (
              <SpoilerBlock key={`sp-${b.id || idx}`} style={gridCellStyle(b.gridSpan, b.gridStart, b.blockHeight)}>
                {rendered}
              </SpoilerBlock>
            ) : (
              rendered
            );
          })}
        </div>
      ) : (
        <>
          {postContent && (
            <div className="mt-4 text-sm sm:text-base lg:text-[17px] lg:leading-[1.75] text-primary whitespace-pre-line leading-relaxed break-words">
              {postContent}
            </div>
          )}

          {postImageUrl && (
            <div className="mt-4 rounded-xl overflow-hidden border border-border bg-elevated">
              <img
                src={postImageUrl}
                alt="Imagem do post"
                className="w-full max-h-96 object-cover cursor-zoom-in"
                loading="lazy"
                onClick={(e) => {
                  e.stopPropagation();
                  openLightbox(postImageUrl);
                }}
              />
            </div>
          )}

          {postSpotifyId && (
            <div className="mt-4">
              <iframe
                src={`https://open.spotify.com/embed/track/${postSpotifyId}?utm_source=generator&theme=0`}
                width="100%"
                height="80"
                frameBorder="0"
                allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                loading="lazy"
                className="rounded-xl"
              />
            </div>
          )}
        </>
      )}
        </div>
        </NsfwGate>
      )}

      {isPostOwner && !isEditing && isNsfw && modStatus === 'approved' && (
        <p className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-amber-500/40 px-2.5 py-1 text-[11px] font-bold text-amber-500">
          +18 · aparece borrado para os outros
        </p>
      )}
      {isPostOwner && !isEditing && (
        <ModerationBanner kind="post" id={post.id} status={modStatus} reason={modReason} onAppealed={() => setModStatus('appealed')} />
      )}

      {previewUrl && !isEditing && !(isNsfw && !isPostOwner) && <LinkPreview url={previewUrl} />}

      {post.quoted_post_id && !isEditing && <QuotedPostCard postId={post.quoted_post_id} />}

      {/* Hashtags */}
      {postTags && postTags.length > 0 && !isEditing && (
        <div className="mt-4 flex flex-wrap gap-1.5 sm:gap-2">
          {postTags.map((tag) => (
            <Link
              key={tag}
              href={`/?tag=${encodeURIComponent(tag.toLowerCase())}`}
              title={`Ver Insights com #${tag}`}
              className="px-2 py-0.5 rounded bg-elevated border border-border font-mono text-[11px] text-accent hover:border-accent/60 hover:bg-accent/10 transition-colors"
            >
              #{tag}
            </Link>
          ))}
        </div>
      )}

      {social && !isEditing && <ReactionChips social={social} onReact={(r) => void handleReact(r)} />}

      {/* Barra de Ações (Responsiva para Mobile e Desktop) */}
      <div className="mt-4 pt-3 flex items-center justify-between gap-2 text-xs text-secondary">
        <div className="flex items-center gap-5 sm:gap-6">
          {variant === 'detail' ? (
            <button
              type="button"
              onClick={onReplyClick}
              aria-label="Comentar Insight"
              title="Comentar Insight"
              className="flex items-center gap-1.5 py-1 transition-colors hover:text-accent"
            >
              <MessageCircle className="w-4 h-4" />
              <span>{displayedRepliesCount}</span>
            </button>
          ) : (
            <Link
              href={`/post/${post.id}`}
              aria-label="Comentar Insight"
              title="Comentar Insight"
              className="flex items-center gap-1.5 py-1 transition-colors hover:text-accent"
            >
              <MessageCircle className="w-4 h-4" />
              <span>{displayedRepliesCount}</span>
            </Link>
          )}

          <div className="relative">
            <button
              type="button"
              onClick={() => {
                if (!loggedUserProfile) {
                  window.location.href = loginHref();
                  return;
                }
                setRepostMenu((v) => !v);
              }}
              aria-label="Repostar Insight"
              title="Repostar Insight"
              aria-haspopup="menu"
              aria-expanded={repostMenu}
              className={`flex items-center gap-1.5 py-1 transition-colors ${
                hasReposted ? 'text-[#1DB954] font-semibold' : 'hover:text-primary'
              }`}
            >
              <Repeat2 className="w-4 h-4" />
              <span key={reposts} className="insight-count-roll tabular-nums">{reposts}</span>
            </button>
            {repostMenu && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setRepostMenu(false)} />
                <div role="menu" className="absolute bottom-full left-0 mb-2 z-50 w-56 py-1 rounded-xl bg-elevated border border-border shadow-2xl">
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setRepostMenu(false);
                      void handleRepost();
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-primary hover:bg-surface text-left"
                  >
                    <Repeat2 className="w-4 h-4 text-[#1DB954]" />
                    {hasReposted ? 'Desfazer repost' : 'Repostar Insight'}
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setRepostMenu(false);
                      setQuoteOpen(true);
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-primary hover:bg-surface text-left"
                  >
                    <MessageCircle className="w-4 h-4 text-accent" />
                    Repostar com comentário
                  </button>
                </div>
              </>
            )}
          </div>

          <button
            type="button"
            onClick={handleLike}
            aria-label="Curtir Insight"
            title="Curtir Insight"
            className={`flex items-center gap-1.5 py-1 transition-colors ${
              hasLiked ? 'text-accent font-semibold' : 'hover:text-primary'
            }`}
          >
            <Heart key={likePulse} className={`w-4 h-4 ${hasLiked ? 'fill-accent text-accent' : ''} ${likePulse ? 'insight-like-pop' : ''}`} />
            <span key={likes} className="insight-count-roll tabular-nums">{likes}</span>
          </button>

          <ReactionButton mine={social?.myReaction ?? null} onReact={(r) => void handleReact(r)} />

          <button
            type="button"
            onClick={() => setOpenShareModal(true)}
            aria-label="Compartilhar Insight"
            className={`flex items-center gap-1.5 py-1 transition-colors ${
              openShareModal ? 'text-accent font-semibold' : 'hover:text-primary'
            }`}
          >
            <Share2 className="w-4 h-4" />
            <span className="hidden sm:inline">Compartilhar</span>
          </button>

          <button
            type="button"
            onClick={handleToggleSave}
            aria-pressed={hasSaved}
            aria-label={hasSaved ? 'Remover dos salvos' : 'Salvar Insight'}
            title={hasSaved ? 'Remover dos salvos' : 'Salvar para ler depois'}
            className={`flex items-center gap-1.5 py-1 transition-colors ${hasSaved ? 'text-accent font-semibold' : 'hover:text-primary'}`}
          >
            <Bookmark className={`w-4 h-4 ${hasSaved ? 'fill-accent text-accent' : ''}`} />
            <span className="hidden sm:inline">{hasSaved ? 'Salvo' : 'Salvar'}</span>
          </button>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {(post.views_count || 0) > 0 && (
            <span
              className="flex items-center gap-1 text-muted tabular-nums"
              title={`${post.views_count} ${post.views_count === 1 ? 'pessoa viu' : 'pessoas viram'} este Insight`}
            >
              <Eye className="w-3.5 h-3.5" />
              {post.views_count}
            </span>
          )}
          {!isPostOwner && (
            <div className="relative">
              <button
                type="button"
                onClick={() => setMoreOpen((v) => !v)}
                title="Mais opções"
                aria-label="Mais opções"
                aria-haspopup="menu"
                aria-expanded={moreOpen}
                className="p-1.5 rounded-lg text-muted hover:text-primary hover:bg-elevated transition-colors"
              >
                <MoreHorizontal className="w-4 h-4" />
              </button>
              {moreOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setMoreOpen(false)} />
                  <div role="menu" className="absolute bottom-full right-0 mb-2 z-50 w-60 py-1 rounded-xl bg-elevated border border-border shadow-2xl">
                    <button type="button" role="menuitem" onClick={() => void handleBlock(blockKind === 'mute' ? null : 'mute')} className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-primary hover:bg-surface text-left">
                      <VolumeX className="w-4 h-4 text-secondary" />
                      {blockKind === 'mute' ? `Deixar de silenciar @${author.username}` : `Silenciar @${author.username}`}
                    </button>
                    <button type="button" role="menuitem" onClick={() => void handleBlock(blockKind === 'block' ? null : 'block')} className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-primary hover:bg-surface text-left">
                      <Ban className="w-4 h-4 text-secondary" />
                      {blockKind === 'block' ? `Desbloquear @${author.username}` : `Bloquear @${author.username}`}
                    </button>
                    <div className="my-1 border-t border-border" />
                    <button type="button" role="menuitem" onClick={() => void handleReportPost()} className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-danger hover:bg-surface text-left">
                      <Flag className="w-4 h-4" />
                      Denunciar à moderação
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {social && !isEditing && (
        <LikedBy likers={social.likers} total={likes} viewerLiked={hasLiked} />
      )}
      {social?.topReply && variant === 'feed' && !isEditing && (
        <ReplyPreview reply={social.topReply} total={displayedRepliesCount} postId={post.id} />
      )}

      {/* Modal Insight* Share Studio */}
      {lightboxIndex !== null && lightboxImages.length > 0 && (
        <ImageLightbox
          images={lightboxImages}
          index={Math.min(lightboxIndex, lightboxImages.length - 1)}
          onIndexChange={setLightboxIndex}
          onClose={() => setLightboxIndex(null)}
        />
      )}

      {quoteOpen && loggedUserProfile && (
        <QuoteComposerModal
          post={post}
          author={author}
          me={loggedUserProfile}
          onClose={() => setQuoteOpen(false)}
          onPublished={() => setReposts((r) => r + 1)}
        />
      )}

      <SharePostModal
        isOpen={openShareModal}
        onClose={() => setOpenShareModal(false)}
        post={{
          ...post,
          content: postContent,
          blocks: blocksState,
          tags: postTags,
          image_url: postImageUrl,
        }}
        author={author}
      />

    </article>
  );
}