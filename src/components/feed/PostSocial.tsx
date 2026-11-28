'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { SmilePlus } from 'lucide-react';
import { relativeTime } from './PostTime';
import { REACTIONS, REACTION_BY_ID, type MiniProfile, type PostSocial, type ReactionId, type TopReply } from '@/lib/postSocial';

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

/** Chips das reações que o post já recebeu (ícone + número). Clicar usa a mesma reação. */
export function ReactionChips({
  social,
  onReact,
}: {
  social: PostSocial;
  onReact: (r: ReactionId) => void;
}) {
  const entries = REACTIONS.filter((r) => (social.reactions[r.id] || 0) > 0);
  if (!entries.length) return null;
  return (
    <div className="mt-3 flex flex-wrap items-center gap-1.5">
      {entries.map((r) => {
        const mine = social.myReaction === r.id;
        return (
          <button
            key={r.id}
            type="button"
            onClick={() => onReact(r.id)}
            title={mine ? `Você reagiu: ${r.label} (clique para tirar)` : r.label}
            aria-pressed={mine}
            className={`inline-flex items-center gap-1 h-7 px-2 rounded-full border text-[13px] tabular-nums transition-colors ${
              mine ? 'border-accent/60 bg-accent/10 text-primary' : 'border-border text-secondary hover:border-secondary/60'
            }`}
          >
            <span className="text-[15px] leading-none">{r.emoji}</span>
            <span key={social.reactions[r.id]} className="insight-count-roll">{social.reactions[r.id]}</span>
          </button>
        );
      })}
    </div>
  );
}

/** Botão da barra de ações que abre as reações rápidas. */
export function ReactionButton({ mine, onReact }: { mine: ReactionId | null; onReact: (r: ReactionId) => void }) {
  const [open, setOpen] = useState(false);
  const current = mine ? REACTION_BY_ID.get(mine) : null;
  return (
    <div className="relative inline-flex">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={current ? `Sua reação: ${current.label}` : 'Reagir'}
        title={current ? `Sua reação: ${current.label}` : 'Reagir'}
        aria-haspopup="menu"
        aria-expanded={open}
        className={`flex items-center gap-1.5 py-1 transition-colors ${current ? 'text-primary' : 'hover:text-primary'}`}
      >
        {current ? (
          <span className="text-base leading-none">{current.emoji}</span>
        ) : (
          <SmilePlus className="w-4 h-4" />
        )}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div
            role="menu"
            className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 flex items-center gap-0.5 p-1 rounded-full bg-elevated border border-border shadow-2xl insight-pop-in"
          >
            {REACTIONS.map((r) => (
              <button
                key={r.id}
                type="button"
                role="menuitem"
                title={r.label}
                aria-label={r.label}
                onClick={() => {
                  setOpen(false);
                  onReact(r.id);
                }}
                className={`w-9 h-9 grid place-items-center rounded-full transition-transform hover:scale-125 hover:-translate-y-0.5 ${
                  mine === r.id ? 'bg-accent/15' : ''
                }`}
              >
                <span className="text-[22px] leading-none">{r.emoji}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
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
