'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, Download, Link2, Lock, Share2, X } from 'lucide-react';
import { Post, Profile } from '@/types/database';
import { SHARE_THEMES, ShareFormat } from '@/lib/share/themes';

interface SharePostModalProps {
  isOpen: boolean;
  onClose: () => void;
  post: Post;
  author: Profile;
}

const FORMATS: { id: ShareFormat; label: string; hint: string }[] = [
  { id: 'story', label: 'Stories', hint: '9:16 · Instagram, WhatsApp, Facebook' },
  { id: 'square', label: 'Quadrado', hint: '1:1 · feed, Threads, X' },
  { id: 'og', label: 'Link', hint: 'Prévia que aparece ao colar o link' },
];

/** Ícones das redes (desenhados aqui, sem depender de marcas no lucide). */
const NETWORKS: { id: string; label: string; color: string; path: string; href: (url: string, text: string) => string }[] = [
  {
    id: 'whatsapp',
    label: 'WhatsApp',
    color: '#25D366',
    path: 'M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm5.3 14.1c-.2.6-1.3 1.2-1.8 1.2-.5.1-1 .2-3.4-.7-2.8-1.1-4.6-4-4.7-4.2-.1-.2-1.1-1.5-1.1-2.9s.7-2 1-2.3c.2-.3.5-.3.7-.3h.5c.2 0 .4 0 .6.5l.8 2c.1.2.1.4 0 .5l-.4.6-.4.4c-.1.1-.3.3-.1.6.2.3.8 1.3 1.7 2.1 1.2 1 2.1 1.3 2.4 1.5.3.1.5.1.6-.1l.9-1c.2-.3.4-.2.6-.1l1.9.9c.3.1.5.2.5.3.1.2.1.6-.1 1.1Z',
    href: (url, text) => `https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}`,
  },
  {
    id: 'telegram',
    label: 'Telegram',
    color: '#29A9EB',
    path: 'M21.8 4.3 18.6 19.5c-.2 1-.9 1.3-1.8.8l-4.9-3.6-2.4 2.3c-.3.3-.5.5-1 .5l.4-5 9.1-8.2c.4-.4-.1-.6-.6-.2L6.2 13.2l-4.8-1.5c-1-.3-1-1 .2-1.5l18.8-7.2c.9-.3 1.6.2 1.4 1.3Z',
    href: (url, text) => `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`,
  },
  {
    id: 'x',
    label: 'X',
    color: '#e7e9ea',
    path: 'M17.8 3h3.1l-6.8 7.7L22 21h-6.2l-4.9-6.4L5.3 21H2.2l7.3-8.3L1.8 3h6.4l4.4 5.8L17.8 3Zm-1.1 16.2h1.7L7.3 4.7H5.5l11.2 14.5Z',
    href: (url, text) => `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`,
  },
  {
    id: 'threads',
    label: 'Threads',
    color: '#ffffff',
    path: 'M16.7 11.1c-.1 0-.2-.1-.3-.1-.2-3-1.8-4.7-4.6-4.7-1.6 0-3 .7-3.8 2l1.5 1c.6-.9 1.6-1.1 2.3-1.1 1 0 1.7.3 2.2.9.3.4.5 1 .6 1.7-.8-.1-1.6-.2-2.5-.1-2.5.1-4.1 1.6-4 3.6.1 1 .6 1.9 1.4 2.4.7.5 1.6.7 2.6.6 1.3-.1 2.3-.6 3-1.5.5-.7.9-1.6 1-2.7.6.4 1.1.9 1.3 1.5.4 1 .4 2.6-.9 3.9-1.1 1.1-2.5 1.6-4.6 1.6-2.3 0-4.1-.8-5.2-2.2-1.1-1.4-1.6-3.3-1.7-5.8 0-2.5.6-4.4 1.7-5.8 1.1-1.4 2.9-2.2 5.2-2.2 2.4 0 4.2.8 5.3 2.2.6.7 1 1.6 1.3 2.6l1.8-.5c-.4-1.3-.9-2.4-1.7-3.3-1.5-1.8-3.7-2.8-6.7-2.8-2.9 0-5.2 1-6.7 2.9C4.3 7.8 3.6 10.1 3.6 13s.7 5.2 2.1 6.9C7.2 21.8 9.5 22.8 12.4 22.8c2.6 0 4.4-.7 5.9-2.2 2-2 1.9-4.4 1.3-5.9-.5-1.1-1.5-2.1-2.9-2.7v-.9Zm-4.4 4.6c-1.1.1-2.2-.4-2.2-1.4-.1-.7.5-1.6 2.3-1.7h.6c.6 0 1.1.1 1.6.2-.2 2.4-1.3 2.9-2.3 2.9Z',
    href: (url, text) => `https://www.threads.net/intent/post?text=${encodeURIComponent(`${text} ${url}`)}`,
  },
  {
    id: 'facebook',
    label: 'Facebook',
    color: '#1877F2',
    path: 'M22 12a10 10 0 1 0-11.6 9.9v-7H7.9V12h2.5V9.8c0-2.5 1.5-3.9 3.8-3.9 1.1 0 2.2.2 2.2.2v2.5h-1.3c-1.2 0-1.6.8-1.6 1.6V12h2.8l-.4 2.9h-2.3v7A10 10 0 0 0 22 12Z',
    href: (url) => `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
  },
  {
    id: 'linkedin',
    label: 'LinkedIn',
    color: '#0A66C2',
    path: 'M20.4 2H3.6A1.6 1.6 0 0 0 2 3.6v16.8A1.6 1.6 0 0 0 3.6 22h16.8a1.6 1.6 0 0 0 1.6-1.6V3.6A1.6 1.6 0 0 0 20.4 2ZM8 19H5V9.5h3V19ZM6.5 8.2a1.7 1.7 0 1 1 0-3.5 1.7 1.7 0 0 1 0 3.5ZM19 19h-3v-4.6c0-1.1 0-2.5-1.5-2.5S12.7 13 12.7 14.3V19h-3V9.5h2.8v1.3h.1a3.1 3.1 0 0 1 2.8-1.5c3 0 3.6 2 3.6 4.6V19Z',
    href: (url) => `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`,
  },
];

function plainText(post: Post) {
  const raw =
    post.content?.trim() ||
    (Array.isArray(post.blocks) ? post.blocks.map((b) => (b.html || '').replace(/<[^>]+>/g, ' ')).join(' ') : '');
  return raw.replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
}

export function SharePostModal({ isOpen, onClose, post, author }: SharePostModalProps) {
  const name = author.display_name || author.full_name || author.username;
  const shareText = useMemo(() => {
    const t = plainText(post);
    const quote = t ? `“${t.length > 120 ? `${t.slice(0, 117)}…` : t}”` : '';
    return `${quote} — ${name} no Insight*`.trim();
  }, [post, name]);
  return (
    <ShareSheet
      isOpen={isOpen}
      onClose={onClose}
      title="Compartilhar Insight"
      imageBase={`/api/share/${post.id}`}
      path={`/post/${post.id}`}
      shareTitle={`${name} no Insight*`}
      shareText={shareText}
      fileName={`insight-post-${post.id.slice(0, 8)}`}
      isPrivate={post.visibility === 'private' || Boolean(post.is_draft)}
    />
  );
}

/** Cartão "me siga" de um perfil. */
export function ShareProfileModal({ isOpen, onClose, profile }: { isOpen: boolean; onClose: () => void; profile: Profile }) {
  const name = profile.display_name || profile.full_name || profile.username;
  return (
    <ShareSheet
      isOpen={isOpen}
      onClose={onClose}
      title="Compartilhar perfil"
      imageBase={`/api/share/profile/${encodeURIComponent(profile.username)}`}
      path={`/u/${encodeURIComponent(profile.username)}`}
      shareTitle={`${name} (@${profile.username}) no Insight*`}
      shareText={`Me siga no Insight*: ${name} (@${profile.username})`}
      fileName={`insight-perfil-${profile.username}`}
      isPrivate={false}
    />
  );
}

interface ShareSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  /** rota da imagem sem query (ex.: /api/share/<id>) */
  imageBase: string;
  /** caminho público (ex.: /post/<id>) */
  path: string;
  shareTitle: string;
  shareText: string;
  fileName: string;
  isPrivate: boolean;
}

export function ShareSheet({ isOpen, onClose, title, imageBase, path, shareTitle, shareText, fileName, isPrivate }: ShareSheetProps) {
  const [format, setFormat] = useState<ShareFormat>('story');
  const [themeId, setThemeId] = useState(SHARE_THEMES[0].id);
  const [imgState, setImgState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [copied, setCopied] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const blobRef = useRef<Blob | null>(null);
  const [previewSrc, setPreviewSrc] = useState<string | null>(null);

  const shareUrl = typeof window === 'undefined' ? '' : `${window.location.origin}${path}`;
  const imageUrl = `${imageBase}?format=${format}&theme=${themeId}`;
  const name = shareTitle;

  // Baixa a imagem assim que a prévia muda: no clique o compartilhamento é
  // imediato (o navegador só abre a gaveta de compartilhar logo após um toque).
  useEffect(() => {
    if (!isOpen || isPrivate) return;
    let active = true;
    blobRef.current = null;
    setImgState('loading');
    fetch(imageUrl)
      .then((r) => (r.ok ? r.blob() : Promise.reject(new Error(String(r.status)))))
      .then((b) => {
        if (!active) return;
        blobRef.current = b;
        setPreviewSrc((old) => {
          if (old) URL.revokeObjectURL(old);
          return URL.createObjectURL(b);
        });
        setImgState('ready');
      })
      .catch(() => active && setImgState('error'));
    return () => {
      active = false;
    };
  }, [imageUrl, isOpen, isPrivate]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  function flash(msg: string) {
    setNotice(msg);
    setTimeout(() => setNotice(null), 3200);
  }

  async function copyLink(silent = false) {
    try {
      await navigator.clipboard.writeText(shareUrl);
      if (!silent) {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
      return true;
    } catch {
      if (!silent) prompt('Copie o link:', shareUrl);
      return false;
    }
  }

  function download(blob: Blob) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${fileName}-${format}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }

  async function shareImage() {
    const blob = blobRef.current;
    if (!blob) return;
    setBusy(true);
    // o link vai junto na área de transferência para a figurinha "Link" dos Stories
    // (sem await: no iPhone a gaveta de compartilhar precisa abrir no mesmo toque)
    let linkCopied = false;
    navigator.clipboard?.writeText(shareUrl).then(() => (linkCopied = true)).catch(() => {});
    const file = new File([blob], `${fileName}-${format}.png`, { type: 'image/png' });
    try {
      if (navigator.canShare?.({ files: [file] })) {
        // só o arquivo: com texto/link juntos, o Instagram não oferece "Stories"
        await navigator.share({ files: [file] });
        if (linkCopied) flash('Link copiado — nos Stories, use a figurinha “Link” e cole.');
      } else {
        download(blob);
        flash('Imagem baixada — o link do post foi copiado.');
      }
    } catch (err) {
      if ((err as Error)?.name !== 'AbortError') {
        download(blob);
        flash('Imagem baixada.');
      }
    } finally {
      setBusy(false);
    }
  }

  async function shareLinkNative() {
    try {
      if (navigator.share) await navigator.share({ title: name, text: shareText, url: shareUrl });
      else await copyLink();
    } catch {
      // cancelado
    }
  }

  const aspect = format === 'story' ? 'h-[min(46vh,520px)] aspect-[9/16]' : format === 'square' ? 'h-[min(36vh,380px)] aspect-square' : 'w-full aspect-[1200/630]';

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-[90] flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl bg-surface border border-border text-primary shadow-2xl overflow-hidden flex flex-col max-h-[94vh]"
      >
        <div className="px-5 pt-3 pb-2 flex items-center justify-between">
          <span className="sm:hidden absolute left-1/2 -translate-x-1/2 top-2 h-1 w-10 rounded-full bg-border" aria-hidden />
          <h2 className="text-base font-extrabold">{title}</h2>
          <button type="button" onClick={onClose} aria-label="Fechar" className="p-1.5 rounded-full text-muted hover:text-primary hover:bg-elevated">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-5 pb-5 space-y-4 overflow-y-auto">
          {isPrivate ? (
            <div className="flex items-start gap-2 p-3 rounded-xl bg-elevated border border-border text-xs text-secondary">
              <Lock className="w-4 h-4 shrink-0 text-muted" />
              Esta publicação é privada: só o link funciona, e só para você.
            </div>
          ) : (
            <>
              {/* formato */}
              <div className="grid grid-cols-3 gap-1 p-1 rounded-xl bg-elevated border border-border" role="tablist">
                {FORMATS.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    role="tab"
                    aria-selected={format === f.id}
                    onClick={() => setFormat(f.id)}
                    className={`py-1.5 rounded-lg text-xs font-bold transition-colors ${
                      format === f.id ? 'bg-accent text-white shadow-sm' : 'text-secondary hover:text-primary'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>

              {/* prévia */}
              <div className="flex flex-col items-center gap-2">
                <div className={`relative ${aspect} rounded-2xl overflow-hidden border border-border bg-elevated shadow-lg`}>
                  {previewSrc && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={previewSrc}
                      alt="Prévia da imagem de compartilhamento"
                      className={`w-full h-full object-contain transition-opacity duration-300 ${imgState === 'ready' ? 'opacity-100' : 'opacity-40'}`}
                    />
                  )}
                  {imgState === 'loading' && (
                    <div className="absolute inset-0 flex items-center justify-center animate-pulse bg-gradient-to-b from-elevated to-surface">
                      <span className="text-[11px] font-semibold text-muted">Gerando imagem…</span>
                    </div>
                  )}
                  {imgState === 'error' && (
                    <div className="absolute inset-0 flex items-center justify-center p-4 text-center text-xs text-muted">
                      Não foi possível gerar a imagem agora.
                    </div>
                  )}
                </div>
                <p className="text-[11px] text-muted">{FORMATS.find((f) => f.id === format)?.hint}</p>
              </div>

              {/* estilo */}
              <div className="flex items-center justify-center gap-2" role="radiogroup" aria-label="Estilo da imagem">
                {SHARE_THEMES.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    role="radio"
                    aria-checked={themeId === t.id}
                    title={t.label}
                    aria-label={t.label}
                    onClick={() => setThemeId(t.id)}
                    className={`w-8 h-8 rounded-full border-2 transition-transform ${themeId === t.id ? 'border-accent scale-110' : 'border-border'}`}
                    style={{ background: `linear-gradient(135deg, ${t.swatch[0]}, ${t.swatch[1]})` }}
                  />
                ))}
              </div>

              {/* ações principais */}
              {format !== 'og' ? (
                <div className="grid grid-cols-[1fr_auto] gap-2">
                  <button
                    type="button"
                    onClick={shareImage}
                    disabled={imgState !== 'ready' || busy}
                    className="flex items-center justify-center gap-2 py-3 rounded-full text-white text-sm font-extrabold disabled:opacity-50 bg-gradient-to-r from-[#f58529] via-[#dd2a7b] to-[#8134af] shadow-md"
                  >
                    <Share2 className="w-4 h-4" />
                    {format === 'story' ? 'Compartilhar nos Stories' : 'Compartilhar imagem'}
                  </button>
                  <button
                    type="button"
                    onClick={() => blobRef.current && download(blobRef.current)}
                    disabled={imgState !== 'ready'}
                    aria-label="Baixar imagem"
                    title="Baixar imagem"
                    className="px-4 rounded-full border border-border text-secondary hover:text-primary disabled:opacity-50"
                  >
                    <Download className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={shareLinkNative}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-full bg-accent hover:bg-accent-hover text-white text-sm font-extrabold"
                >
                  <Share2 className="w-4 h-4" /> Compartilhar link
                </button>
              )}
              {format === 'story' && (
                <p className="text-[11px] text-muted text-center leading-snug">
                  No celular, escolha <strong className="text-secondary">Instagram → Stories</strong>. O link do post já vai
                  copiado: adicione a figurinha <strong className="text-secondary">“Link”</strong> e cole.
                </p>
              )}
            </>
          )}

          {/* link + redes */}
          <button
            type="button"
            onClick={() => copyLink()}
            className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl bg-elevated border border-border text-left"
          >
            <Link2 className="w-4 h-4 text-accent shrink-0" />
            <span className="flex-1 min-w-0 truncate text-xs font-mono text-secondary">{shareUrl}</span>
            <span className={`text-xs font-bold shrink-0 ${copied ? 'text-emerald-400' : 'text-accent'}`}>
              {copied ? (
                <span className="inline-flex items-center gap-1">
                  <Check className="w-3.5 h-3.5" /> Copiado
                </span>
              ) : (
                'Copiar'
              )}
            </span>
          </button>

          {!isPrivate && (
            <div className="grid grid-cols-6 gap-1">
              {NETWORKS.map((n) => (
                <a
                  key={n.id}
                  href={n.href(shareUrl, shareText)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex flex-col items-center gap-1 py-1.5 rounded-xl hover:bg-elevated transition-colors"
                >
                  <span className="w-10 h-10 rounded-full flex items-center justify-center bg-black/80 border border-border">
                    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden>
                      <path d={n.path} fill={n.color} />
                    </svg>
                  </span>
                  <span className="text-[10px] text-secondary">{n.label}</span>
                </a>
              ))}
            </div>
          )}

          {notice && (
            <p role="status" className="text-xs text-center font-semibold text-emerald-400">
              {notice}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
