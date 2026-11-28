'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Plus, SmilePlus } from 'lucide-react';
import { relativeTime } from './PostTime';
import { DEFAULT_REACTIONS, REACTION_LABEL, recentReactions, type MiniProfile, type PostSocial, type ReactionId, type TopReply } from '@/lib/postSocial';
import { EmojiGallery } from './EmojiGallery';

const avatarSrc = (url: string | null | undefined) => url || '/assets/net/default-perfil';

/** "Curtido por Ana e mais 3" com mini-avatares (quem curtiu por último). */
export function LikedBy({ likers, total, viewerLiked }: { likers: MiniProfile[]; total: number; viewerLiked: boolean }) {
  if (total <= 0 || (!likers.length && !viewerLiked)) return null;
  const first = viewerLiked ? null : likers[0];
  const others = Math.max(0, total - 1);
  return (
    <div className="mt-2 flex items-center gap-2 text-xs text-secondary min-w-0">
      {likers.length > 0 && (
        <span className="flex -space-x-1.5 shrink-0" aria-hidden="true">
          {likers.slice(0, 3).map((p) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={p.id}
              src={avatarSrc(p.avatar_url)}
              alt=""
              className="w-5 h-5 rounded-full object-cover ring-2 ring-background bg-elevated"
            />
          ))}
        </span>
      )}
      <span className="truncate">
        Curtido por{' '}
        {first ? (
          <Link href={`/u/${encodeURIComponent(first.username)}`} className="font-semibold text-primary hover:underline">
            {first.name}
          </Link>
        ) : (
          <span className="font-semibold text-primary">você</span>
        )}
        {others > 0 && (
          <>
            {' '}e mais <span className="font-semibold text-primary">{others}</span>
          </>
        )}
      </span>
    </div>
  );
}

/** A resposta em destaque, embaixo do post: mostra que tem conversa ali. */
export function ReplyPreview({ reply, total, postId }: { reply: TopReply; total: number; postId: string }) {
  return (
    <Link
      href={`/post/${postId}#reply-${reply.id}`}
      className="mt-3 flex items-start gap-2.5 rounded-xl px-3 py-2.5 bg-surface/60 hover:bg-surface transition-colors min-w-0"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={avatarSrc(reply.author.avatar_url)} alt="" className="w-6 h-6 rounded-full object-cover bg-elevated shrink-0 mt-0.5" />
      <div className="min-w-0 flex-1">
        <p className="text-[13px] leading-snug text-primary line-clamp-2 break-words">
          <span className="font-semibold">{reply.author.name}</span>{' '}
          <span className="text-secondary">{reply.text}</span>
        </p>
        <p className="mt-0.5 text-[11px] text-muted">
          {relativeTime(new Date(reply.created_at))}
          {reply.likes > 0 && ` · ${reply.likes} ${reply.likes === 1 ? 'curtida' : 'curtidas'}`}
          {total > 1 && <span className="text-accent font-medium"> · Ver as {total} respostas</span>}
        </p>
      </div>
    </Link>
  );
}

/** Chips das reações que o post já recebeu (emoji + número). Clicar usa a mesma reação. */
export function ReactionChips({
  social,
  onReact,
}: {
  social: PostSocial;
  onReact: (r: ReactionId) => void;
}) {
  // mais usadas primeiro
  const entries = Object.entries(social.reactions)
    .filter(([, n]) => n > 0)
    .sort((a, b) => b[1] - a[1]);
  if (!entries.length) return null;
  return (
    <div className="mt-3 flex flex-wrap items-center gap-1.5">
      {entries.map(([emoji, n]) => {
        const mine = social.myReaction === emoji;
        const label = REACTION_LABEL.get(emoji) || emoji;
        return (
          <button
            key={emoji}
            type="button"
            onClick={() => onReact(emoji)}
            title={mine ? `Você reagiu ${emoji} (clique para tirar)` : label}
            aria-pressed={mine}
            className={`inline-flex items-center gap-1 h-7 px-2 rounded-full border text-[13px] tabular-nums transition-colors ${
              mine ? 'border-accent/60 bg-accent/10 text-primary' : 'border-border text-secondary hover:border-secondary/60'
            }`}
          >
            <span className="text-[15px] leading-none">{emoji}</span>
            <span key={n} className="insight-count-roll">{n}</span>
          </button>
        );
      })}
    </div>
  );
}

