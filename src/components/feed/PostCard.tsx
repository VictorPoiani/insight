'use client';

import { useState, useEffect } from 'react';
import { Post, Profile, Reply, FontStyleType } from '@/types/database';
import { createClient } from '@/lib/supabase/client';
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
  const [likes, setLikes] = useState(post.likes_count || 0);
  const [hasLiked, setHasLiked] = useState(false);
  const [reposts, setReposts] = useState(post.reposts_count || 0);
  const [hasReposted, setHasReposted] = useState(false);
  const [repliesCount, setRepliesCount] = useState(post.replies_count || 0);

  // Estados de Edição Inline (Exclusivo Admin)
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(post.content);
  const [savingEdit, setSavingEdit] = useState(false);

  // Estados da Thread de Respostas (Público para todos)
  const [expandReplies, setExpandReplies] = useState(false);
  const [replies, setReplies] = useState<Reply[]>([]);
  const [loadingReplies, setLoadingReplies] = useState(false);
  const [visitorName, setVisitorName] = useState('');
  const [visitorHandle, setVisitorHandle] = useState('');
  const [replyText, setReplyText] = useState('');
  const [replySpotifyInput, setReplySpotifyInput] = useState('');
  const [showReplySpotify, setShowReplySpotify] = useState(false);
  const [sendingReply, setSendingReply] = useState(false);

  // Estados do Gerador de Card para Story
  const [expandShare, setExpandShare] = useState(false);
  const [copied, setCopied] = useState(false);
  const [downloadingStory, setDownloadingStory] = useState(false);

  const supabase = createClient();
  const hasRichBlocks = Array.isArray(post.blocks) && post.blocks.length > 0;

  useEffect(() => {
    const savedName = localStorage.getItem('insight-visitor-name') || '';
    const savedHandle = localStorage.getItem('insight-visitor-handle') || '';
    setVisitorName(savedName);
    setVisitorHandle(savedHandle);
  }, []);

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

  async function handleSaveEdit() {
    if (!editValue.trim() && !post.image_url && !post.spotify_track_id) return;
    setSavingEdit(true);

    const { error } = await supabase
      .from('posts')
      .update({ content: editValue.trim() })
      .eq('id', post.id);

    setSavingEdit(false);
    if (!error) {
      setPostContent(editValue.trim());
      setIsEditing(false);
    } else {
      alert('Erro ao salvar edição: ' + error.message);
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
    if (!confirm('Excluir este post? Essa ação não pode ser desfeita.')) return;
    const { error } = await supabase.from('posts').delete().eq('id', post.id);
    if (!error && onDelete) {
      onDelete(post.id);
    }
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

      const hasImage = Boolean(post.image_url);
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

      if (post.tags && post.tags.length > 0) {
        ctx.fillStyle = '#2563eb';
        ctx.font = 'bold 30px Inter, system-ui, sans-serif';
        ctx.fillText(
          post.tags.map((t) => `#${t}`).join('  '),
          cardX + 56,
          nextY + 10
        );
        nextY += 50;
      }

      if (post.image_url) {
        try {
          const postImg = await loadImage(post.image_url);
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
          // Ignora caso ocorra bloqueio de CORS na imagem
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

      ctx.fillStyle = '#e11d48';
      ctx.font = 'bold 28px Inter, system-ui, sans-serif';
      ctx.fillText(`♥ ${likes}`, cardX + 56, footerY + 50);

      ctx.fillStyle = '#71717a';
      ctx.font = '26px Inter, system-ui, sans-serif';
      ctx.fillText(`💬 ${repliesCount} respostas`, cardX + 160, footerY + 50);

      const stickerW = 460;
      const stickerH = 82;
      const stickerX = (1080 - stickerW) / 2;
      const stickerY = cardY + cardHeight + 55;

      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.roundRect(stickerX, stickerY, stickerW, stickerH, 24);
      ctx.fill();

      ctx.fillStyle = '#2563eb';
      ctx.font = 'bold 30px Inter, system-ui, sans-serif';
      ctx.fillText('🔗', stickerX + 32, stickerY + 52);

      ctx.fillStyle = '#09090b';
      ctx.font = 'bold 28px Inter, system-ui, sans-serif';
      ctx.fillText('INSIGHT* · Ler no blog', stickerX + 85, stickerY + 51);

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
    <article className="p-6 border-b border-border hover:bg-surface/30 transition-colors">
      {post.is_pinned && (
        <div className="flex items-center gap-1.5 text-xs font-semibold text-accent mb-3">
          <Pin className="w-3.5 h-3.5" />
          <span>Insight Fixado</span>
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
              onClick={() => setIsEditing(!isEditing)}
              title="Editar texto resumo"
              className="p-1.5 text-muted hover:text-accent rounded-lg hover:bg-elevated transition-colors"
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

      {/* Conteúdo: Edição Inline, Blocos Estilo Notion ou Post Tradicional */}
      {isEditing ? (
        <div className="mt-4 p-3 rounded-xl bg-elevated border border-border space-y-2">
          <textarea
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            maxLength={2500}
            rows={3}
            className="w-full bg-transparent text-sm text-primary resize-none focus:outline-none"
          />
          <div className="flex items-center justify-between pt-2 border-t border-border">
            <span className="text-[11px] text-muted">{editValue.length}/2500</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setEditValue(postContent);
                  setIsEditing(false);
                }}
                className="px-3 py-1 rounded-lg text-xs text-secondary hover:text-primary"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSaveEdit}
                disabled={savingEdit}
                className="px-3 py-1 rounded-lg bg-accent text-background text-xs font-bold"
              >
                {savingEdit ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      ) : hasRichBlocks ? (
        <div className="notion-content mt-4 space-y-3 text-sm sm:text-base text-primary leading-relaxed">
          {post.blocks!.map((b, idx) => {
            const fontCls = getFontClass(b.fontStyle);
            const alignStyle = { textAlign: b.align || 'left' } as const;

            if (b.type === 'divider') {
              return <hr key={b.id || idx} className="border-border my-3" />;
            }

            if (b.type === 'h1') {
              return (
                <h2
                  key={b.id || idx}
                  style={alignStyle}
                  className={`${fontCls} text-2xl font-extrabold text-primary leading-tight pt-1`}
                  dangerouslySetInnerHTML={{ __html: b.html || '' }}
                />
              );
            }

            if (b.type === 'h2') {
              return (
                <h3
                  key={b.id || idx}
                  style={alignStyle}
                  className={`${fontCls} text-lg font-bold text-primary leading-snug pt-1`}
                  dangerouslySetInnerHTML={{ __html: b.html || '' }}
                />
              );
            }

            if (b.type === 'quote') {
              return (
                <blockquote
                  key={b.id || idx}
                  style={alignStyle}
                  className={`${fontCls} border-l-4 border-accent pl-4 italic text-secondary`}
                  dangerouslySetInnerHTML={{ __html: b.html || '' }}
                />
              );
            }

            if (b.type === 'callout') {
              return (
                <div
                  key={b.id || idx}
                  className="p-3.5 rounded-xl bg-elevated border border-accent/40 flex items-start gap-3"
                >
                  <span className="text-lg shrink-0">{b.calloutIcon || '💡'}</span>
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
                  className="p-3.5 rounded-xl bg-elevated border border-border font-mono text-xs text-primary overflow-x-auto whitespace-pre-wrap"
                  dangerouslySetInnerHTML={{ __html: b.html || '' }}
                />
              );
            }

            if (b.type === 'bullet') {
              return (
                <div key={b.id || idx} className="flex items-start gap-2.5 pl-1">
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
                <figure
                  key={b.id || idx}
                  style={{ width: b.imageWidth || '100%' }}
                  className="mx-auto space-y-1.5 py-1"
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
              );
            }

            if (b.type === 'spotify' && b.spotifyTrackId) {
              return (
                <div key={b.id || idx} className="py-1">
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
                style={alignStyle}
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

          {post.image_url && (
            <div className="mt-4 rounded-xl overflow-hidden border border-border bg-elevated">
              <img
                src={post.image_url}
                alt="Imagem do post"
                className="w-full max-h-96 object-cover"
                loading="lazy"
              />
            </div>
          )}

          {post.spotify_track_id && (
            <div className="mt-4">
              <iframe
                src={`https://open.spotify.com/embed/track/${post.spotify_track_id}?utm_source=generator&theme=0`}
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
      {post.tags && post.tags.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {post.tags.map((tag) => (
            <span
              key={tag}
              className="px-2 py-0.5 rounded bg-elevated border border-border text-[11px] text-accent"
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

      {/* Painel Expansível: Compartilhamento Estilo Story */}
      {expandShare && (
        <div className="mt-4 pt-4 border-t border-border space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-accent">
              Prévia para Stories (Modelo X / Instagram)
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
                {post.tags && post.tags.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-1.5 text-[#2563eb] font-medium">
                    {post.tags.map((t) => (
                      <span key={t}>#{t}</span>
                    ))}
                  </div>
                )}
              </div>

              {post.image_url && (
                <div className="space-y-1">
                  <div className="rounded-xl overflow-hidden border border-zinc-200 max-h-48">
                    <img
                      src={post.image_url}
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
              <span>INSIGHT* · Ler post completo</span>
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
                  <span className="text-accent">Link copiado!</span>
                </>
              ) : (
                <>
                  <Link2 className="w-3.5 h-3.5 text-accent" />
                  <span>Copiar Link do Post</span>
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
                {downloadingStory
                  ? 'Gerando Story...'
                  : 'Baixar Imagem para Story (PNG)'}
              </span>
            </button>
          </div>
        </div>
      )}

      {/* Área Expansível de Respostas / Thread */}
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
                  placeholder="Seu nome (ex: João Silva)"
                  maxLength={40}
                  className="bg-elevated border border-border rounded-lg px-2.5 py-1.5 text-xs text-primary placeholder:text-muted focus:outline-none focus:border-accent"
                />
                <input
                  type="text"
                  value={visitorHandle}
                  onChange={(e) => setVisitorHandle(e.target.value)}
                  placeholder="Seu @arroba (opcional)"
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
                  ? 'Responder como autor ou continuar thread...'
                  : 'Escreva uma resposta para este insight...'
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
                  placeholder="Link da música no Spotify..."
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
                  title="Anexar música do Spotify na resposta"
                  className={`p-1.5 rounded-lg border text-xs transition-colors ${
                    showReplySpotify
                      ? 'border-[#1DB954] text-[#1DB954]'
                      : 'border-border text-secondary hover:text-primary'
                  }`}
                >
                  <Music className="w-3.5 h-3.5" />
                </button>
                <span className="text-[11px] text-muted">{replyText.length}/280</span>
              </div>

              <button
                type="submit"
                disabled={(!replyText.trim() && !replySpotifyInput.trim()) || sendingReply}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent text-background text-xs font-bold disabled:opacity-50"
              >
                <Send className="w-3 h-3" />
                <span>{sendingReply ? 'Enviando...' : 'Responder'}</span>
              </button>
            </div>
          </form>

          {loadingReplies ? (
            <p className="text-xs text-muted py-2">Carregando respostas...</p>
          ) : replies.length === 0 ? (
            <p className="text-xs text-muted py-2">
              Ainda não há respostas. Seja o primeiro a comentar!
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