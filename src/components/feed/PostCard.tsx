'use client';

import { useState, useEffect } from 'react';
import {
  Post,
  Profile,
  Reply,
  FontStyleType,
  ImageAlignType,
  PostBlock,
  PostVisibility,
} from '@/types/database';
import { createClient } from '@/lib/supabase/client';
import { PostComposer } from './PostComposer';
import {
  MessageCircle,
  Repeat2,
  Heart,
  Share2,
  Trash2,
  Pencil,
  Pin,
  Check,
  Music,
  Send,
  X,
  Download,
  Link2,
  FileText,
  Lock,
  Globe,
  Sparkles,
  Compass,
  Network,
} from 'lucide-react';

interface PostCardProps {
  post: Post;
  author: Profile;
  isAdmin: boolean;
  onDelete?: (postId: string) => void;
}

function extractSpotifyTrackId(urlOrId: string): string | null {
  if (!urlOrId) return null;
  const trimmed = urlOrId.trim();
  if (trimmed.includes('open.spotify.com/track/')) {
    return trimmed.split('track/')[1]?.split('?')[0] || null;
  }
  if (trimmed.includes('spotify:track:')) {
    return trimmed.split('spotify:track:')[1] || null;
  }
  return /^[A-Za-z0-9]{10,30}$/.test(trimmed) ? trimmed : null;
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

function wrapCanvasText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number
): number {
  const paragraphs = text.split('\n');
  let currentY = y;

  for (const paragraph of paragraphs) {
    const words = paragraph.split(' ');
    let line = '';

    for (let n = 0; n < words.length; n++) {
      const testLine = line + words[n] + ' ';
      const metrics = ctx.measureText(testLine);
      if (metrics.width > maxWidth && n > 0) {
        ctx.fillText(line.trim(), x, currentY);
        line = words[n] + ' ';
        currentY += lineHeight;
      } else {
        line = testLine;
      }
    }
    ctx.fillText(line.trim(), x, currentY);
    currentY += lineHeight;
  }
  return currentY;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

export function PostCard({ post, author, isAdmin, onDelete }: PostCardProps) {
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

  const [votedOptions, setVotedOptions] = useState<Record<string, string[]>>({});
  const [votingBlockId, setVotingBlockId] = useState<string | null>(null);

  const [likes, setLikes] = useState(post.likes_count || 0);
  const [hasLiked, setHasLiked] = useState(false);
  const [reposts, setReposts] = useState(post.reposts_count || 0);
  const [hasReposted, setHasReposted] = useState(false);
  const [repliesCount, setRepliesCount] = useState(post.replies_count || 0);

  const [isEditing, setIsEditing] = useState(false);

  const [expandReplies, setExpandReplies] = useState(false);
  const [replies, setReplies] = useState<Reply[]>([]);
  const [loadingReplies, setLoadingReplies] = useState(false);
  const [visitorName, setVisitorName] = useState('');
  const [visitorHandle, setVisitorHandle] = useState('');
  const [replyText, setReplyText] = useState('');
  const [replySpotifyInput, setReplySpotifyInput] = useState('');
  const [showReplySpotify, setShowReplySpotify] = useState(false);
  const [sendingReply, setSendingReply] = useState(false);

  const [expandShare, setExpandShare] = useState(false);
  const [copied, setCopied] = useState(false);
  const [downloadingStory, setDownloadingStory] = useState(false);

  const supabase = createClient();
  const hasRichBlocks = Array.isArray(blocksState) && blocksState.length > 0;

  useEffect(() => {
    const nextBlocks = Array.isArray(post.blocks) ? post.blocks : [];
    setPostContent(post.content);
    setBlocksState(nextBlocks);
    setPostTags(post.tags || []);
    setIsPostPinned(Boolean(post.is_pinned));
    setPostVisibility(resolvePostVisibility(post, nextBlocks));
    setPostImageUrl(post.image_url);
    setPostSpotifyId(post.spotify_track_id || null);
  }, [post]);

  useEffect(() => {
    const savedName = localStorage.getItem('insight-visitor-name') || '';
    const savedHandle = localStorage.getItem('insight-visitor-handle') || '';
    const savedVotesRaw = localStorage.getItem(`insight-votes-${post.id}`);
    setVisitorName(savedName);
    setVisitorHandle(savedHandle);

    if (savedVotesRaw) {
      try {
        const parsedVotes: Record<string, string[]> = JSON.parse(savedVotesRaw);
        setVotedOptions(parsedVotes);

        if (Array.isArray(post.blocks) && post.blocks.length > 0) {
          let needsServerSync = false;
          const repairedBlocks = post.blocks.map((blk) => {
            if (blk.type !== 'poll' || !Array.isArray(blk.pollOptions)) return blk;
            const checkedIds = parsedVotes[blk.id] || [];
            if (checkedIds.length === 0) return blk;

            const updatedOpts = blk.pollOptions.map((opt) => {
              const currentVotes = Number(opt.votes) || 0;
              if (checkedIds.includes(opt.id) && currentVotes === 0) {
                needsServerSync = true;
                return { ...opt, votes: 1 };
              }
              return { ...opt, votes: currentVotes };
            });

            return { ...blk, pollOptions: updatedOpts };
          });

          if (needsServerSync) {
            setBlocksState(repairedBlocks);
            supabase
              .from('posts')
              .update({ blocks: repairedBlocks })
              .eq('id', post.id)
              .then(() => {});
          }
        }
      } catch {
        // ignorar rerros de parse
      }
    }
  }, [post.id, post.blocks, supabase]);

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
              html: postContent.replace(/\n/g, '<br>'),
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
    if (votingBlockId === blockId) return;

    const currentVoted = votedOptions[blockId] || [];
    const alreadyVoted = currentVoted.includes(optionId);

    let nextVotedForBlock: string[];
    if (allowMultiple) {
      nextVotedForBlock = alreadyVoted
        ? currentVoted.filter((id) => id !== optionId)
        : [...currentVoted, optionId];
    } else {
      nextVotedForBlock = alreadyVoted ? [] : [optionId];
    }

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
    localStorage.setItem(`insight-votes-${post.id}`, JSON.stringify(nextVotedMap));

    setVotingBlockId(blockId);
    try {
      const { data: freshPost } = await supabase
        .from('posts')
        .select('blocks')
        .eq('id', post.id)
        .single();

      const baseBlocks =
        freshPost && Array.isArray(freshPost.blocks) && freshPost.blocks.length > 0
          ? (freshPost.blocks as PostBlock[])
          : blocksState;

      const serverUpdatedBlocks = applyVoteDelta(baseBlocks);
      setBlocksState(serverUpdatedBlocks);

      const { error } = await supabase
        .from('posts')
        .update({ blocks: serverUpdatedBlocks })
        .eq('id', post.id);

      if (error) {
        console.error('Erro ao salvar voto no Supabase:', error.message);
      }
    } finally {
      setVotingBlockId(null);
    }
  }

  async function toggleExpandReplies() {
    const nextState = !expandReplies;
    setExpandReplies(nextState);

    if (nextState && replies.length === 0) {
      setLoadingReplies(true);
      const { data } = await supabase
        .from('replies')
        .select('*')
        .eq('post_id', post.id)
        .order('created_at', { ascending: true });

      if (data) {
        setReplies(data as Reply[]);
        setRepliesCount(data.length);
      }
      setLoadingReplies(false);
    }
  }

  async function handleSendReply(e: React.FormEvent) {
    e.preventDefault();
    const trackId = showReplySpotify ? extractSpotifyTrackId(replySpotifyInput) : null;
    if ((!replyText.trim() && !trackId) || sendingReply) return;

    setSendingReply(true);

    const cleanName = isAdmin
      ? author.display_name || author.full_name || 'Victor Poiani'
      : visitorName.trim() || 'Visitante';

    const cleanHandle = isAdmin
      ? author.username || 'poiani'
      : visitorHandle.trim().replace(/^@/, '') || 'leitor';

    if (!isAdmin) {
      localStorage.setItem('insight-visitor-name', cleanName);
      localStorage.setItem('insight-visitor-handle', cleanHandle);
    }

    const payload = {
      post_id: post.id,
      profile_id: isAdmin ? author.id : null,
      author_name: cleanName,
      author_handle: cleanHandle,
      avatar_url: isAdmin ? author.avatar_url || '/assets/net/logo.png' : null,
      content: replyText.trim(),
      spotify_track_id: trackId,
    };

    const { data, error } = await supabase
      .from('replies')
      .insert(payload)
      .select()
      .single();

    setSendingReply(false);

    if (!error && data) {
      const nextCount = repliesCount + 1;
      setReplies((prev) => [...prev, data as Reply]);
      setRepliesCount(nextCount);
      setReplyText('');
      setReplySpotifyInput('');
      setShowReplySpotify(false);

      await supabase
        .from('posts')
        .update({ replies_count: nextCount })
        .eq('id', post.id);
    } else if (error) {
      alert('Erro ao publicar resposta: ' + error.message);
    }
  }

  async function handleDeleteReply(replyId: string) {
    if (!isAdmin) return;
    if (!confirm('Excluir esta resposta?')) return;
    const { error } = await supabase.from('replies').delete().eq('id', replyId);
    if (!error) {
      const nextCount = Math.max(0, repliesCount - 1);
      setReplies((prev) => prev.filter((r) => r.id !== replyId));
      setRepliesCount(nextCount);
      await supabase.from('posts').update({ replies_count: nextCount }).eq('id', post.id);
    }
  }

  async function handleLike() {
    const nextLiked = !hasLiked;
    const nextLikes = nextLiked ? likes + 1 : Math.max(0, likes - 1);
    setHasLiked(nextLiked);
    setLikes(nextLikes);
    await supabase.from('posts').update({ likes_count: nextLikes }).eq('id', post.id);
  }

  async function handleRepost() {
    const nextReposted = !hasReposted;
    const nextReposts = nextReposted ? reposts + 1 : Math.max(0, reposts - 1);
    setHasReposted(nextReposted);
    setReposts(nextReposts);
    await supabase.from('posts').update({ reposts_count: nextReposts }).eq('id', post.id);
  }

  function handleCopyLink() {
    const url = `${window.location.origin}/?post=${post.id}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleDelete() {
    if (!isAdmin) return;
    if (!confirm('Excluir esta publicação? Esta ação não pode ser desfeita.')) return;

    for (const blk of blocksState) {
      if (blk.r2Key) {
        fetch('/api/upload/r2', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ r2Key: blk.r2Key }),
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

  if (!isAdmin && postVisibility === 'private') {
    return null;
  }

  const postDateObj = new Date(post.created_at);
  const formattedDate = postDateObj.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
  const storyTimeDate = `${postDateObj.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  })} · ${postDateObj.toLocaleDateString('pt-BR')}`;

  async function handleDownloadStoryImage() {
    setDownloadingStory(true);
    try {
      const canvas = document.createElement('canvas');
      canvas.width = 1080;
      canvas.height = 1920;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const grad = ctx.createLinearGradient(0, 0, 0, 1920);
      grad.addColorStop(0, '#18181b');
      grad.addColorStop(1, '#09090b');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 1080, 1920);

      const hasImage = Boolean(postImageUrl);
      const cardWidth = 920;
      const cardHeight = hasImage ? 1050 : 640;
      const cardX = (1080 - cardWidth) / 2;
      const cardY = (1920 - cardHeight) / 2 - 60;

      ctx.save();
      ctx.shadowColor = 'rgba(0, 0, 0, 0.45)';
      ctx.shadowBlur = 40;
      ctx.shadowOffsetY = 20;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.roundRect(cardX, cardY, cardWidth, cardHeight, 44);
      ctx.fill();
      ctx.restore();

      const avatarX = cardX + 56;
      const avatarY = cardY + 56;
      try {
        const avatarImg = await loadImage(author.avatar_url || '/assets/net/logo.png');
        ctx.save();
        ctx.beginPath();
        ctx.arc(avatarX + 45, avatarY + 45, 45, 0, Math.PI * 2);
        ctx.closePath();
        ctx.clip();
        ctx.drawImage(avatarImg, avatarX, avatarY, 90, 90);
        ctx.restore();
      } catch {
        ctx.fillStyle = '#2563eb';
        ctx.beginPath();
        ctx.arc(avatarX + 45, avatarY + 45, 45, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.fillStyle = '#09090b';
      ctx.font = 'bold 34px Inter, system-ui, sans-serif';
      ctx.fillText(
        author.display_name || author.full_name || 'Victor Poiani',
        avatarX + 112,
        avatarY + 42
      );

      ctx.fillStyle = '#71717a';
      ctx.font = '28px Inter, system-ui, sans-serif';
      ctx.fillText(`@${author.username || 'poiani'}`, avatarX + 112, avatarY + 80);

      const followX = cardX + cardWidth - 260;
      const followY = avatarY + 18;
      ctx.fillStyle = '#09090b';
      ctx.beginPath();
      ctx.roundRect(followX, followY, 130, 52, 26);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 24px Inter, system-ui, sans-serif';
      ctx.fillText('Seguir', followX + 27, followY + 34);

      ctx.fillStyle = '#09090b';
      ctx.font = '900 44px Inter, system-ui, sans-serif';
      ctx.fillText('I*', cardX + cardWidth - 95, avatarY + 60);

      ctx.fillStyle = '#09090b';
      ctx.font = '34px Inter, system-ui, sans-serif';
      const fullText =
        postContent.slice(0, 280) + (postContent.length > 280 ? '...' : '');
      let nextY = wrapCanvasText(
        ctx,
        fullText,
        cardX + 56,
        avatarY + 150,
        cardWidth - 112,
        46
      );

      if (postTags && postTags.length > 0) {
        ctx.fillStyle = '#2563eb';
        ctx.font = 'bold 30px Inter, system-ui, sans-serif';
        ctx.fillText(
          postTags.map((t) => `#${t}`).join('  '),
          cardX + 56,
          nextY + 10
        );
        nextY += 50;
      }

      if (postImageUrl) {
        try {
          const postImg = await loadImage(postImageUrl);
          const imgX = cardX + 56;
          const imgY = nextY + 15;
          const imgW = cardWidth - 112;
          const imgH = 380;
          ctx.save();
          ctx.beginPath();
          ctx.roundRect(imgX, imgY, imgW, imgH, 28);
          ctx.clip();
          ctx.drawImage(postImg, imgX, imgY, imgW, imgH);
          ctx.restore();
        } catch {
        }
      }

      const footerY = cardY + cardHeight - 95;
      ctx.fillStyle = '#71717a';
      ctx.font = '26px Inter, system-ui, sans-serif';
      ctx.fillText(
        `${storyTimeDate} · ${(post.views_count || 1) + likes * 3} visualizações`,
        cardX + 56,
        footerY
      );

      ctx.fillStyle = '#09090b';
      ctx.font = 'bold 26px Inter, system-ui, sans-serif';
      ctx.fillText(`${likes} curtidas · ${repliesCount} respostas`, cardX + 56, footerY + 48);

      const stickerW = 460;
      const stickerH = 82;
      const stickerX = (1080 - stickerW) / 2;
      const stickerY = cardY + cardHeight + 55;

      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.roundRect(stickerX, stickerY, stickerW, stickerH, 24);
      ctx.fill();

      ctx.fillStyle = '#09090b';
      ctx.font = 'bold 28px Inter, system-ui, sans-serif';
      ctx.fillText('INSIGHT* · Ler publicação', stickerX + 65, stickerY + 51);

      const dataUrl = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.download = `insight-story-${post.id.slice(0, 6)}.png`;
      link.href = dataUrl;
      link.click();
    } finally {
      setDownloadingStory(false);
    }
  }

  return (
    <article
      className={`p-6 border-b border-border transition-colors ${
        postVisibility === 'private'
          ? 'bg-elevated/25 hover:bg-elevated/40'
          : 'hover:bg-surface/30'
      }`}
    >
      {/* Indicadores Superiores: Fixado e/ou Privado */}
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
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <img
            src={author.avatar_url || '/assets/net/logo.png'}
            alt={author.full_name}
            className="w-10 h-10 rounded-full object-cover border border-border bg-elevated"
          />
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-primary">
                {author.display_name || author.full_name}
              </span>
              <span className="text-xs text-muted">@{author.username || 'poiani'}</span>
            </div>
            <time className="text-xs text-muted">{formattedDate}</time>
          </div>
        </div>

        {isAdmin && (
          <div className="flex items-center gap-1">
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
              title={isEditing ? 'Fechar editor' : 'Editar publicação'}
              className={`p-1.5 rounded-lg transition-colors ${
                isEditing
                  ? 'text-accent bg-accent/10'
                  : 'text-muted hover:text-accent hover:bg-elevated'
              }`}
            >
              <Pencil className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={handleDelete}
              title="Excluir publicação"
              className="p-1.5 text-muted hover:text-danger rounded-lg hover:bg-elevated transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/*ediça~ode grade renderizada*/}
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
              setIsEditing(false);
            }}
          />
        </div>
      ) : hasRichBlocks ? (
        <div className="notion-content mt-4 grid grid-cols-12 gap-3 text-sm sm:text-base text-primary leading-relaxed items-start">
          {blocksState.map((b, idx) => {
            const fontCls = getFontClass(b.fontStyle);
            const alignStyle = { textAlign: b.align || 'left' } as const;
            const span = Number(b.gridSpan) || 12;
            const start = Number(b.gridStart) || 0;
            const cellStyle = {
              gridColumn:
                start > 0
                  ? `${start} / span ${Math.min(span, 13 - start)}`
                  : `span ${span} / span ${span}`,
            };

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
                  className={`${fontCls} text-2xl font-extrabold text-primary leading-tight pt-1`}
                  dangerouslySetInnerHTML={{ __html: b.html || '' }}
                />
              );
            }

            if (b.type === 'h2') {
              return (
                <h3
                  key={b.id || idx}
                  style={{ ...cellStyle, ...alignStyle }}
                  className={`${fontCls} text-lg font-bold text-primary leading-snug pt-1`}
                  dangerouslySetInnerHTML={{ __html: b.html || '' }}
                />
              );
            }

            if (b.type === 'quote') {
              return (
                <blockquote
                  key={b.id || idx}
                  style={{ ...cellStyle, ...alignStyle }}
                  className={`${fontCls} border-l-4 border-accent pl-4 italic text-secondary`}
                  dangerouslySetInnerHTML={{ __html: b.html || '' }}
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
                    className={`${fontCls} text-sm text-primary flex-1`}
                    dangerouslySetInnerHTML={{ __html: b.html || '' }}
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
                  dangerouslySetInnerHTML={{ __html: b.html || '' }}
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
                    className={`${fontCls} flex-1`}
                    dangerouslySetInnerHTML={{ __html: b.html || '' }}
                  />
                </div>
              );
            }

            if (b.type === 'image' && b.imageUrl) {
              return (
                <div key={b.id || idx} style={cellStyle} className="w-full py-1">
                  <figure
                    style={{ width: b.imageWidth || '100%' }}
                    className={`${getImageAlignClass(b.imageAlign)} space-y-1.5`}
                  >
                    <img
                      src={b.imageUrl}
                      alt={b.imageCaption || 'Imagem do post'}
                      className="w-full h-auto rounded-xl border border-border object-cover"
                      loading="lazy"
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
                    <div className="relative rounded-xl overflow-hidden border border-border bg-black/90">
                      {isRawGif ? (
                        <img
                          src={b.videoUrl}
                          alt={b.videoCaption || 'GIF do post'}
                          className="w-full h-auto max-h-[520px] object-contain mx-auto"
                          loading="lazy"
                        />
                      ) : (
                        <video
                          src={`${b.videoUrl}#t=0.001`}
                          controls={!isGifMode}
                          autoPlay={isGifMode}
                          loop={isGifMode}
                          muted={isGifMode}
                          playsInline
                          preload="metadata"
                          className="w-full h-auto max-h-[520px] object-contain mx-auto"
                        />
                      )}

                      {isGifMode && (
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
              const edges = Array.isArray(b.mindMapEdges) ? b.mindMapEdges : [];
              return (
                <div
                  key={b.id || idx}
                  style={cellStyle}
                  className="p-3.5 rounded-xl bg-elevated border border-border space-y-2.5"
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-primary uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                      <Network className="w-3.5 h-3.5 text-[#a855f7]" />
                      <span>Arquitetura & Brainstorm 2D</span>
                    </span>
                    <span className="text-[10px] font-mono text-muted">
                      {b.mindMapNodes.length} nós
                    </span>
                  </div>

                  <div
                    style={{
                      backgroundImage:
                        'radial-gradient(rgba(161, 161, 170, 0.16) 1px, transparent 1px)',
                      backgroundSize: '18px 18px',
                    }}
                    className="relative w-full h-[340px] sm:h-[380px] rounded-xl bg-[#09090b] border border-border overflow-hidden"
                  >
                    <svg className="absolute inset-0 w-full h-full pointer-events-none">
                      {edges.map((edge) => {
                        const fromNode = b.mindMapNodes?.find(
                          (n) => n.id === edge.fromId
                        );
                        const toNode = b.mindMapNodes?.find(
                          (n) => n.id === edge.toId
                        );
                        if (!fromNode || !toNode) return null;

                        return (
                          <line
                            key={edge.id}
                            x1={`${fromNode.x}%`}
                            y1={`${fromNode.y}%`}
                            x2={`${toNode.x}%`}
                            y2={`${toNode.y}%`}
                            stroke={fromNode.color || '#52525b'}
                            strokeWidth="1.5"
                            strokeDasharray="4 3"
                            opacity="0.75"
                          />
                        );
                      })}
                    </svg>

                    {b.mindMapNodes.map((node, nIdx) => (
                      <div
                        key={node.id}
                        style={{
                          left: `${node.x}%`,
                          top: `${node.y}%`,
                          transform: 'translate(-50%, -50%)',
                        }}
                        className="absolute z-10 w-40 sm:w-48 p-2.5 rounded-xl bg-[#121215]/95 backdrop-blur border border-zinc-800 shadow-xl space-y-1"
                      >
                        <div className="flex items-center gap-1.5 pb-1 border-b border-zinc-800/80">
                          <span
                            style={{ backgroundColor: node.color || '#2563eb' }}
                            className="w-2 h-2 rounded-full shrink-0"
                          />
                          <span className="text-[9px] font-mono font-semibold text-zinc-400">
                            NÓ · {String(nIdx).padStart(2, '0')}
                          </span>
                        </div>
                        <p className="text-xs font-bold text-zinc-100 leading-snug">
                          {node.label}
                        </p>
                        {node.note && (
                          <p className="text-[10px] text-zinc-400 leading-tight">
                            {node.note}
                          </p>
                        )}
                        {node.mediaUrl && (
                          <div className="mt-1 rounded-lg overflow-hidden border border-zinc-800 bg-black">
                            {/\.(mp4|webm|mov)(\?|$)/i.test(node.mediaUrl) ? (
                              <video
                                src={node.mediaUrl}
                                controls
                                playsInline
                                className="w-full max-h-20 object-contain"
                              />
                            ) : (
                              <img
                                src={node.mediaUrl}
                                alt={node.label}
                                className="w-full max-h-20 object-cover"
                              />
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
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
                  className="p-4 rounded-xl bg-elevated border border-border space-y-3"
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
                          {step.mediaUrl && (
                            <div className="pt-1 rounded-lg overflow-hidden border border-border bg-black">
                              {/\.(mp4|webm|mov)(\?|$)/i.test(step.mediaUrl) ? (
                                <video
                                  src={step.mediaUrl}
                                  controls
                                  playsInline
                                  className="w-full max-h-32 object-contain"
                                />
                              ) : (
                                <img
                                  src={step.mediaUrl}
                                  alt={step.title}
                                  className="w-full max-h-32 object-cover"
                                />
                              )}
                            </div>
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
              const total = Math.max(
                data.reduce((acc, d) => acc + (Number(d.value) || 0), 0),
                1
              );

              return (
                <div
                  key={b.id || idx}
                  style={cellStyle}
                  className="p-4 rounded-xl bg-elevated border border-border space-y-3"
                >
                  {b.chartTitle && (
                    <h4 className="text-xs font-bold text-primary">{b.chartTitle}</h4>
                  )}
                  {(b.chartType || 'vertical') === 'vertical' ? (
                    <div className="h-44 pt-4 px-2 flex items-end justify-around gap-3 border-b border-border">
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
                  ) : (
                    <div className="flex flex-wrap items-center justify-center gap-6 py-2">
                      <svg viewBox="0 0 36 36" className="w-28 h-28 -rotate-90">
                        {(() => {
                          let accum = 0;
                          return data.map((item, i) => {
                            const val = Number(item.value) || 0;
                            const pct = (val / total) * 100;
                            const dash = `${pct} ${100 - pct}`;
                            const offset = 100 - accum;
                            accum += pct;
                            return (
                              <circle
                                key={i}
                                cx="18"
                                cy="18"
                                r="15.915"
                                fill="transparent"
                                stroke={item.color || '#2563eb'}
                                strokeWidth="4.2"
                                strokeDasharray={dash}
                                strokeDashoffset={offset}
                              />
                            );
                          });
                        })()}
                      </svg>
                      <div className="space-y-1">
                        {data.map((item, i) => {
                          const val = Number(item.value) || 0;
                          return (
                            <div key={i} className="flex items-center gap-2 text-xs">
                              <span
                                style={{ backgroundColor: item.color || '#2563eb' }}
                                className="w-2.5 h-2.5 rounded-full shrink-0"
                              />
                              <span className="text-primary font-medium">
                                {item.label}:
                              </span>
                              <span className="text-muted font-mono">
                                {val} ({Math.round((val / total) * 100)}%)
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
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
                  className="p-4 rounded-xl bg-elevated border border-border space-y-3"
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
                    <span className="text-[11px] font-mono text-muted">
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
                          <div className="flex items-center justify-between text-xs">
                            <div className="flex items-center gap-2">
                              <span
                                className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                                  opt.isChecked
                                    ? 'border-accent bg-accent text-white'
                                    : 'border-muted'
                                }`}
                              >
                                {opt.isChecked && <Check className="w-2.5 h-2.5" />}
                              </span>
                              <span className="font-semibold text-primary">
                                {opt.text}
                              </span>
                            </div>
                            <span className="text-[11px] font-mono text-muted">
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
                            rIdx === 0 ? 'bg-elevated font-bold text-primary' : 'bg-surface text-secondary'
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
                dangerouslySetInnerHTML={{ __html: b.html || '' }}
              />
            );
          })}
        </div>
      ) : (
        <>
          {postContent && (
            <div className="mt-4 text-sm text-primary whitespace-pre-line leading-relaxed">
              {postContent}
            </div>
          )}

          {postImageUrl && (
            <div className="mt-4 rounded-xl overflow-hidden border border-border bg-elevated">
              <img
                src={postImageUrl}
                alt="Imagem do post"
                className="w-full max-h-96 object-cover"
                loading="lazy"
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

      {/* Tags */}
      {postTags && postTags.length > 0 && !isEditing && (
        <div className="mt-4 flex flex-wrap gap-2">
          {postTags.map((tag) => (
            <span
              key={tag}
              className="px-2 py-0.5 rounded bg-elevated border border-border font-mono text-[11px] text-accent"
            >
              #{tag}
            </span>
          ))}
        </div>
      )}

      {/* Barra de Ações */}
      <div className="mt-4 pt-3 flex items-center gap-6 text-xs text-secondary">
        <button
          type="button"
          onClick={toggleExpandReplies}
          className={`flex items-center gap-1.5 transition-colors ${
            expandReplies ? 'text-accent font-semibold' : 'hover:text-primary'
          }`}
        >
          <MessageCircle className="w-4 h-4" />
          <span>{repliesCount}</span>
        </button>

        <button
          type="button"
          onClick={handleRepost}
          className={`flex items-center gap-1.5 transition-colors ${
            hasReposted ? 'text-[#1DB954] font-semibold' : 'hover:text-primary'
          }`}
        >
          <Repeat2 className="w-4 h-4" />
          <span>{reposts}</span>
        </button>

        <button
          type="button"
          onClick={handleLike}
          className={`flex items-center gap-1.5 transition-colors ${
            hasLiked ? 'text-accent font-semibold' : 'hover:text-primary'
          }`}
        >
          <Heart className={`w-4 h-4 ${hasLiked ? 'fill-accent text-accent' : ''}`} />
          <span>{likes}</span>
        </button>

        <button
          type="button"
          onClick={() => setExpandShare(!expandShare)}
          className={`flex items-center gap-1.5 transition-colors ${
            expandShare ? 'text-accent font-semibold' : 'hover:text-primary'
          }`}
        >
          <Share2 className="w-4 h-4" />
          <span>Compartilhar</span>
        </button>
      </div>

      {expandShare && (
        <div className="mt-4 pt-4 border-t border-border space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-accent">
              Prévia para Stories
            </span>
            <button
              type="button"
              onClick={() => setExpandShare(false)}
              className="text-muted hover:text-primary"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="bg-[#141417] border border-border rounded-2xl p-6 flex flex-col items-center justify-center space-y-4">
            <div className="w-full max-w-sm bg-white text-zinc-900 rounded-2xl p-4 shadow-2xl space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <img
                    src={author.avatar_url || '/assets/net/logo.png'}
                    alt={author.full_name}
                    className="w-9 h-9 rounded-full object-cover border border-zinc-200"
                  />
                  <div className="leading-tight">
                    <p className="text-xs font-extrabold text-zinc-900">
                      {author.display_name || author.full_name}
                    </p>
                    <p className="text-[11px] text-zinc-500">
                      @{author.username || 'poiani'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-1 rounded-full bg-zinc-900 text-white text-[10px] font-bold">
                    Seguir
                  </span>
                  <span className="text-xs font-black text-zinc-900">
                    Insight<span className="text-[#2563eb]">*</span>
                  </span>
                </div>
              </div>

              <div className="text-xs text-zinc-900 whitespace-pre-line leading-relaxed">
                {postContent}
                {postTags && postTags.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-1.5 text-[#2563eb] font-medium">
                    {postTags.map((t) => (
                      <span key={t}>#{t}</span>
                    ))}
                  </div>
                )}
              </div>

              {postImageUrl && (
                <div className="space-y-1">
                  <div className="rounded-xl overflow-hidden border border-zinc-200 max-h-48">
                    <img
                      src={postImageUrl}
                      alt="Post"
                      className="w-full h-full object-cover max-h-48"
                    />
                  </div>
                  <p className="text-[10px] text-zinc-400">De insight* — Victor Poiani</p>
                </div>
              )}

              <div className="pt-1 border-t border-zinc-100 text-[10px] text-zinc-500 space-y-1.5">
                <p>
                  {storyTimeDate} ·{' '}
                  <strong className="text-zinc-800">
                    {(post.views_count || 1) + likes * 3}
                  </strong>{' '}
                  visualizações
                </p>
                <div className="flex items-center gap-3 text-zinc-600 font-semibold">
                  <span className="flex items-center gap-1">
                    <Heart className="w-3.5 h-3.5 text-rose-500 fill-rose-500" /> {likes}
                  </span>
                  <span className="flex items-center gap-1">
                    <MessageCircle className="w-3.5 h-3.5" /> {repliesCount}
                  </span>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={handleCopyLink}
              className="px-4 py-1.5 rounded-xl bg-white text-zinc-900 shadow-lg flex items-center gap-1.5 text-xs font-extrabold hover:scale-105 transition-transform"
            >
              <Link2 className="w-3.5 h-3.5 text-[#2563eb]" />
              <span>INSIGHT* · Ler publicação</span>
            </button>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2">
            <button
              type="button"
              onClick={handleCopyLink}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-elevated border border-border text-xs font-semibold text-primary hover:border-accent transition-colors"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-accent" />
                  <span className="text-accent">Link copiado</span>
                </>
              ) : (
                <>
                  <Link2 className="w-3.5 h-3.5 text-accent" />
                  <span>Copiar Link</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handleDownloadStoryImage}
              disabled={downloadingStory}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-accent text-background text-xs font-bold hover:bg-accent-hover disabled:opacity-50 transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              <span>
                {downloadingStory ? 'A gerar Story...' : 'Baixar Imagem (PNG)'}
              </span>
            </button>
          </div>
        </div>
      )}

      {/* Área expansível d Thread */}
      {expandReplies && (
        <div className="mt-4 pt-4 border-t border-border space-y-4">
          <form
            onSubmit={handleSendReply}
            className="p-3.5 rounded-xl bg-surface border border-border space-y-2.5"
          >
            {!isAdmin && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pb-2 border-b border-border">
                <input
                  type="text"
                  value={visitorName}
                  onChange={(e) => setVisitorName(e.target.value)}
                  placeholder="Seu nome"
                  maxLength={40}
                  className="bg-elevated border border-border rounded-lg px-2.5 py-1.5 text-xs text-primary placeholder:text-muted focus:outline-none focus:border-accent"
                />
                <input
                  type="text"
                  value={visitorHandle}
                  onChange={(e) => setVisitorHandle(e.target.value)}
                  placeholder="Seu @identificador (opcional)"
                  maxLength={30}
                  className="bg-elevated border border-border rounded-lg px-2.5 py-1.5 text-xs text-primary placeholder:text-muted focus:outline-none focus:border-accent"
                />
              </div>
            )}

            <textarea
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              placeholder={
                isAdmin
                  ? 'Adicionar nota ou continuar thread...'
                  : 'Escrever resposta...'
              }
              maxLength={280}
              rows={2}
              className="w-full bg-transparent text-xs text-primary placeholder:text-muted resize-none focus:outline-none"
            />

            {showReplySpotify && (
              <div className="flex items-center gap-2 p-2 rounded-lg bg-elevated border border-border">
                <Music className="w-3.5 h-3.5 text-[#1DB954] shrink-0" />
                <input
                  type="text"
                  value={replySpotifyInput}
                  onChange={(e) => setReplySpotifyInput(e.target.value)}
                  placeholder="Link da faixa no Spotify..."
                  className="flex-1 bg-transparent text-xs text-primary focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => {
                    setShowReplySpotify(false);
                    setReplySpotifyInput('');
                  }}
                  className="text-muted hover:text-primary"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            <div className="flex items-center justify-between pt-2 border-t border-border">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowReplySpotify(!showReplySpotify)}
                  title="Anexar faixa do Spotify"
                  className={`p-1.5 rounded-lg border text-xs transition-colors ${
                    showReplySpotify
                      ? 'border-[#1DB954] text-[#1DB954]'
                      : 'border-border text-secondary hover:text-primary'
                  }`}
                >
                  <Music className="w-3.5 h-3.5" />
                </button>
                <span className="text-[11px] font-mono text-muted">
                  {replyText.length}/280
                </span>
              </div>

              <button
                type="submit"
                disabled={(!replyText.trim() && !replySpotifyInput.trim()) || sendingReply}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent text-background text-xs font-bold disabled:opacity-50"
              >
                <Send className="w-3 h-3" />
                <span>{sendingReply ? 'A enviar...' : 'Responder'}</span>
              </button>
            </div>
          </form>

          {loadingReplies ? (
            <p className="text-xs text-muted py-2">A carregar respostas...</p>
          ) : replies.length === 0 ? (
            <p className="text-xs text-muted py-2">
              Nenhuma resposta registada.
            </p>
          ) : (
            <div className="space-y-3 pl-3 border-l-2 border-border">
              {replies.map((reply) => (
                <div
                  key={reply.id}
                  className="p-3 rounded-xl bg-surface/60 border border-border space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {reply.avatar_url ? (
                        <img
                          src={reply.avatar_url}
                          alt={reply.author_name || 'Autor'}
                          className="w-6 h-6 rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-6 h-6 rounded-full bg-elevated border border-border flex items-center justify-center text-[10px] font-bold text-accent">
                          {(reply.author_name || 'V').charAt(0).toUpperCase()}
                        </div>
                      )}
                      <span className="text-xs font-bold text-primary">
                        {reply.author_name || 'Visitante'}
                      </span>
                      <span className="text-[11px] text-muted">
                        @{reply.author_handle || 'leitor'}
                      </span>
                    </div>

                    {isAdmin && (
                      <button
                        type="button"
                        onClick={() => handleDeleteReply(reply.id)}
                        title="Excluir resposta"
                        className="text-muted hover:text-danger"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  {reply.content && (
                    <p className="text-xs text-primary whitespace-pre-line leading-relaxed">
                      {reply.content}
                    </p>
                  )}

                  {reply.spotify_track_id && (
                    <iframe
                      src={`https://open.spotify.com/embed/track/${reply.spotify_track_id}?utm_source=generator&theme=0`}
                      width="100%"
                      height="80"
                      frameBorder="0"
                      allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                      loading="lazy"
                      className="rounded-lg"
                    />
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </article>
  );
}