'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { X, Loader2, Search, UserCheck, UserPlus } from '@/components/icons';
import { createClient } from '@/lib/supabase/client';
import type { Profile } from '@/types/database';
import { CosmeticAvatar, CosmeticName } from '@/components/nitro/Cosmetics';

export type FollowTab = 'followers' | 'following' | 'mutual';

type Row = Pick<
  Profile,
  'id' | 'username' | 'display_name' | 'full_name' | 'avatar_url' | 'role' | 'cosmetics' | 'contributor_level' | 'nitro_status' | 'nitro_expires_at' | 'has_lifetime_nitro'
>;

const COLS = 'id, username, display_name, full_name, avatar_url, role, cosmetics, contributor_level, nitro_status, nitro_expires_at, has_lifetime_nitro';

/**
 * Lista de quem segue e de quem é seguido por um perfil, com "segue você" e
 * botão de seguir de volta para quem está logado.
 */
export function FollowListModal({
  profileId,
  profileName,
  viewerId,
  initialTab,
  onClose,
  onViewerFollowChange,
}: {
  profileId: string;
  profileName: string;
  viewerId: string | null;
  initialTab: FollowTab;
  onClose: () => void;
  /** avisa o perfil quando quem está logado segue/deixa de seguir alguém da lista */
  onViewerFollowChange?: () => void;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [tab, setTab] = useState<FollowTab>(initialTab);
  const [followers, setFollowers] = useState<string[]>([]);
  const [following, setFollowing] = useState<string[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Row>>({});
  // quem o visitante logado segue / quem segue o visitante
  const [viewerFollows, setViewerFollows] = useState<Set<string>>(new Set());
  const [followsViewer, setFollowsViewer] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      const [{ data: fr }, { data: fg }] = await Promise.all([
        supabase.from('follows').select('follower_id').eq('following_id', profileId).limit(2000),
        supabase.from('follows').select('following_id').eq('follower_id', profileId).limit(2000),
      ]);
      const followerIds = (fr || []).map((r: { follower_id: string }) => r.follower_id);
      const followingIds = (fg || []).map((r: { following_id: string }) => r.following_id);
      const ids = Array.from(new Set([...followerIds, ...followingIds]));

      const map: Record<string, Row> = {};
      for (let i = 0; i < ids.length; i += 200) {
        const { data } = await supabase.from('profiles').select(COLS).in('id', ids.slice(i, i + 200));
        (data || []).forEach((p) => (map[(p as Row).id] = p as Row));
      }

      let vf = new Set<string>();
      let fv = new Set<string>();
      if (viewerId && ids.length) {
        const [{ data: a }, { data: b }] = await Promise.all([
          supabase.from('follows').select('following_id').eq('follower_id', viewerId).in('following_id', ids.slice(0, 1000)),
          supabase.from('follows').select('follower_id').eq('following_id', viewerId).in('follower_id', ids.slice(0, 1000)),
        ]);
        vf = new Set((a || []).map((r: { following_id: string }) => r.following_id));
        fv = new Set((b || []).map((r: { follower_id: string }) => r.follower_id));
      }
      if (!alive) return;
      setFollowers(followerIds.filter((id) => map[id]));
      setFollowing(followingIds.filter((id) => map[id]));
      setProfiles(map);
      setViewerFollows(vf);
      setFollowsViewer(fv);
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [profileId, viewerId, supabase]);

  const followerSet = useMemo(() => new Set(followers), [followers]);
  const mutual = useMemo(() => following.filter((id) => followerSet.has(id)), [following, followerSet]);
  const list = tab === 'followers' ? followers : tab === 'following' ? following : mutual;
  const qq = q.trim().toLowerCase();
  const shown = list
    .map((id) => profiles[id])
    .filter((p): p is Row => !!p)
    .filter((p) => !qq || [p.username, p.display_name, p.full_name].some((v) => v?.toLowerCase().includes(qq)));

  async function toggleFollow(id: string) {
    if (!viewerId) {
      window.location.href = '/login';
      return;
    }
    setBusy(id);
    const isOn = viewerFollows.has(id);
    const { error } = isOn
      ? await supabase.from('follows').delete().eq('follower_id', viewerId).eq('following_id', id)
      : await supabase.from('follows').insert({ follower_id: viewerId, following_id: id });
    setBusy(null);
    if (error) return;
    setViewerFollows((prev) => {
      const n = new Set(prev);
      if (isOn) n.delete(id);
      else n.add(id);
      return n;
    });
    onViewerFollowChange?.();
  }

  const tabs: { id: FollowTab; label: string; count: number }[] = [
    { id: 'followers', label: 'Seguidores', count: followers.length },
    { id: 'following', label: 'Seguindo', count: following.length },
    { id: 'mutual', label: 'Seguem de volta', count: mutual.length },
  ];

  return (
    <div className="fixed inset-0 z-[90] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Conexões de ${profileName}`}
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-md max-h-[85vh] flex flex-col rounded-t-3xl sm:rounded-3xl bg-surface border border-border shadow-2xl overflow-hidden"
      >
        <div className="flex items-center justify-between px-5 pt-4 pb-2">
          <p className="font-extrabold text-primary truncate">{profileName}</p>
          <button type="button" onClick={onClose} aria-label="Fechar" className="p-1.5 rounded-full hover:bg-elevated text-muted">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="grid grid-cols-3 border-b border-border text-xs font-bold">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`relative py-3 ${tab === t.id ? 'text-primary' : 'text-secondary hover:text-primary'}`}
            >
              {t.label} <span className="font-mono text-muted">{loading ? '' : t.count}</span>
              {tab === t.id && <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-14 h-[2.5px] rounded-full bg-accent" />}
            </button>
          ))}
        </div>
        <div className="px-4 py-2.5">
          <label className="flex items-center gap-2 h-9 px-3 rounded-full bg-background border border-border focus-within:border-accent">
            <Search className="w-3.5 h-3.5 text-muted" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar" className="flex-1 bg-transparent text-sm outline-none" />
          </label>
        </div>
        <div className="flex-1 overflow-y-auto px-2 pb-4">
          {loading ? (
            <div className="py-10 grid place-items-center">
              <Loader2 className="w-5 h-5 animate-spin text-muted" />
            </div>
          ) : shown.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted">
              {tab === 'mutual' ? 'Ninguém se segue de volta ainda.' : tab === 'followers' ? 'Nenhum seguidor ainda.' : 'Não segue ninguém ainda.'}
            </p>
          ) : (
            shown.map((p) => {
              const name = p.display_name || p.full_name || p.username;
              const isMe = viewerId === p.id;
              const iFollow = viewerFollows.has(p.id);
              const followsMe = followsViewer.has(p.id);
              return (
                <div key={p.id} className="flex items-center gap-3 px-3 py-2.5 rounded-2xl hover:bg-elevated/60">
                  <Link href={`/u/${encodeURIComponent(p.username)}`} onClick={onClose} className="flex items-center gap-3 flex-1 min-w-0">
                    <CosmeticAvatar profile={p} size={40}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={p.avatar_url || '/assets/net/default-perfil'} alt="" className="w-10 h-10 rounded-full object-cover bg-elevated" />
                    </CosmeticAvatar>
                    <span className="min-w-0">
                      <span className="block text-sm font-bold text-primary truncate">
                        <CosmeticName profile={p}>{name}</CosmeticName>
                      </span>
                      <span className="flex items-center gap-1.5 text-[11px] text-muted truncate">
                        @{p.username}
                        {followsMe && !isMe && (
                          <span className="px-1.5 py-px rounded bg-elevated text-[10px] font-semibold text-secondary">Segue você</span>
                        )}
                      </span>
                    </span>
                  </Link>
                  {!isMe && viewerId && (
                    <button
                      type="button"
                      disabled={busy === p.id}
                      onClick={() => void toggleFollow(p.id)}
                      className={`shrink-0 inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold transition-colors disabled:opacity-50 ${
                        iFollow ? 'bg-elevated border border-border text-secondary hover:text-danger' : 'bg-accent text-white hover:bg-accent-hover'
                      }`}
                    >
                      {busy === p.id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : iFollow ? (
                        <>
                          <UserCheck className="w-3.5 h-3.5" /> Seguindo
                        </>
                      ) : (
                        <>
                          <UserPlus className="w-3.5 h-3.5" /> {followsMe ? 'Seguir de volta' : 'Seguir'}
                        </>
                      )}
                    </button>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
