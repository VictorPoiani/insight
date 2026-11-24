'use client';

import { useState } from 'react';
import { Check, Loader2, Plus, Sparkles } from '@/components/icons';
import { NEWS_TOPICS } from '@/lib/news/topics';
import { NewsCard } from './NewsCard';
import { useNewsFeed, useNewsFollows } from './useNews';

/** Chips de temas: tocar segue/deixa de seguir. */
export function NewsTopicPicker({
  follows,
  onToggle,
  title = 'Escolha os temas que você quer acompanhar',
  hint,
}: {
  follows: Set<string>;
  onToggle: (topic: string) => void;
  title?: string;
  hint?: string;
}) {
  return (
    <div className="space-y-2.5">
      <div>
        <p className="text-sm font-extrabold text-primary flex items-center gap-1.5">
          <Sparkles className="w-4 h-4 text-accent" /> {title}
        </p>
        {hint && <p className="text-[11px] text-muted">{hint}</p>}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {NEWS_TOPICS.map((t) => {
          const on = follows.has(t.id);
          return (
            <button
              key={t.id}
              type="button"
              aria-pressed={on}
              onClick={() => onToggle(t.id)}
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border transition-colors ${
                on ? 'text-white border-transparent' : 'border-border text-secondary hover:text-primary bg-background'
              }`}
              style={on ? { background: t.color } : undefined}
            >
              {on ? <Check className="w-3 h-3" /> : <Plus className="w-3 h-3 opacity-60" />}
              <span>{t.emoji}</span> {t.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Aba "Notícias": todos os temas, ranqueados pelo gosto da pessoa (temas
 * seguidos e o que ela abre/curte sobem; o que oculta desce).
 */
export function NewsFeed({ profileId }: { profileId: string | null }) {
  const [topic, setTopic] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const { follows, toggle } = useNewsFollows(profileId);
  const feed = useNewsFeed('all', { topic });

  return (
    <div>
      <div
        style={{ scrollbarWidth: 'none' }}
        className="px-4 sm:px-6 py-2.5 border-b border-border flex items-center gap-1.5 overflow-x-auto [&::-webkit-scrollbar]:hidden"
      >
        <button
          type="button"
          onClick={() => setTopic(null)}
          className={`shrink-0 px-3 py-1 rounded-full text-xs font-bold border ${!topic ? 'bg-accent text-white border-accent' : 'border-border text-secondary hover:text-primary'}`}
        >
          Em alta
        </button>
        {[...NEWS_TOPICS].sort((a, b) => Number(follows.has(b.id)) - Number(follows.has(a.id))).map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTopic(topic === t.id ? null : t.id)}
            className={`shrink-0 inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold border transition-colors ${
              topic === t.id ? 'text-white border-transparent' : 'border-border text-secondary hover:text-primary'
            }`}
            style={topic === t.id ? { background: t.color } : undefined}
          >
            <span>{t.emoji}</span> {t.label}
            {follows.has(t.id) && topic !== t.id && <span className="w-1.5 h-1.5 rounded-full bg-accent" aria-label="seguindo" />}
          </button>
        ))}
        {profileId && (
          <button
            type="button"
            onClick={() => setEditing((v) => !v)}
            className="shrink-0 px-3 py-1 rounded-full text-xs font-bold text-accent hover:bg-accent/10"
          >
            {editing ? 'Pronto' : 'Meus temas'}
          </button>
        )}
      </div>

      {editing && profileId && (
        <div className="px-4 sm:px-6 py-4 border-b border-border bg-surface/40">
          <NewsTopicPicker
            follows={follows}
            onToggle={(t) => void toggle(t)}
            hint="Notícias dos temas que você segue também aparecem no Para você. Aqui na aba Notícias aparece de tudo, com o que você gosta primeiro."
          />
        </div>
      )}

      {feed.items.map((n) => (
        <NewsCard key={n.id} item={n} onPatch={feed.patch} follows={profileId ? follows : undefined} onToggleFollow={(t) => void toggle(t)} />
      ))}

      {feed.loading && (
        <div className="py-10 grid place-items-center">
          <Loader2 className="w-5 h-5 animate-spin text-muted" />
        </div>
      )}
      {!feed.loading && feed.items.length === 0 && (
        <div className="py-16 px-6 text-center space-y-1">
          <p className="text-sm font-bold text-primary">Nenhuma notícia por aqui ainda</p>
          <p className="text-xs text-muted">As notícias são atualizadas a cada poucos minutos. Volte já já.</p>
        </div>
      )}
      {!feed.loading && feed.hasMore && feed.items.length > 0 && (
        <div className="py-6 grid place-items-center">
          <button
            type="button"
            onClick={() => void feed.loadMore()}
            className="px-4 py-2 rounded-full border border-border text-xs font-bold text-secondary hover:text-primary"
          >
            Carregar mais notícias
          </button>
        </div>
      )}
    </div>
  );
}
