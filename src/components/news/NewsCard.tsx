'use client';

import { useState } from 'react';
import { Heart, EyeOff, Share2 } from 'lucide-react';
import { decodeEntities } from '@/lib/news/rss';
import { TOPIC_BY_ID } from '@/lib/news/topics';
import { PostTime } from '@/components/feed/PostTime';
import { trackNews, type NewsItem } from './useNews';

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
      <div className="px-4 sm:px-5 py-3 border-b border-border text-xs text-muted flex items-center justify-between gap-2">
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

  // itens já gravados podem ter entidades cruas (&eacute;) de antes da correção do leitor
  const title = decodeEntities(item.title);
  const summary = item.summary ? decodeEntities(item.summary) : '';

  return (
    <article className="px-4 py-4 sm:px-5 sm:py-5 border-b border-border">
      {/* fonte · tema · hora — uma linha discreta, sem pílulas */}
      <div className="flex items-center gap-1.5 text-xs text-muted mb-1.5 min-w-0">
        <span className="font-semibold text-secondary truncate">{item.source_name}</span>
        {mainTopic && (
          <>
            <span aria-hidden="true">·</span>
            <span className="truncate">{mainTopic.label}</span>
          </>
        )}
        <span aria-hidden="true">·</span>
        <PostTime compact iso={item.published_at} className="shrink-0" />
      </div>

      <a
        href={item.url}
        target="_blank"
        rel="noopener noreferrer nofollow"
        onClick={() => {
          if (!item.seen) onPatch(item.id, { seen: true });
          void trackNews(item.id, 'open');
        }}
        className="group flex gap-4"
      >
        <div className="flex-1 min-w-0">
          <h3 className={`font-semibold text-primary leading-snug group-hover:underline underline-offset-2 decoration-1 ${compact ? 'text-sm' : 'text-[15px] sm:text-base'} ${item.seen ? 'text-secondary' : ''}`}>
            {title}
          </h3>
          {summary && !compact && (
            <p className="mt-1 text-sm text-secondary leading-relaxed line-clamp-2">{summary}</p>
          )}
        </div>
        {item.image_url && imgOk ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.image_url}
            alt=""
            loading="lazy"
            referrerPolicy="no-referrer"
            onError={() => setImgOk(false)}
            className={`shrink-0 rounded-lg object-cover bg-elevated ${compact ? 'w-20 h-16' : 'w-24 h-20 sm:w-32 sm:h-[5.5rem]'}`}
          />
        ) : null}
      </a>

      <div className="mt-2 -ml-2 flex items-center gap-1 text-[13px] text-muted tabular-nums">
        <button
          type="button"
          aria-label={item.liked ? 'Descurtir' : 'Curtir'}
          aria-pressed={item.liked}
          title="Curtir"
          onClick={() => {
            const on = !item.liked;
            onPatch(item.id, { liked: on, like_count: Math.max(0, item.like_count + (on ? 1 : -1)) });
            void trackNews(item.id, 'like', on);
          }}
          className={`flex items-center gap-1.5 px-2 py-1.5 rounded-full transition-colors ${
            item.liked ? 'text-rose-500' : 'hover:text-rose-500'
          }`}
        >
          <Heart className={`w-[18px] h-[18px] ${item.liked ? 'fill-rose-500' : ''}`} />
          {item.like_count > 0 && <span>{item.like_count}</span>}
        </button>
        {suggestFollow && (
          <button
            type="button"
            onClick={() => onToggleFollow!(mainTopic!.id)}
            className="px-2 py-1.5 rounded-full text-xs font-medium hover:text-accent transition-colors"
          >
            Seguir {mainTopic!.label}
          </button>
        )}
        <div className="ml-auto flex items-center gap-1">
          <button
            type="button"
            aria-label="Compartilhar"
            title="Compartilhar"
            onClick={async () => {
              try {
                if (navigator.share) await navigator.share({ title, url: item.url });
                else {
                  await navigator.clipboard.writeText(item.url);
                  alert('Link copiado!');
                }
              } catch {
                /* cancelado */
              }
            }}
            className="p-1.5 rounded-full hover:text-primary transition-colors"
          >
            <Share2 className="w-[18px] h-[18px]" />
          </button>
          <button
            type="button"
            aria-label="Não tenho interesse"
            title="Não tenho interesse"
            onClick={() => {
              setHidden(true);
              void trackNews(item.id, 'hide');
            }}
            className="p-1.5 rounded-full hover:text-primary transition-colors"
          >
            <EyeOff className="w-[18px] h-[18px]" />
          </button>
        </div>
      </div>
    </article>
  );
}
