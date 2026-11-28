'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Heart, X } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

const SEEN_KEY = 'insight-donor-thanks-seen';
/** a faixa só aparece nas 24 horas seguintes à contribuição */
const WINDOW_MS = 24 * 60 * 60 * 1000;

interface Thanks {
  id: string;
  name: string;
  username: string | null;
}

function readSeen(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(SEEN_KEY) || '[]');
    return Array.isArray(v) ? v.map(String) : [];
  } catch {
    return [];
  }
}

/**
 * Faixa no topo do feed agradecendo a doação mais recente, só nas 24 horas
 * seguintes à contribuição.
 * Cada pessoa vê o agradecimento de cada doação uma única vez.
 */
export function DonorThanksBar() {
  const [thanks, setThanks] = useState<Thanks | null>(null);

  useEffect(() => {
    let alive = true;
    const supabase = createClient();
    const since = new Date(Date.now() - WINDOW_MS).toISOString();
    (async () => {
      const { data } = await supabase
        .from('donations')
        .select('id, donor_name, profile_id, created_at')
        .eq('status', 'approved')
        .gte('created_at', since)
        .order('created_at', { ascending: false })
        .limit(5);
      const seen = new Set(readSeen());
      const next = (data || []).find((d) => !seen.has(String(d.id)));
      if (!next || !alive) return;

      let name = (next.donor_name || '').trim();
      let username: string | null = null;
      if (next.profile_id) {
        const { data: prof } = await supabase
          .from('profiles')
          .select('display_name, full_name, username')
          .eq('id', next.profile_id)
          .maybeSingle();
        if (prof) {
          name = prof.display_name || prof.full_name || prof.username || name;
          username = prof.username || null;
        }
      }
      if (!alive) return;
      setThanks({ id: String(next.id), name: name.split(/\s+/).slice(0, 2).join(' ') || 'um apoiador', username });
      // conta como visto já na exibição (aparece uma vez só)
      try {
        localStorage.setItem(SEEN_KEY, JSON.stringify([String(next.id), ...readSeen()].slice(0, 50)));
      } catch {
        /* modo privado */
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  if (!thanks) return null;

  const who = thanks.username ? (
    <Link href={`/u/${encodeURIComponent(thanks.username)}`} className="font-extrabold underline-offset-2 hover:underline">
      {thanks.name}
    </Link>
  ) : (
    <span className="font-extrabold">{thanks.name}</span>
  );

  return (
    <div
      role="status"
      className="relative overflow-hidden border-b border-rose-500/30 bg-gradient-to-r from-rose-500/15 via-fuchsia-500/10 to-amber-400/15 px-4 sm:px-6 py-2.5 flex items-center gap-3 animate-in fade-in slide-in-from-top-2 duration-500"
    >
      <Heart className="w-4 h-4 text-rose-500 fill-rose-500 shrink-0 animate-pulse" />
      <p className="flex-1 min-w-0 text-xs sm:text-sm text-primary leading-snug">
        Obrigado, {who}, por apoiar o Insight! Cada doação mantém a comunidade no ar.{' '}
        <Link href="/apoie" className="text-accent font-bold hover:underline whitespace-nowrap">
          Apoie também
        </Link>
      </p>
      <button
        type="button"
        aria-label="Fechar agradecimento"
        onClick={() => setThanks(null)}
        className="p-1 rounded-md text-muted hover:text-primary shrink-0"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
