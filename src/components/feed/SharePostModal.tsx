'use client';

import { useState, useMemo } from 'react';
import { Post, Profile } from '@/types/database';
import {
  X,
  Link2,
  Check,
  Copy,
  Share2,
  Sparkles,
  ShieldCheck,
  MessageCircle,
  Send,
  Quote,
  Smartphone,
} from 'lucide-react';

interface SharePostModalProps {
  isOpen: boolean;
  onClose: () => void;
  post: Post;
  author: Profile;
}

type CardThemeId = 'obsidian' | 'blueprint' | 'editorial';

interface CardThemeConfig {
  id: CardThemeId;
  label: string;
  bgStart: string;
  bgEnd: string;
  border: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  accent: string;
  badgeBg: string;
}

const CARD_THEMES: Record<CardThemeId, CardThemeConfig> = {
  obsidian: {
    id: 'obsidian',
    label: 'Obsidian',
    bgStart: '#111318',
    bgEnd: '#09090b',
    border: '#27272a',
    textPrimary: '#f4f4f5',
    textSecondary: '#d4d4d8',
    textMuted: '#71717a',
    accent: '#3898ec',
    badgeBg: 'rgba(56, 152, 236, 0.14)',
  },
  blueprint: {
    id: 'blueprint',
    label: 'Blueprint *',
    bgStart: '#0c192c',
    bgEnd: '#070b14',
    border: '#1e3a5f',
    textPrimary: '#f8fafc',
    textSecondary: '#cbd5e1',
    textMuted: '#64748b',
    accent: '#38bdf8',
    badgeBg: 'rgba(56, 189, 248, 0.16)',
  },
  editorial: {
    id: 'editorial',
    label: 'Editorial',
    bgStart: '#ffffff',
    bgEnd: '#f4f7fb',
    border: '#cbd5e1',
    textPrimary: '#0f172a',
    textSecondary: '#334155',
    textMuted: '#64748b',
    accent: '#2563eb',
    badgeBg: 'rgba(37, 99, 235, 0.10)',
  },
};

function stripHtmlToCleanText(html?: string | null): string {
  if (!html) return '';
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .trim();
}

function loadCorsImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function wrapStickerText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  maxLines = 7
): number {
  const paragraphs = text.split('\n');
  let currentY = y;
  let linesDrawn = 0;

  for (const paragraph of paragraphs) {
    const words = paragraph.split(' ');
    let line = '';

    for (let n = 0; n < words.length; n++) {
      const testLine = line + words[n] + ' ';
      const metrics = ctx.measureText(testLine);
      if (metrics.width > maxWidth && n > 0) {
        linesDrawn++;
        if (linesDrawn >= maxLines) {
          ctx.fillText(line.trim() + '...', x, currentY);
          return currentY + lineHeight;
        }
        ctx.fillText(line.trim(), x, currentY);
        line = words[n] + ' ';
        currentY += lineHeight;
      } else {
        line = testLine;
      }
    }
    if (line.trim()) {
      linesDrawn++;
      if (linesDrawn >= maxLines) {
        ctx.fillText(line.trim(), x, currentY);
        return currentY + lineHeight;
      }
      ctx.fillText(line.trim(), x, currentY);
      currentY += lineHeight;
    }
  }
  return currentY;
}

