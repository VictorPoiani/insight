'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { useNitro } from '@/components/nitro/NitroProvider';
import { CosmeticAvatar, CosmeticName, CosmeticTag } from '@/components/nitro/Cosmetics';
import { VerifiedBadge } from '@/components/account/VerifiedBadge';
import { loginHref } from '@/lib/account/loginRedirect';
import type { Profile } from '@/types/database';

type Mini = { id: string; username: string; name: string; avatar_url: string | null };
type Stats = { followers: number; following: number; iFollow: boolean; followedBy: Mini[]; followedByTotal: number };

const statsCache = new Map<string, Stats>(); // chave: viewer:perfil
let myFollowing: { viewer: string; ids: Promise<string[]> } | null = null; // quem eu sigo (uma consulta por sessão)

const OPEN_DELAY = 450;
const CLOSE_DELAY = 180;
const CARD_W = 320;

function getMyFollowing(viewerId: string): Promise<string[]> {
  if (myFollowing?.viewer === viewerId) return myFollowing.ids;
  const ids = (async () => {
    const { data } = await createClient().from('follows').select('following_id').eq('follower_id', viewerId);
    return ((data as { following_id: string }[]) || []).map((r) => r.following_id);
  })();
  myFollowing = { viewer: viewerId, ids };
  return ids;
}

/**
 * Card do perfil ao passar o mouse (só em telas com mouse): banner, bio,
 * seguidores/seguindo, "Seguido por" (quem você segue e segue a pessoa) e o
 * botão Seguir, sem sair da página. Desenhado por cima de tudo (portal), então
 * funciona também dentro de listas com rolagem, como o carrossel de membros.
 */
