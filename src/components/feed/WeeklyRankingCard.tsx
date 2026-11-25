'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Crown, Trophy, TrendingUp, TrendingDown, Sparkles, Minus, X } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { headline, isSundayInBrazil, movement, TZ, type WeeklyRanking } from '@/lib/weeklyRanking';

const MEDAL = ['text-amber-400', 'text-slate-300', 'text-orange-400'];

/**
 * Card do ranking semanal de contribuição. Aparece no feed aos domingos
 * (ou com ?ranking=preview na URL para conferir em outro dia).
 */
export function WeeklyRankingCard() {
  const [data, setData] = useState<WeeklyRanking | null>(null);
  const [hidden, setHidden] = useState(false);

  const weekKey = new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date());

  useEffect(() => {
    const preview = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('ranking') === 'preview';
    if (!preview && !isSundayInBrazil()) return;
    try {
      if (!preview && localStorage.getItem('insight-weekly-ranking-closed') === weekKey) return;
    } catch {
      /* segue */
    }
    let alive = true;
    createClient()
      .rpc('weekly_contribution_ranking')
      .then(({ data: res }) => {
        if (alive && res && Array.isArray((res as WeeklyRanking).top) && (res as WeeklyRanking).top.length) {
          setData(res as WeeklyRanking);
        }
      });
    return () => {
      alive = false;
    };
  }, [weekKey]);

  if (!data || hidden) return null;
  const title = headline(data);

  return (
    <section
      aria-label="Ranking semanal de contribuição"
      className="mx-4 sm:mx-6 my-4 rounded-2xl border border-amber-400/30 bg-gradient-to-br from-amber-400/10 via-surface to-fuchsia-500/10 p-4 sm:p-5 relative overflow-hidden"
    >
      <button
        type="button"
        aria-label="Fechar ranking"
        onClick={() => {
          setHidden(true);
          try {
            localStorage.setItem('insight-weekly-ranking-closed', weekKey);
          } catch {
            /* modo privado */
          }
        }}
        className="absolute top-3 right-3 p-1 rounded-md text-muted hover:text-primary"
      >
        <X className="w-4 h-4" />
      </button>

      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-400 flex items-center gap-1.5">
        <Trophy className="w-3.5 h-3.5" /> Ranking de contribuição · domingo
      </p>
      {title && <h3 className="mt-1.5 pr-6 text-base sm:text-lg font-extrabold text-primary leading-snug">{title}</h3>}

      <ol className="mt-4 space-y-2">
        {data.top.map((r) => {
          const mv = movement(r);
          const MvIcon = mv.dir === 'up' ? TrendingUp : mv.dir === 'down' ? TrendingDown : mv.dir === 'new' ? Sparkles : Minus;
          const person = (
            <span className="flex items-center gap-2.5 min-w-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={r.avatar_url || '/assets/net/default-perfil'} alt="" className="w-8 h-8 rounded-full object-cover border border-border bg-elevated shrink-0" />
              <span className="min-w-0">
                <span className="block text-sm font-bold text-primary truncate">{r.name}</span>
                <span
                  className={`flex items-center gap-1 text-[11px] ${
                    mv.dir === 'up' ? 'text-emerald-400' : mv.dir === 'down' ? 'text-rose-400' : mv.dir === 'new' ? 'text-fuchsia-400' : 'text-muted'
                  }`}
                >
                  <MvIcon className="w-3 h-3" /> {mv.text}
                </span>
              </span>
            </span>
          );
          return (
            <li key={r.key} className="flex items-center justify-between gap-3 rounded-xl bg-background/40 border border-border/60 px-3 py-2">
              <span className="flex items-center gap-3 min-w-0">
                <span className={`w-6 text-center font-black ${MEDAL[r.rank - 1] || 'text-muted'}`}>
                  {r.rank === 1 ? <Crown className="w-5 h-5 inline" /> : `${r.rank}º`}
                </span>
                {r.username ? (
                  <Link href={`/u/${encodeURIComponent(r.username)}`} className="min-w-0 hover:opacity-90">
                    {person}
                  </Link>
                ) : (
                  person
                )}
              </span>
              <span className="text-xs font-mono font-bold text-accent shrink-0">{r.points} pts</span>
            </li>
          );
        })}
      </ol>

      <Link href="/apoie" className="mt-3 inline-block text-xs font-bold text-accent hover:underline">
        Ver ranking completo e apoiar →
      </Link>
    </section>
  );
}