export function SharePostModal({
  isOpen,
  onClose,
  post,
  author,
}: SharePostModalProps) {
  const [cardTheme, setCardTheme] = useState<CardThemeId>('blueprint');
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedSticker, setCopiedSticker] = useState(false);
  const [copiedQuote, setCopiedQuote] = useState(false);
  const [sharingNative, setSharingNative] = useState(false);

  const activeTheme = CARD_THEMES[cardTheme];

  // Extrai texto limpo mesmo quando o post usa blocos ricos estilo Notion
  const cleanSummary = useMemo(() => {
    if (post.content && post.content.trim()) {
      return post.content.trim();
    }
    if (Array.isArray(post.blocks) && post.blocks.length > 0) {
      return post.blocks
        .map((b) => stripHtmlToCleanText(b.html))
        .filter(Boolean)
        .join('\n\n');
    }
    return 'Confira esta publicação no Insight*';
  }, [post]);

  const shareUrl = useMemo(() => {
    if (typeof window === 'undefined') return '';
    return `${window.location.origin}/u/${encodeURIComponent(
      author.username
    )}?post=${post.id}`;
  }, [author.username, post.id]);

  const formattedDate = useMemo(() => {
    const d = new Date(post.created_at);
    return d.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  }, [post.created_at]);

  if (!isOpen) return null;

  /**
   * Gera em memória um Sticker de alta definição com cantos externos 100% transparentes
   * (pronto para ser colado como figurinha nos Stories ou enviado via navigator.share)
   */
  async function generateStickerBlob(): Promise<Blob | null> {
    const canvas = document.createElement('canvas');
    const width = 960;
    const height = 620;
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    // Fundo externo 100% transparente para funcionar como Sticker nos Stories
    ctx.clearRect(0, 0, width, height);

    const pad = 24;
    const cardW = width - pad * 2;
    const cardH = height - pad * 2;

    // Sombra suave do adesivo
    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.35)';
    ctx.shadowBlur = 32;
    ctx.shadowOffsetY = 12;

    const grad = ctx.createLinearGradient(pad, pad, width - pad, height - pad);
    grad.addColorStop(0, activeTheme.bgStart);
    grad.addColorStop(1, activeTheme.bgEnd);
    ctx.fillStyle = grad;

    ctx.beginPath();
    ctx.roundRect(pad, pad, cardW, cardH, 40);
    ctx.fill();
    ctx.restore();

    // Borda fina do Sticker
    ctx.save();
    ctx.strokeStyle = activeTheme.border;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.roundRect(pad, pad, cardW, cardH, 40);
    ctx.stroke();
    ctx.restore();

    // Marca d'água geométrica do Asterisco de 8 pontas (*) no canto direito
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(pad, pad, cardW, cardH, 40);
    ctx.clip();
    ctx.translate(width - 130, pad + 135);
    ctx.rotate(0.28);
    ctx.fillStyle = activeTheme.accent;
    ctx.globalAlpha = cardTheme === 'editorial' ? 0.08 : 0.11;
    for (const angle of [0, 45, 90, 135]) {
      ctx.save();
      ctx.rotate((angle * Math.PI) / 180);
      ctx.beginPath();
      ctx.roundRect(-18, -110, 36, 220, 8);
      ctx.fill();
      ctx.restore();
    }
    ctx.restore();

    // Avatar do autor
    const innerX = pad + 52;
    const innerY = pad + 48;
    try {
      const avatarImg = await loadCorsImage(
        author.avatar_url || '/assets/net/default-perfil'
      );
      ctx.save();
      ctx.beginPath();
      ctx.arc(innerX + 38, innerY + 38, 38, 0, Math.PI * 2);
      ctx.closePath();
      ctx.clip();
      ctx.drawImage(avatarImg, innerX, innerY, 76, 76);
      ctx.restore();
    } catch {
      ctx.fillStyle = activeTheme.accent;
      ctx.beginPath();
      ctx.arc(innerX + 38, innerY + 38, 38, 0, Math.PI * 2);
      ctx.fill();
    }

    // Nome + @username
    ctx.fillStyle = activeTheme.textPrimary;
    ctx.font = '800 30px Inter, system-ui, sans-serif';
    ctx.fillText(
      author.display_name || author.full_name || author.username,
      innerX + 94,
      innerY + 34
    );

    ctx.fillStyle = activeTheme.textMuted;
    ctx.font = '500 23px Inter, system-ui, sans-serif';
    ctx.fillText(
      `@${author.username}${author.nickname ? ` · ${author.nickname}` : ''}`,
      innerX + 94,
      innerY + 66
    );

    // Selo Insight* no topo direito
    ctx.fillStyle = activeTheme.textPrimary;
    ctx.font = '900 32px Inter, system-ui, sans-serif';
    ctx.fillText('Insight', width - pad - 165, innerY + 42);
    ctx.fillStyle = activeTheme.accent;
    ctx.fillText('*', width - pad - 60, innerY + 42);

    // Texto principal do Post
    ctx.fillStyle = activeTheme.textPrimary;
    ctx.font = '500 30px Inter, system-ui, sans-serif';
    const excerpt =
      cleanSummary.length > 260
        ? cleanSummary.slice(0, 260) + '...'
        : cleanSummary;

    const afterTextY = wrapStickerText(
      ctx,
      excerpt,
      innerX,
      innerY + 132,
      cardW - 104,
      43,
      6
    );

    // Hashtags
    if (Array.isArray(post.tags) && post.tags.length > 0) {
      ctx.fillStyle = activeTheme.accent;
      ctx.font = '700 22px monospace';
      ctx.fillText(
        post.tags
          .slice(0, 4)
          .map((t) => `#${t}`)
          .join('   '),
        innerX,
        Math.min(afterTextY + 14, height - pad - 88)
      );
    }

    // Rodapé do Sticker com endereço do perfil
    const footerY = height - pad - 38;
    ctx.fillStyle = activeTheme.textMuted;
    ctx.font = '600 20px Inter, system-ui, sans-serif';
    ctx.fillText(`${formattedDate}`, innerX, footerY);

    ctx.fillStyle = activeTheme.accent;
    ctx.font = '700 20px monospace';
    const domainTag = `insight · /u/${author.username}`;
    const domainWidth = ctx.measureText(domainTag).width;
    ctx.fillText(domainTag, width - pad - 52 - domainWidth, footerY);

    return new Promise((resolve) => {
      canvas.toBlob((blob) => resolve(blob), 'image/png');
    });
  }

  function handleCopyLink() {
    navigator.clipboard.writeText(shareUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2200);
  }

  async function handleCopyStickerToClipboard() {
    try {
      const blob = await generateStickerBlob();
      if (blob && typeof ClipboardItem !== 'undefined') {
        await navigator.clipboard.write([
          new ClipboardItem({ 'image/png': blob }),
        ]);
        setCopiedSticker(true);
        setTimeout(() => setCopiedSticker(false), 2800);
        return;
      }
      handleCopyLink();
    } catch {
      handleCopyLink();
    }
  }

  async function handleNativeShare() {
    setSharingNative(true);
    try {
      const shareText = `"${cleanSummary.slice(0, 140)}${
        cleanSummary.length > 140 ? '...' : ''
      }" — @${author.username} no Insight*`;

      if (typeof navigator !== 'undefined' && navigator.share) {
        const blob = await generateStickerBlob();
        if (blob) {
          const file = new File([blob], 'insight-card.png', {
            type: 'image/png',
          });
          if (navigator.canShare && navigator.canShare({ files: [file] })) {
            await navigator.share({
              title: `${author.display_name || author.full_name} no Insight*`,
              text: shareText,
              url: shareUrl,
              files: [file],
            });
            setSharingNative(false);
            return;
          }
        }

        await navigator.share({
          title: `${author.display_name || author.full_name} no Insight*`,
          text: shareText,
          url: shareUrl,
        });
      } else {
        await handleCopyStickerToClipboard();
      }
    } catch {
      // Usuário cancelou a gaveta nativa
    } finally {
      setSharingNative(false);
    }
  }

  function handleCopyMarkdownQuote() {
    const md = `> "${cleanSummary.replace(/\n/g, ' ')}"\n> — **${
      author.display_name || author.full_name
    }** (@${author.username}) no [Insight*](${shareUrl})`;
    navigator.clipboard.writeText(md);
    setCopiedQuote(true);
    setTimeout(() => setCopiedQuote(false), 2200);
  }

  const encodedText = encodeURIComponent(
    `"${cleanSummary.slice(0, 160)}${
      cleanSummary.length > 160 ? '...' : ''
    }" — @${author.username} no Insight*`
  );
  const encodedUrl = encodeURIComponent(shareUrl);

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-md p-0 sm:p-4 animate-in fade-in duration-150"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl bg-surface border border-border text-primary shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
      >
        {/* Cabeçalho do Share Studio */}
        <div className="px-5 py-3.5 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-accent" />
            <span className="text-xs font-extrabold uppercase tracking-wider text-primary">
              Insight* Share Studio
            </span>
          </div>

          {/* Seletor de Estilo do Adesivo */}
          <div className="flex items-center gap-1 bg-elevated p-1 rounded-full border border-border">
            {(Object.keys(CARD_THEMES) as CardThemeId[]).map((tKey) => {
              const t = CARD_THEMES[tKey];
              const active = cardTheme === tKey;
              return (
                <button
                  key={tKey}
                  type="button"
                  onClick={() => setCardTheme(tKey)}
                  className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold transition-all ${
                    active
                      ? 'bg-accent text-white shadow-sm'
                      : 'text-secondary hover:text-primary'
                  }`}
                >
                  {t.label}
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full text-muted hover:text-primary hover:bg-elevated transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Corpo do Modal */}
        <div className="p-5 space-y-4 overflow-y-auto">
          {/* 1. PRÉVIA AO VIVO DO STICKER / CARD */}
          <div className="relative rounded-2xl p-4 sm:p-5 bg-elevated/40 border border-border flex items-center justify-center overflow-hidden">
            <div
              style={{
                background: `linear-gradient(135deg, ${activeTheme.bgStart}, ${activeTheme.bgEnd})`,
                borderColor: activeTheme.border,
                color: activeTheme.textPrimary,
              }}
              className="relative w-full rounded-2xl p-5 border shadow-xl overflow-hidden transition-all duration-300"
            >
              {/* Marca d'água geométrica do * de 8 pontas */}
              <svg
                viewBox="0 0 200 200"
                style={{ color: activeTheme.accent }}
                className="w-36 h-36 absolute -right-8 -top-8 opacity-10 pointer-events-none rotate-12"
              >
                <g transform="translate(100,100)" fill="currentColor">
                  {[0, 45, 90, 135].map((a) => (
                    <rect
                      key={a}
                      x="-16"
                      y="-85"
                      width="32"
                      height="170"
                      rx="6"
                      transform={`rotate(${a})`}
                    />
                  ))}
                </g>
              </svg>

              {/* Topo do Card */}
              <div className="relative z-10 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  <img
                    src={author.avatar_url || '/assets/net/default-perfil'}
                    alt={author.full_name}
                    className="w-10 h-10 rounded-full object-cover border border-white/15 shrink-0"
                  />
                  <div className="min-w-0">
                    <div className="flex items-center gap-1">
                      <span className="text-xs sm:text-sm font-extrabold truncate">
                        {author.display_name || author.full_name}
                      </span>
                      <ShieldCheck className="w-3.5 h-3.5 text-[#00ccff] shrink-0" />
                    </div>
                    <p
                      style={{ color: activeTheme.textMuted }}
                      className="text-[11px] truncate"
                    >
                      @{author.username}
                      {author.nickname ? ` · ${author.nickname}` : ''}
                    </p>
                  </div>
                </div>

                <span className="text-sm font-black tracking-tight shrink-0">
                  Insight<span style={{ color: activeTheme.accent }}>*</span>
                </span>
              </div>

              {/* Conteúdo da Publicação */}
              <p className="relative z-10 mt-3.5 text-xs sm:text-sm leading-relaxed whitespace-pre-line line-clamp-5">
                {cleanSummary}
              </p>

              {post.image_url && (
                <div className="relative z-10 mt-3 rounded-xl overflow-hidden border border-white/10 max-h-36">
                  <img
                    src={post.image_url}
                    alt="Mídia"
                    className="w-full h-full object-cover max-h-36"
                  />
                </div>
              )}

              {/* Tags */}
              {Array.isArray(post.tags) && post.tags.length > 0 && (
                <div className="relative z-10 mt-3 flex flex-wrap gap-1.5">
                  {post.tags.slice(0, 4).map((t) => (
                    <span
                      key={t}
                      style={{
                        backgroundColor: activeTheme.badgeBg,
                        color: activeTheme.accent,
                      }}
                      className="px-2 py-0.5 rounded-md font-mono text-[10px] font-bold"
                    >
                      #{t}
                    </span>
                  ))}
                </div>
              )}

              {/* Rodapé do Card */}
              <div
                style={{
                  borderColor: activeTheme.border,
                  color: activeTheme.textMuted,
                }}
                className="relative z-10 mt-4 pt-2.5 border-t flex items-center justify-between text-[10px] font-mono"
              >
                <span>{formattedDate}</span>
                <span style={{ color: activeTheme.accent }} className="font-bold">
                  /u/{author.username}
                </span>
              </div>
            </div>
          </div>

          {/* 2. AÇÕES PRINCIPAIS: COLAR ADESIVO NOS STORIES OU ENVIAR NATIVO */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={handleCopyStickerToClipboard}
              className="p-3 rounded-2xl bg-accent hover:bg-accent-hover text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg transition-all"
            >
              {copiedSticker ? (
                <>
                  <Check className="w-4 h-4" />
                  <span>Adesivo Copiado! Só Colar</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  <span>Copiar Adesivo (Story / Chat)</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handleNativeShare}
              disabled={sharingNative}
              className="p-3 rounded-2xl bg-elevated hover:bg-elevated/80 border border-border hover:border-accent text-primary font-bold text-xs flex items-center justify-center gap-2 transition-all"
            >
              <Smartphone className="w-4 h-4 text-accent" />
              <span>
                {sharingNative ? 'Abrindo Apps...' : 'Enviar para Apps / Stories'}
              </span>
            </button>
          </div>

          <p className="text-[11px] text-muted text-center">
            Dica: Ao clicar em <b className="text-secondary">Copiar Adesivo</b>, basta abrir o Instagram Stories, WhatsApp ou Discord e tocar em <b className="text-secondary">Colar</b>.
          </p>

          {/* 3. ATALHOS RÁPIDOS DE REDES & LINK DIRETO */}
          <div className="pt-2 border-t border-border space-y-2.5">
            <div className="flex items-center gap-2">
              <div className="flex-1 bg-elevated border border-border rounded-xl px-3 py-2 text-[11px] font-mono text-secondary truncate">
                {shareUrl}
              </div>
              <button
                type="button"
                onClick={handleCopyLink}
                className="px-3.5 py-2 rounded-xl bg-surface border border-border hover:border-accent text-xs font-bold text-primary flex items-center gap-1.5 shrink-0 transition-colors"
              >
                {copiedLink ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-emerald-400">Copiado</span>
                  </>
                ) : (
                  <>
                    <Link2 className="w-3.5 h-3.5 text-accent" />
                    <span>Copiar Link</span>
                  </>
                )}
              </button>
            </div>

            <div className="grid grid-cols-4 gap-2 pt-1">
              <a
                href={`https://wa.me/?text=${encodedText}%20${encodedUrl}`}
                target="_blank"
                rel="noopener noreferrer"
                className="p-2.5 rounded-xl bg-elevated/70 hover:bg-elevated border border-border hover:border-[#25D366]/60 flex flex-col items-center justify-center gap-1 text-[11px] font-semibold text-secondary hover:text-primary transition-all"
              >
                <MessageCircle className="w-4 h-4 text-[#25D366]" />
                <span>WhatsApp</span>
              </a>

              <a
                href={`https://twitter.com/intent/tweet?text=${encodedText}&url=${encodedUrl}`}
                target="_blank"
                rel="noopener noreferrer"
                className="p-2.5 rounded-xl bg-elevated/70 hover:bg-elevated border border-border hover:border-accent/60 flex flex-col items-center justify-center gap-1 text-[11px] font-semibold text-secondary hover:text-primary transition-all"
              >
                <Share2 className="w-4 h-4 text-primary" />
                <span>Postar no X</span>
              </a>

              <a
                href={`https://t.me/share/url?url=${encodedUrl}&text=${encodedText}`}
                target="_blank"
                rel="noopener noreferrer"
                className="p-2.5 rounded-xl bg-elevated/70 hover:bg-elevated border border-border hover:border-[#38bdf8]/60 flex flex-col items-center justify-center gap-1 text-[11px] font-semibold text-secondary hover:text-primary transition-all"
              >
                <Send className="w-4 h-4 text-[#38bdf8]" />
                <span>Telegram</span>
              </a>

              <button
                type="button"
                onClick={handleCopyMarkdownQuote}
                className="p-2.5 rounded-xl bg-elevated/70 hover:bg-elevated border border-border hover:border-accent/60 flex flex-col items-center justify-center gap-1 text-[11px] font-semibold text-secondary hover:text-primary transition-all"
              >
                {copiedQuote ? (
                  <>
                    <Check className="w-4 h-4 text-emerald-400" />
                    <span className="text-emerald-400">Citado!</span>
                  </>
                ) : (
                  <>
                    <Quote className="w-4 h-4 text-accent" />
                    <span>Citar</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}