'use client';

import { InsightIcon } from '@/components/icons/InsightIcon';
import { useState } from 'react';
import { Heart, EyeOff, Share2, Newspaper, Plus, Check } from 'lucide-react';
import { TOPIC_BY_ID } from '@/lib/news/topics';
import { PostTime } from '@/components/feed/PostTime';
import { trackNews, type NewsItem } from './useNews';

function sourceColor(name: string) {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) % 360;
  return `hsl(${h} 55% 45%)`;
}

/**
 * Cartão de notícia (diferente de um post): fonte, imagem, título, resumo,
 * temas e ações que alimentam o algoritmo (abrir, curtir, ocultar).
 */
export function NewsCard({
  item,
  onPatch,
  follows,
  onToggleFollow,
  compact = false,
}: {
  item: NewsItem;
  onPatch: (id: string, p: Partial<NewsItem> | null) => void;
  follows?: Set<string>;
  onToggleFollow?: (topic: string) => void;
  compact?: boolean;
}) {
  const [imgOk, setImgOk] = useState(true);
  const [hidden, setHidden] = useState(false);
  const mainTopic = item.topics.map((t) => TOPIC_BY_ID.get(t)).find(Boolean);
  const suggestFollow = follows && onToggleFollow && mainTopic && !follows.has(mainTopic.id);

  if (hidden) {
    return (
      <div className="px-4 sm:px-6 py-3 border-b border-border text-xs text-muted flex items-center justify-between gap-2">
        <span>Ok — vamos mostrar menos notícias assim.</span>
        <button
          type="button"
          className="font-bold text-secondary hover:text-primary"
          onClick={() => {
            setHidden(false);
            void trackNews(item.id, 'hide', false);
          }}
        >
          Desfazer
        </button>
      </div>
    );
  }

  return (
    <article className="px-4 sm:px-6 py-4 lg:py-6 border-b border-border hover:bg-surface/30 transition-colors lg:flex lg:gap-6">
      {/* PC: mídia grande à esquerda (imagem ou capa com o tema) */}
      {!compact && (
        <a
          href={item.url}
          target="_blank"
          rel="noopener noreferrer nofollow"
          tabIndex={-1}
          aria-hidden="true"
          onClick={() => void trackNews(item.id, 'open')}
          className="hidden lg:block shrink-0 w-64 xl:w-72 aspect-[16/10] rounded-2xl overflow-hidden border border-border bg-elevated"
        >
          {item.image_url && imgOk ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={item.image_url}
              alt=""
              loading="lazy"
              referrerPolicy="no-referrer"
              onError={() => setImgOk(false)}
              className="w-full h-full object-cover transition-transform duration-300 hover:scale-[1.03]"
            />
          ) : (
            <span
              className="w-full h-full flex flex-col items-center justify-center gap-2 text-white"
              style={{
                background: `linear-gradient(140deg, ${mainTopic?.color || sourceColor(item.source_name)}, color-mix(in srgb, ${mainTopic?.color || '#334155'} 35%, #0b0b0f))`,
              }}
            >
              <InsightIcon name={mainTopic?.id || 'newspaper'} className="w-10 h-10 drop-shadow" />
              <span className="text-xs font-bold tracking-wide opacity-90">{item.source_name}</span>
            </span>
          )}
        </a>
      )}
      <div className="flex-1 min-w-0 lg:flex lg:flex-col">
      <div className="flex items-center gap-2 text-[11px] lg:text-xs text-muted mb-2 min-w-0">
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-sky-500/10 text-sky-400 font-bold uppercase tracking-wider text-[9px] shrink-0">
          <Newspaper className="w-3 h-3" /> Notícia
        </span>
        <span
          className="w-4 h-4 rounded grid place-items-center text-[9px] font-black text-white shrink-0"
          style={{ background: sourceColor(item.source_name) }}
          aria-hidden="true"
        >
          {item.source_name.slice(0, 1).toUpperCase()}
        </span>
        <span className="font-semibold text-secondary truncate">{item.source_name}</span>
        <span aria-hidden="true">·</span>
        <PostTime iso={item.published_at} className="truncate" />
      </div>

      <a
        href={item.url}
        target="_blank"
        rel="noopener noreferrer nofollow"
        onClick={() => {
          if (!item.seen) onPatch(item.id, { seen: true });
          void trackNews(item.id, 'open');
        }}
        className="group flex gap-3 sm:gap-4"
      >
        <div className="flex-1 min-w-0">
          <h3 className={`font-extrabold text-primary leading-snug group-hover:text-accent transition-colors ${compact ? 'text-sm' : 'text-[15px] sm:text-base lg:text-xl lg:leading-tight'} ${item.seen ? 'opacity-75' : ''}`}>
            {item.title}
          </h3>
          {item.summary && !compact && (
            <p className="mt-1 lg:mt-2 text-[13px] lg:text-[15px] text-secondary leading-relaxed line-clamp-2 lg:line-clamp-3">{item.summary}</p>
          )}
          {!compact && (
            <span className="hidden lg:inline-flex mt-2 text-xs font-bold text-accent group-hover:underline underline-offset-2">
              Ler no {item.source_name} ↗
            </span>
          )}
        </div>
        {item.image_url && imgOk && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.image_url}
            alt=""
            loading="lazy"
            referrerPolicy="no-referrer"
            onError={() => setImgOk(false)}
            className={`shrink-0 rounded-xl object-cover bg-elevated border border-border ${compact ? 'w-20 h-16' : 'w-24 h-20 sm:w-32 sm:h-24 lg:hidden'}`}
          />
        )}
      </a>

      <div className="mt-2.5 lg:mt-auto lg:pt-3 flex items-center gap-1.5 flex-wrap">
        {item.topics.slice(0, 3).map((t, idx) => {
          const topic = TOPIC_BY_ID.get(t);
          if (!topic) return null;
          return (
            <span key={t} className={`${idx > 0 ? 'hidden sm:inline-flex' : 'inline-flex'} px-2 py-0.5 rounded-full text-[10px] font-semibold border border-border text-secondary`}>
              <InsightIcon name={topic.id} className="w-3 h-3 mr-1" /> {topic.label}
            </span>
          );
        })}
        {suggestFollow && (
          <button
            type="button"
            onClick={() => onToggleFollow!(mainTopic!.id)}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold text-accent bg-accent/10 hover:bg-accent/20"
          >
            <Plus className="w-3 h-3" /> Seguir {mainTopic!.label}
          </button>
        )}
        {follows && mainTopic && follows.has(mainTopic.id) && onToggleFollow && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold text-emerald-400">
            <Check className="w-3 h-3" /> Você segue
          </span>
        )}
        <div className="ml-auto flex items-center gap-0.5 shrink-0">
        <button
          type="button"
          aria-label={item.liked ? 'Descurtir' : 'Curtir'}
          aria-pressed={item.liked}
          onClick={() => {
            const on = !item.liked;
            onPatch(item.id, { liked: on, like_count: Math.max(0, item.like_count + (on ? 1 : -1)) });
            void trackNews(item.id, 'like', on);
          }}
          className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs transition-colors ${
            item.liked ? 'text-rose-500' : 'text-muted hover:text-rose-500'
          }`}
        >
          <Heart className={`w-4 h-4 ${item.liked ? 'fill-rose-500' : ''}`} />
          {item.like_count > 0 && <span className="font-mono text-[11px]">{item.like_count}</span>}
        </button>
        <button
          type="button"
          aria-label="Compartilhar"
          onClick={async () => {
            try {
              if (navigator.share) await navigator.share({ title: item.title, url: item.url });
              else {
                await navigator.clipboard.writeText(item.url);
                alert('Link copiado!');
              }
            } catch {
              /* cancelado */
            }
          }}
          className="p-1.5 rounded-full text-muted hover:text-primary"
        >
          <Share2 className="w-4 h-4" />
        </button>
        <button
          type="button"
          aria-label="Não tenho interesse"
          title="Não tenho interesse"
          onClick={() => {
            setHidden(true);
            void trackNews(item.id, 'hide');
          }}
          className="p-1.5 rounded-full text-muted hover:text-primary"
        >
          <EyeOff className="w-4 h-4" />
        </button>
        </div>
      </div>
      </div>
    </article>
  );
}
