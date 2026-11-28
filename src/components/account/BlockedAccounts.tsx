'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Ban, VolumeX } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { setProfileBlock, useMyBlocks } from '@/lib/blocks';
import { notify } from '@/lib/ui/feedback';

type Row = { id: string; username: string; name: string; avatar_url: string | null };

/** Configurações → contas silenciadas e bloqueadas, com "desfazer". */
export function BlockedAccounts({ viewerId }: { viewerId: string }) {
  const blocks = useMyBlocks(viewerId);
  const [people, setPeople] = useState<Record<string, Row>>({});
  const ids = Array.from(blocks.keys());
  const key = ids.sort().join(',');

  useEffect(() => {
    const missing = key ? key.split(',').filter((id) => !people[id]) : [];
    if (!missing.length) return;
    void createClient()
      .from('profiles')
      .select('id, username, display_name, full_name, avatar_url')
      .in('id', missing)
      .then(({ data }) => {
        const next: Record<string, Row> = {};
        for (const p of (data as { id: string; username: string; display_name: string | null; full_name: string | null; avatar_url: string | null }[]) || [])
          next[p.id] = { id: p.id, username: p.username, name: p.display_name || p.full_name || p.username, avatar_url: p.avatar_url };
        setPeople((prev) => ({ ...prev, ...next }));
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return (
    <div className="px-6 py-6 space-y-3">
      <h2 className="text-base font-extrabold text-primary">Contas silenciadas e bloqueadas</h2>
      <p className="text-xs text-secondary leading-relaxed">
        Silenciar esconde os posts da conta no seu feed. Bloquear também impede que ela siga você, responda ou reaja aos seus
        posts. Para silenciar ou bloquear, use o menu <strong className="text-primary">⋯</strong> de um post.
      </p>
      {ids.length === 0 ? (
        <p className="text-xs text-muted">Nenhuma conta silenciada ou bloqueada.</p>
      ) : (
        <ul className="divide-y divide-border rounded-xl border border-border">
          {ids.map((id) => {
            const p = people[id];
            const kind = blocks.get(id);
            return (
              <li key={id} className="flex items-center gap-3 px-3 py-2.5">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p?.avatar_url || '/assets/net/default-perfil'} alt="" className="w-8 h-8 rounded-full object-cover bg-elevated" />
                <div className="min-w-0 flex-1">
                  {p ? (
                    <Link href={`/u/${encodeURIComponent(p.username)}`} className="block text-sm font-semibold text-primary truncate hover:underline">
                      {p.name}
                    </Link>
                  ) : (
                    <span className="block h-3 w-24 rounded bg-elevated" />
                  )}
                  <span className="flex items-center gap-1 text-[11px] text-muted">
                    {kind === 'block' ? <Ban className="w-3 h-3" /> : <VolumeX className="w-3 h-3" />}
                    {kind === 'block' ? 'Bloqueada' : 'Silenciada'}
                    {p && ` · @${p.username}`}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={async () => {
                    const ok = await setProfileBlock(viewerId, id, null);
                    notify(ok ? `${p ? '@' + p.username : 'A conta'} voltou a aparecer no seu feed.` : 'Não foi possível desfazer agora.', ok ? 'success' : 'error');
                  }}
                  className="shrink-0 px-3 py-1.5 rounded-full border border-border text-xs font-semibold text-secondary hover:text-primary"
                >
                  {kind === 'block' ? 'Desbloquear' : 'Deixar de silenciar'}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