/**
 * Botão de reagir: os 5 padrões, os últimos emojis usados neste aparelho e o
 * "+" que abre a galeria completa.
 */
export function ReactionButton({ mine, onReact }: { mine: ReactionId | null; onReact: (r: ReactionId) => void }) {
  const [open, setOpen] = useState(false);
  const [gallery, setGallery] = useState(false);
  const [recent, setRecent] = useState<string[]>([]);
  const defaults = DEFAULT_REACTIONS.map((r) => r.emoji) as string[];

  const openPicker = () => {
    setRecent(recentReactions());
    setOpen((v) => !v);
  };
  const pick = (emoji: string) => {
    setOpen(false);
    setGallery(false);
    onReact(emoji);
  };
  const recentExtra = recent.filter((e) => !defaults.includes(e)).slice(0, 6);
  const label = mine ? `Sua reação: ${REACTION_LABEL.get(mine) || mine}` : 'Reagir';

  return (
    <div className="relative inline-flex">
      <button
        type="button"
        onClick={openPicker}
        aria-label={label}
        title={label}
        aria-haspopup="menu"
        aria-expanded={open}
        className={`flex items-center gap-1.5 py-1 transition-colors ${mine ? 'text-primary' : 'hover:text-primary'}`}
      >
        {mine ? <span className="text-base leading-none">{mine}</span> : <SmilePlus className="w-4 h-4" />}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div
            role="menu"
            className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 p-1 rounded-3xl bg-elevated border border-border shadow-2xl insight-pop-in"
          >
            <div className="flex items-center gap-0.5">
              {defaults.map((emoji) => (
                <PickerEmoji key={emoji} emoji={emoji} label={REACTION_LABEL.get(emoji) || emoji} active={mine === emoji} onPick={pick} />
              ))}
              <button
                type="button"
                role="menuitem"
                title="Todos os emojis"
                aria-label="Abrir todos os emojis"
                onClick={() => {
                  setOpen(false);
                  setGallery(true);
                }}
                className="w-9 h-9 grid place-items-center rounded-full text-secondary hover:text-primary hover:bg-surface transition-colors"
              >
                <Plus className="w-5 h-5" />
              </button>
            </div>
            {recentExtra.length > 0 && (
              <div className="flex items-center gap-0.5 mt-0.5 pt-0.5 border-t border-border">
                {recentExtra.map((emoji) => (
                  <PickerEmoji key={emoji} emoji={emoji} label={`Recente: ${emoji}`} active={mine === emoji} onPick={pick} />
                ))}
              </div>
            )}
          </div>
        </>
      )}
      {gallery && <EmojiGallery recent={recent} onPick={pick} onClose={() => setGallery(false)} />}
    </div>
  );
}

function PickerEmoji({ emoji, label, active, onPick }: { emoji: string; label: string; active: boolean; onPick: (e: string) => void }) {
  return (
    <button
      type="button"
      role="menuitem"
      title={label}
      aria-label={label}
      onClick={() => onPick(emoji)}
      className={`w-9 h-9 grid place-items-center rounded-full transition-transform hover:scale-125 hover:-translate-y-0.5 ${active ? 'bg-accent/15' : ''}`}
    >
      <span className="text-[22px] leading-none">{emoji}</span>
    </button>
  );
}

/** Coração grande que aparece no duplo toque. */
export function HeartBurst({ show }: { show: number }) {
  const [visible, setVisible] = useState(false);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    setVisible(true);
    const t = setTimeout(() => setVisible(false), 750);
    return () => clearTimeout(t);
  }, [show]);
  if (!visible) return null;
  return (
    <span key={show} aria-hidden="true" className="pointer-events-none absolute inset-0 z-20 grid place-items-center">
      <svg viewBox="0 0 24 24" className="w-24 h-24 text-rose-500 drop-shadow-[0_4px_18px_rgba(0,0,0,0.35)] insight-heart-burst" fill="currentColor">
        <path d="M12 21s-6.7-4.35-9.33-8.17C.6 9.8 2.1 5.5 6.04 5.04 8.2 4.8 9.94 5.9 12 8.1c2.06-2.2 3.8-3.3 5.96-3.06 3.94.46 5.44 4.76 3.37 7.79C18.7 16.65 12 21 12 21z" />
      </svg>
    </span>
  );
}
