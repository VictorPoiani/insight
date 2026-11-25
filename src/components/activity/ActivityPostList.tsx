'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Bookmark, BookmarkX, Heart, FileText, Loader2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { setPostFlag } from '@/lib/postFlags';

export type ActivityListKind = 'saved' | 'liked' | 'posted';

interface Row {
  id: string;
  at: string;
  excerpt: string;
  image: string | null;
  authorName: string;
  authorHandle: string | null;
  avatar: string | null;
}

const LIMIT = 50;

function excerptOf(post: { content?: string | null; blocks?: unknown }): { text: string; image: string | null } {
  let text = '';
  let image: string | null = null;
  if (Array.isArray(post.blocks)) {
    for (const b of post.blocks as { type?: string; html?: string; imageUrl?: string; pollQuestion?: string }[]) {
      if (!image && b.type === 'image' && b.imageUrl) image = b.imageUrl;
      if (text.length < 160) {
        const t = (b.html || b.pollQuestion || '').replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ');
        if (t.trim()) text += (text ? ' ' : '') + t.trim();
      }
    }
  }
  if (!text) text = post.content || '';
  return { text: text.replace(/\s+/g, ' ').slice(0, 180), image };
}

const EMPTY: Record<ActivityListKind, string> = {
  saved: 'Nada salvo ainda. Toque em “Salvar” num Insight para guardá-lo aqui.',
  liked: 'Você ainda não curtiu nenhum Insight.',
  posted: 'Você ainda não publicou nenhum Insight.',
};

/** Lista de Insights salvos, curtidos ou publicados por quem está logado. */
export function ActivityPostList({ kind, profileId, onNavigate }: { kind: ActivityListKind; profileId: string; onNavigate: () => void }) {
  const [rows, setRows] = useState<Row[] | null>(null);

  const load = useCallback(async () => {
    const supabase = createClient();
    // 1) IDs na ordem certa (mais recentes primeiro)
    let order: { id: string; at: string }[] = [];
    if (kind === 'posted') {
      const { data } = await supabase
        .from('posts')
        .select('id, created_at')
        .or(`profile_id.eq.${profileId},author_id.eq.${profileId}`)
        .eq('is_draft', false)
        .order('created_at', { ascending: false })
        .limit(LIMIT);
      order = (data || []).map((r) => ({ id: r.id as string, at: r.created_at as string }));
    } else {
      const table = kind === 'saved' ? 'post_saves' : 'post_likes';
      const { data } = await supabase
        .from(table)
        .select('post_id, created_at')
        .eq('profile_id', profileId)
        .order('created_at', { ascending: false })
        .limit(LIMIT);
      order = (data || []).map((r) => ({ id: r.post_id as string, at: r.created_at as string }));
    }
    if (!order.length) {
      setRows([]);
      return;
    }

    // 2) posts e autores em lote
    const { data: posts } = await supabase
      .from('posts')
      .select('id, content, blocks, profile_id, author_id')
      .in('id', order.map((o) => o.id));
    const authorIds = Array.from(new Set((posts || []).map((p) => (p.author_id || p.profile_id) as string).filter(Boolean)));
    const { data: authors } = authorIds.length
      ? await supabase.from('profiles').select('id, display_name, full_name, username, avatar_url').in('id', authorIds)
      : { data: [] as { id: string; display_name?: string; full_name?: string; username?: string; avatar_url?: string }[] };
    const byPost = new Map((posts || []).map((p) => [p.id as string, p]));
    const byAuthor = new Map((authors || []).map((a) => [a.id as string, a]));

    setRows(
      order
        .filter((o) => byPost.has(o.id)) // posts apagados ou que deixaram de ser visíveis somem
        .map((o) => {
          const p = byPost.get(o.id)!;
          const a = byAuthor.get((p.author_id || p.profile_id) as string);
          const { text, image } = excerptOf(p);
          return {
            id: o.id,
            at: o.at,
            excerpt: text || 'Insight sem texto',
            image,
            authorName: a?.display_name || a?.full_name || a?.username || 'Membro do Insight',
            authorHandle: a?.username || null,
            avatar: a?.avatar_url || null,
          };
        })
    );
  }, [kind, profileId]);

  useEffect(() => {
    setRows(null);
    void load();
    if (kind !== 'saved') return;
    const onChange = () => void load();
    window.addEventListener('insight-saves-changed', onChange);
    return () => window.removeEventListener('insight-saves-changed', onChange);
  }, [load, kind]);

  async function unsave(id: string) {
    setRows((prev) => (prev ? prev.filter((r) => r.id !== id) : prev));
    setPostFlag(id, profileId, { saved: false });
    await createClient().from('post_saves').delete().eq('post_id', id).eq('profile_id', profileId);
  }

  if (!rows) {
    return (
      <div className="py-12 flex justify-center">
        <Loader2 className="w-5 h-5 animate-spin text-accent" />
      </div>
    );
  }
  if (!rows.length) {
    const Icon = kind === 'saved' ? Bookmark : kind === 'liked' ? Heart : FileText;
    return (
      <div className="py-12 text-center">
        <Icon className="w-6 h-6 mx-auto text-muted" />
        <p className="mt-2 text-xs text-muted max-w-[16rem] mx-auto">{EMPTY[kind]}</p>
      </div>
    );
  }

  return (
    <>
    <p className="mt-4 text-[11px] text-muted">
      {rows.length >= LIMIT ? `Os ${LIMIT} mais recentes` : `${rows.length} ${rows.length === 1 ? 'Insight' : 'Insights'}`} · toque para abrir
    </p>
    <ul className="mt-2 divide-y divide-border rounded-xl border border-border overflow-hidden">
      {rows.map((r) => (
        <li key={r.id} className="relative group">
          <Link href={`/post/${r.id}`} onClick={onNavigate} className="flex items-start gap-3 p-3 pr-10 hover:bg-elevated/50 transition-colors">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={r.avatar || '/assets/net/default-perfil'} alt="" className="w-8 h-8 rounded-full object-cover border border-border bg-elevated shrink-0" />
            <span className="min-w-0 flex-1">
              <span className="flex items-baseline gap-1.5 text-xs">
                <span className="font-bold text-primary truncate">{r.authorName}</span>
                {r.authorHandle && <span className="text-muted truncate">@{r.authorHandle}</span>}
                <span className="ml-auto text-[10px] text-muted shrink-0">
                  {new Date(r.at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                </span>
              </span>
              <span className="mt-0.5 block text-xs text-secondary leading-snug line-clamp-2">{r.excerpt}</span>
            </span>
            {r.image && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={r.image} alt="" loading="lazy" className="w-12 h-12 rounded-lg object-cover border border-border shrink-0" />
            )}
          </Link>
          {kind === 'saved' && (
            <button
              type="button"
              onClick={() => void unsave(r.id)}
              title="Remover dos salvos"
              aria-label="Remover dos salvos"
              className="absolute right-2 top-2.5 p-1.5 rounded-md text-muted hover:text-danger opacity-70 group-hover:opacity-100"
            >
              <BookmarkX className="w-4 h-4" />
            </button>
          )}
        </li>
      ))}
    </ul>
    </>
  );
}