export function ProfileHoverCard({
  profile,
  children,
  className = 'inline-flex min-w-0',
  onFollowChange,
}: {
  profile: Profile;
  children: React.ReactNode;
  className?: string;
  /** avisa a página quando a pessoa segue/deixa de seguir pelo card */
  onFollowChange?: (following: boolean) => void;
}) {
  const { viewer } = useNitro();
  const [open, setOpen] = useState(false);
  const [stats, setStats] = useState<Stats | null>(null);
  const [busy, setBusy] = useState(false);
  const [pos, setPos] = useState<{ left: number; top: number; above: boolean } | null>(null);
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

  const place = () => {
    const r = wrapRef.current?.getBoundingClientRect();
    if (!r) return;
    const above = window.innerHeight - r.bottom < 340 && r.top > 360;
    const left = Math.max(8, Math.min(r.left, window.innerWidth - CARD_W - 8));
    setPos({ left, top: above ? r.top - 8 : r.bottom + 8, above });
  };

  const show = (e: React.PointerEvent) => {
    if (e.pointerType !== 'mouse') return; // no toque o link abre o perfil normalmente
    clear();
    openT.current = setTimeout(() => {
      place();
      setOpen(true);
    }, OPEN_DELAY);
  };
  const hide = () => {
    clear();
    closeT.current = setTimeout(() => setOpen(false), CLOSE_DELAY);
  };

  // fecha ao rolar (o card é fixo na tela)
  useLayoutEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    window.addEventListener('scroll', close, { passive: true, capture: true });
    window.addEventListener('resize', close);
    return () => {
      window.removeEventListener('scroll', close, { capture: true });
      window.removeEventListener('resize', close);
    };
  }, [open]);

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
      const [followers, following, mine, myIds] = await Promise.all([
        supabase.from('follows').select('*', { count: 'exact', head: true }).eq('following_id', profile.id),
        supabase.from('follows').select('*', { count: 'exact', head: true }).eq('follower_id', profile.id),
        viewer && !isMe
          ? supabase.from('follows').select('follower_id').eq('follower_id', viewer.id).eq('following_id', profile.id).maybeSingle()
          : Promise.resolve({ data: null }),
        viewer && !isMe ? getMyFollowing(viewer.id) : Promise.resolve([] as string[]),
      ]);

      // "Seguido por": quem eu sigo e também segue esta pessoa
      let followedBy: Mini[] = [];
      let followedByTotal = 0;
      const candidates = myIds.filter((id) => id !== profile.id);
      if (candidates.length) {
        const { data: rows } = await supabase
          .from('follows')
          .select('follower_id')
          .eq('following_id', profile.id)
          .in('follower_id', candidates.slice(0, 500));
        const ids = ((rows as { follower_id: string }[]) || []).map((r) => r.follower_id);
        followedByTotal = ids.length;
        if (ids.length) {
          const { data: profs } = await supabase
            .from('profiles')
            .select('id, username, display_name, full_name, avatar_url')
            .in('id', ids.slice(0, 3));
          followedBy = ((profs as { id: string; username: string; display_name: string | null; full_name: string | null; avatar_url: string | null }[]) || []).map((p) => ({
            id: p.id,
            username: p.username,
            name: p.display_name || p.full_name || p.username,
            avatar_url: p.avatar_url,
          }));
        }
      }

      const s: Stats = {
        followers: Math.max(followers.count || 0, Number(profile.followers_count) || 0),
        following: following.count || 0,
        iFollow: Boolean(mine.data),
        followedBy,
        followedByTotal,
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
    if (error && !/duplicate/i.test(error.message)) {
      setStats(stats);
    } else {
      statsCache.set(cacheKey, optimistic);
      myFollowing = null; // a lista de quem eu sigo mudou
      onFollowChange?.(next);
    }
    setBusy(false);
  }

  const name = profile.display_name || profile.full_name || profile.username;
  const href = `/u/${encodeURIComponent(profile.username)}`;
  const banner = profile.banner_url || profile.cover_url || null;

  const card =
    open && pos
      ? createPortal(
          <div
            role="dialog"
            aria-label={`Perfil de ${name}`}
            onPointerEnter={clear}
            onPointerLeave={hide}
            onClick={(e) => e.stopPropagation()}
            style={{ left: pos.left, top: pos.top, width: CARD_W, transform: pos.above ? 'translateY(-100%)' : undefined }}
            className="fixed z-[90] rounded-2xl bg-background border border-border shadow-2xl overflow-hidden text-left cursor-default"
          >
            {/* banner do perfil (ou faixa neutra) */}
            <div className="h-20 bg-elevated">
              {banner && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={banner} alt="" className="w-full h-full object-cover" />
              )}
            </div>

            <div className="px-4 pb-4">
              <div className="flex items-end justify-between gap-3 -mt-8">
                <Link href={href} className="shrink-0 rounded-full ring-4 ring-background">
                  <CosmeticAvatar profile={profile} size={64}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={profile.avatar_url || '/assets/net/default-perfil'}
                      alt={name}
                      className="w-16 h-16 rounded-full object-cover bg-elevated"
                    />
                  </CosmeticAvatar>
                </Link>
                {!isMe && (
                  <button
                    type="button"
                    onClick={() => void toggleFollow()}
                    disabled={busy || (!stats && Boolean(viewer))}
                    className={`mb-1 px-3.5 py-1.5 rounded-full text-xs font-bold transition-colors disabled:opacity-60 ${
                      stats?.iFollow
                        ? 'border border-border text-primary hover:border-danger hover:text-danger'
                        : 'bg-primary text-background hover:opacity-90'
                    }`}
                  >
                    {stats?.iFollow ? 'Seguindo' : 'Seguir'}
                  </button>
                )}
              </div>

              <Link href={href} className="mt-2 block min-w-0 group/hc">
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
                  <span className="font-bold text-primary tabular-nums">{stats ? stats.following : '–'}</span> seguindo
                </span>
                <span>
                  <span className="font-bold text-primary tabular-nums">{stats ? stats.followers : '–'}</span>{' '}
                  {stats?.followers === 1 ? 'seguidor' : 'seguidores'}
                </span>
              </div>

              {stats && stats.followedByTotal > 0 && (
                <div className="mt-3 flex items-center gap-2 text-xs text-secondary min-w-0">
                  <span className="flex -space-x-1.5 shrink-0">
                    {stats.followedBy.map((p) => (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img key={p.id} src={p.avatar_url || '/assets/net/default-perfil'} alt="" className="w-5 h-5 rounded-full object-cover ring-2 ring-background bg-elevated" />
                    ))}
                  </span>
                  <span className="leading-snug line-clamp-2">
                    Seguido por{' '}
                    {stats.followedBy.slice(0, 2).map((p, i) => (
                      <span key={p.id}>
                        {i > 0 && (stats.followedByTotal === 2 ? ' e ' : ', ')}
                        <span className="font-semibold text-primary">{p.name}</span>
                      </span>
                    ))}
                    {stats.followedByTotal > 2 && (
                      <>
                        {' '}e mais <span className="font-semibold text-primary">{stats.followedByTotal - 2}</span> que você segue
                      </>
                    )}
                  </span>
                </div>
              )}
            </div>
          </div>,
          document.body
        )
      : null;

  return (
    <span ref={wrapRef} className={className} onPointerEnter={show} onPointerLeave={hide}>
      {children}
      {card}
    </span>
  );
}
