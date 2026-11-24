'use client';

import { useEffect, useMemo, useState } from 'react';
import { Repeat2 } from '@/components/icons';
import { createClient } from '@/lib/supabase/client';
import type { Post, Profile } from '@/types/database';
import { PostCard } from './PostCard';
import { PostTime } from './PostTime';

interface RepostEntry {
  post: Post;
  author: Profile;
  repostedAt: string;
}

/**
 * Aba "Reposts" do perfil: os posts que esta pessoa repostou, do mais recente
 * para o mais antigo, cada um com o autor original.
 */
export function ProfileReposts({
  profile,
  viewerIsOwner,
  renderLoader,
}: {
  profile: Profile;
  viewerIsOwner: boolean;
  renderLoader: () => React.ReactNode;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [entries, setEntries] = useState<RepostEntry[] | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      setEntries(null);
      const { data: rows } = await supabase
        .from('post_reposts')
        .select('post_id, created_at')
        .eq('profile_id', profile.id)
        .order('created_at', { ascending: false })
        .limit(200);
      const ids = (rows || []).map((r: { post_id: string }) => r.post_id);
      if (!ids.length) {
        if (alive) setEntries([]);
        return;
      }
      // posts privados de terceiros não voltam (RLS); some sozinhos da lista
      const { data: posts } = await supabase.from('posts').select('*').in('id', ids);
      const authorIds = Array.from(
        new Set((posts || []).map((p: Post) => p.profile_id || p.author_id).filter((x): x is string => Boolean(x)))
      );
      const { data: authors } = authorIds.length
        ? await supabase.from('profiles').select('*').in('id', authorIds)
        : { data: [] as Profile[] };
      const postById = new Map((posts || []).map((p: Post) => [p.id, p]));
      const authorById = new Map((authors || []).map((a: Profile) => [a.id, a]));
      const list: RepostEntry[] = [];
      for (const r of rows || []) {
        const post = postById.get(r.post_id);
        if (!post) continue;
        const author = authorById.get(post.profile_id || post.author_id);
        if (!author) continue;
        list.push({ post, author, repostedAt: r.created_at });
      }
      if (alive) setEntries(list);
    })();
    return () => {
      alive = false;
    };
  }, [profile.id, supabase]);

  if (!entries) return <>{renderLoader()}</>;

  if (!entries.length) {
    return (
      <div className="py-16 text-center text-xs text-muted">
        {viewerIsOwner ? 'Você ainda não repostou nada. Os posts que você repostar aparecem aqui.' : 'Nenhum repost ainda.'}
      </div>
    );
  }

  const name = profile.display_name || profile.full_name || profile.username;
  return (
    <div>
      {entries.map(({ post, author, repostedAt }) => (
        <div key={`${post.id}-${repostedAt}`}>
          <p className="px-4 sm:px-6 pt-3 -mb-1 flex items-center gap-1.5 text-[11px] font-semibold text-muted">
            <Repeat2 className="w-3.5 h-3.5 text-[#1DB954]" />
            <span className="truncate">{viewerIsOwner ? 'Você repostou' : `${name} repostou`}</span>
            <span aria-hidden="true">·</span>
            <PostTime iso={repostedAt} className="truncate" />
          </p>
          <PostCard post={post} author={author} isAdmin={false} />
        </div>
      ))}
    </div>
  );
}
