'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Heart, MessageCircle, Music, Flame } from 'lucide-react';
import { ReplyNode, formatRelativeTime } from './utils';

interface ReplyCarouselProps {
  replies: ReplyNode[];
  likedIds: Set<string>;
  onSelect: (replyId: string) => void;
  onToggleLike: (replyId: string) => void;
}

/**
 * Carrossel horizontal com as respostas em destaque (mais curtidas / com mais
 * conversa). Clicar num card leva até a resposta dentro da discussão.
 */
export function ReplyCarousel({ replies, likedIds, onSelect, onToggleLike }: ReplyCarouselProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(false);

  const updateButtons = useCallback(() => {
    const el = trackRef.current;
    if (!el) return;
    setCanLeft(el.scrollLeft > 8);
    setCanRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 8);
  }, []);

  useEffect(() => {
    updateButtons();
    window.addEventListener('resize', updateButtons);
    return () => window.removeEventListener('resize', updateButtons);
  }, [replies, updateButtons]);

  function scrollBy(direction: 1 | -1) {
    const el = trackRef.current;
    if (!el) return;
    el.scrollBy({ left: direction * el.clientWidth * 0.85, behavior: 'smooth' });
  }

  if (replies.length === 0) return null;

  return (
    <section className="py-4 border-b border-border" aria-label="Respostas em destaque">
      <div className="px-4 sm:px-6 flex items-center justify-between gap-2 mb-3">
        <h2 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-primary">
          <Flame className="w-3.5 h-3.5 text-accent" />
          <span>Respostas em destaque</span>
        </h2>
        <div className="hidden sm:flex items-center gap-1">
          <button
            type="button"
            onClick={() => scrollBy(-1)}
            disabled={!canLeft}
            aria-label="Anterior"
            className="p-1.5 rounded-full border border-border text-secondary hover:text-primary hover:bg-elevated disabled:opacity-30 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => scrollBy(1)}
            disabled={!canRight}
            aria-label="Próxima"
            className="p-1.5 rounded-full border border-border text-secondary hover:text-primary hover:bg-elevated disabled:opacity-30 transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div
        ref={trackRef}
        onScroll={updateButtons}
        className="flex gap-3 overflow-x-auto snap-x snap-mandatory scroll-smooth scroll-px-4 sm:scroll-px-6 px-4 sm:px-6 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {replies.map((reply) => {
          const liked = likedIds.has(reply.id);
          return (
            <article
              key={reply.id}
              role="button"
              tabIndex={0}
              onClick={() => onSelect(reply.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onSelect(reply.id);
                }
              }}
              className="snap-start shrink-0 w-[78%] sm:w-[260px] p-3.5 rounded-2xl bg-surface border border-border hover:border-accent/60 cursor-pointer transition-colors flex flex-col gap-2.5"
            >
              <div className="flex items-center gap-2 min-w-0">
                <img
                  src={reply.avatar_url || '/assets/net/default-perfil'}
                  alt={reply.author_name || 'Autor'}
                  className="w-7 h-7 rounded-full object-cover border border-border shrink-0"
                />
                <div className="min-w-0 leading-tight">
                  <p className="text-xs font-bold text-primary truncate">
                    {reply.author_name || 'Membro'}
                  </p>
                  <p className="text-[11px] text-muted truncate">
                    @{reply.author_handle || 'membro'} · {formatRelativeTime(reply.created_at)}
                  </p>
                </div>
              </div>

              <p className="text-sm text-primary leading-relaxed break-words line-clamp-4 flex-1">
                {reply.content ||
                  (reply.spotify_track_id ? (
                    <span className="inline-flex items-center gap-1.5 text-secondary">
                      <Music className="w-3.5 h-3.5 text-[#1DB954]" /> Compartilhou uma faixa
                    </span>
                  ) : null)}
              </p>

              <div className="flex items-center gap-4 text-xs text-secondary">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleLike(reply.id);
                  }}
                  aria-label={liked ? 'Descurtir' : 'Curtir'}
                  className={`flex items-center gap-1 transition-colors ${
                    liked ? 'text-rose-500' : 'hover:text-rose-500'
                  }`}
                >
                  <Heart className={`w-3.5 h-3.5 ${liked ? 'fill-rose-500' : ''}`} />
                  <span>{reply.likes_count || 0}</span>
                </button>
                <span className="flex items-center gap-1">
                  <MessageCircle className="w-3.5 h-3.5" />
                  <span>{reply.descendantsCount}</span>
                </span>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
