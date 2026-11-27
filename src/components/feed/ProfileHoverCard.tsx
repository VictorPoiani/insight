'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { useNitro } from '@/components/nitro/NitroProvider';
import { CosmeticAvatar, CosmeticName, CosmeticTag } from '@/components/nitro/Cosmetics';
import { VerifiedBadge } from '@/components/account/VerifiedBadge';
import { usePresence, lastSeenLabel } from '@/components/presence/PresenceProvider';
import { loginHref } from '@/lib/account/loginRedirect';
import type { Profile } from '@/types/database';

type Stats = { followers: number; following: number; iFollow: boolean };
const statsCache = new Map<string, Stats>(); // chave: viewer:perfil

const OPEN_DELAY = 450;
const CLOSE_DELAY = 180;

/**
 * Card do perfil ao passar o mouse no autor (só em telas com mouse): bio,
 * seguidores e botão Seguir sem sair do feed. Os selos e cosméticos do Nitro
 * ganham espaço aqui, sem pesar no cabeçalho do post.
 */
export function ProfileHoverCard({ profile, children }: { profile: Profile; children: React.ReactNode }) {
  const { viewer } = useNitro();
  const { isOnline } = usePresence();
  const [open, setOpen] = useState(false);
  const [stats, setStats] = useState<Stats | null>(null);
  const [busy, setBusy] = useState(false);
  const [placeAbove, setPlaceAbove] = useState(false);
  const wrapRef = useRef<HTMLSpanElement>(null);
  const openT = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeT = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cacheKey = `${viewer?.id || 'anon'}:${profile.id}`;
  const isMe = viewer?.id === profile.id;

  const clear = () => {
    if (openT.current) clearTimeout(openT.current);
    if (closeT.current) clearTimeout(closeT.current);
  };
  useEffect(() => clear, []);

  const show = (e: React.PointerEvent) => {
    if (e.pointerType !== 'mouse') return; // no toque o link abre o perfil normalmente
    clear();
    openT.current = setTimeout(() => {
      const r = wrapRef.current?.getBoundingClientRect();
      setPlaceAbove(Boolean(r && window.innerHeight - r.bottom < 280 && r.top > 300));
      setOpen(true);
    }, OPEN_DELAY);
  };
  const hide = () => {
    clear();
    closeT.current = setTimeout(() => setOpen(false), CLOSE_DELAY);
  };

  useEffect(() => {
    if (!open) return;
    const hit = statsCache.get(cacheKey);
    if (hit) {
      setStats(hit);
      return;
    }
    let alive = true;
    const supabase = createClient();
    void (async () => {
      const [followers, following, mine] = await Promise.all([
        supabase.from('follows').select('*', { count: 'exact', head: true }).eq('following_id', profile.id),
        supabase.from('follows').select('*', { count: 'exact', head: true }).eq('follower_id', profile.id),
        viewer && !isMe
          ? supabase.from('follows').select('follower_id').eq('follower_id', viewer.id).eq('following_id', profile.id).maybeSingle()
          : Promise.resolve({ data: null }),
      ]);
      const s: Stats = {
        followers: Math.max(followers.count || 0, Number(profile.followers_count) || 0),
        following: following.count || 0,
        iFollow: Boolean(mine.data),
      };
      statsCache.set(cacheKey, s);
      if (alive) setStats(s);
    })();
    return () => {
      alive = false;
    };
  }, [open, cacheKey, profile.id, profile.followers_count, viewer, isMe]);

  async function toggleFollow() {
    if (!viewer) {
      window.location.href = loginHref();
      return;
    }
    if (!stats || busy || isMe) return;
    setBusy(true);
    const supabase = createClient();
    const next = !stats.iFollow;
    const optimistic = { ...stats, iFollow: next, followers: Math.max(0, stats.followers + (next ? 1 : -1)) };
    setStats(optimistic);
    const { error } = next
      ? await supabase.from('follows').insert({ follower_id: viewer.id, following_id: profile.id })
      : await supabase.from('follows').delete().eq('follower_id', viewer.id).eq('following_id', profile.id);
    if (error && !/duplicate/i.test(error.message)) setStats(stats);
    else statsCache.set(cacheKey, optimistic);
    setBusy(false);
  }

  const name = profile.display_name || profile.full_name || profile.username;
  const href = `/u/${encodeURIComponent(profile.username)}`;
  const online = isOnline(profile.id, profile.last_seen_at);

  return (
    <span ref={wrapRef} className="relative inline-flex min-w-0" onPointerEnter={show} onPointerLeave={hide}>
      {children}
      {open && (
        <div
          role="dialog"
          aria-label={`Perfil de ${name}`}
          onPointerEnter={clear}
          onPointerLeave={hide}
          onClick={(e) => e.stopPropagation()}
          className={`absolute left-0 z-50 w-72 rounded-2xl bg-background border border-border shadow-2xl p-4 text-left cursor-default ${
            placeAbove ? 'bottom-full mb-2' : 'top-full mt-2'
          }`}
        >
          <div className="flex items-start justify-between gap-3">
            <Link href={href} className="shrink-0">
              <CosmeticAvatar profile={profile} size={56}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={profile.avatar_url || '/assets/net/default-perfil'}
                  alt={name}
                  className="w-14 h-14 rounded-full object-cover border border-border bg-elevated"
                />
              </CosmeticAvatar>
            </Link>
            {!isMe && (
              <button
                type="button"
                onClick={() => void toggleFollow()}
                disabled={busy || !stats}
                className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-colors disabled:opacity-60 ${
                  stats?.iFollow
                    ? 'border border-border text-primary hover:border-danger hover:text-danger'
                    : 'bg-primary text-background hover:opacity-90'
                }`}
              >
                {stats?.iFollow ? 'Seguindo' : 'Seguir'}
              </button>
            )}
          </div>

          <Link href={href} className="mt-2.5 block min-w-0 group/hc">
            <span className="flex items-center gap-1.5 min-w-0">
              <span className="text-[15px] font-bold text-primary truncate group-hover/hc:underline">
                <CosmeticName profile={profile}>{name}</CosmeticName>
              </span>
              {profile.email_verified_at && <VerifiedBadge size={14} />}
            </span>
            <span className="block text-xs text-muted truncate">@{profile.username}</span>
          </Link>

          <div className="mt-1.5">
            <CosmeticTag profile={profile} />
          </div>

          {profile.bio && <p className="mt-2 text-[13px] text-secondary leading-snug line-clamp-3 break-words">{profile.bio}</p>}

          <div className="mt-3 flex items-center gap-4 text-xs text-secondary">
            <span>
              <span className="font-bold text-primary tabular-nums">{stats ? stats.followers : '–'}</span> seguidores
            </span>
            <span>
              <span className="font-bold text-primary tabular-nums">{stats ? stats.following : '–'}</span> seguindo
            </span>
          </div>
          <p className="mt-2 text-[11px] text-muted flex items-center gap-1.5">
            <span className={`w-1.5 h-1.5 rounded-full ${online ? 'bg-emerald-500' : 'bg-muted/50'}`} />
            {online ? 'Online agora' : lastSeenLabel(profile.last_seen_at)}
          </p>
        </div>
      )}
    </span>
  );
}
