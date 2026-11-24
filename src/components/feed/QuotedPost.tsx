'use client';

import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { Loader2, Quote, X } from '@/components/icons';
import { createClient } from '@/lib/supabase/client';
import type { Post, Profile } from '@/types/database';
import { PostTime } from './PostTime';

type Loaded = { post: Post; author: Profile | null } | null;
const cache = new Map<string, Promise<Loaded>>();

function loadPost(id: string): Promise<Loaded> {
  let p = cache.get(id);
  if (!p) {
    const supabase = createClient();
    p = (async () => {
      const { data: post } = await supabase.from('posts').select('*').eq('id', id).maybeSingle();
      if (!post) return null;
      const authorId = (post as Post).profile_id || (post as Post).author_id;
      const { data: author } = await supabase.from('profiles').select('*').eq('id', authorId).maybeSingle();
      return { post: post as Post, author: (author as Profile) || null };
    })();
    cache.set(id, p);
  }
  return p;
}

function firstImage(post: Post): string | null {
  if (post.image_url) return post.image_url;
  const b = (post.blocks || []).find((x) => x.type === 'image' && (x as { imageUrl?: string }).imageUrl);
  return (b as { imageUrl?: string } | undefined)?.imageUrl || null;
}

/** Cartão compacto do Insight citado (dentro de um repost com comentário). */
export function QuotedPostCard({ postId, preloaded }: { postId: string; preloaded?: Loaded }) {
  const [data, setData] = useState<Loaded | undefined>(preloaded ?? undefined);

  useEffect(() => {
    if (preloaded) return;
    let alive = true;
    loadPost(postId).then((d) => alive && setData(d));
    return () => {
      alive = false;
    };
  }, [postId, preloaded]);

  if (data === undefined) {
    return (
      <div className="mt-3 h-20 rounded-xl border border-border bg-surface/50 grid place-items-center">
        <Loader2 className="w-4 h-4 text-muted animate-spin" />
      </div>
    );
  }
  if (data === null) {
    return (
      <div className="mt-3 px-3 py-3 rounded-xl border border-border bg-surface/50 text-xs text-muted">
        Este Insight não está mais disponível.
      </div>
    );
  }

  const { post, author } = data;
  const img = firstImage(post);
  return (
    <Link
      href={`/post/${post.id}`}
      onClick={(e) => e.stopPropagation()}
      className="mt-3 flex gap-3 p-3 rounded-xl border border-border bg-surface/40 hover:bg-surface transition-colors"
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 text-xs min-w-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={author?.avatar_url || '/assets/net/default-perfil'}
            alt=""
            className="w-5 h-5 rounded-full object-cover border border-border shrink-0"
          />
          <span className="font-bold text-primary truncate">{author?.full_name || 'Usuário'}</span>
          {author?.username && <span className="text-muted truncate">@{author.username}</span>}
          <span className="text-muted">·</span>
          <PostTime iso={post.created_at} className="text-muted shrink-0" />
        </div>
        <p className="mt-1 text-[13px] text-secondary leading-relaxed line-clamp-4 whitespace-pre-line break-words">{post.content}</p>
      </div>
      {img && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={img} alt="" loading="lazy" className="w-20 h-20 rounded-lg object-cover border border-border shrink-0" />
      )}
    </Link>
  );
}

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const MAX = 1000;

/** Janela "Repostar com comentário". */
export function QuoteComposerModal({
  post,
  author,
  me,
  onClose,
  onPublished,
}: {
  post: Post;
  author: Profile;
  me: Profile;
  onClose: () => void;
  onPublished?: (created: Post) => void;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  async function publish() {
    const clean = text.trim();
    if (!clean || clean.length > MAX || sending) return;
    setSending(true);
    setError(null);
    const html = escapeHtml(clean).replace(/\n/g, '<br>');
    const { data, error: err } = await supabase
      .from('posts')
      .insert({
        author_id: me.id,
        profile_id: me.id,
        content: clean,
        blocks: [{ id: `quote-${Date.now().toString(36)}`, type: 'paragraph', html }],
        tags: post.tags?.slice(0, 3) || [],
        is_pinned: false,
        visibility: 'public',
        quoted_post_id: post.id,
      })
      .select('*')
      .single();
    setSending(false);
    if (err || !data) {
      setError('Não foi possível publicar agora. Tente de novo.');
      return;
    }
    if (author.id !== me.id) {
      void supabase.from('notifications').insert({
        recipient_id: author.id,
        actor_id: me.id,
        type: 'repost',
        post_id: post.id,
        content_preview: clean.slice(0, 110),
        message: `citou seu Insight: ${clean.slice(0, 90)}`,
      });
    }
    const body = JSON.stringify({ action: 'new_post', postId: (data as Post).id });
    fetch('/api/push', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body }).catch(() => {});
    window.dispatchEvent(new CustomEvent('insight:post-created', { detail: data }));
    onPublished?.(data as Post);
    onClose();
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[150] bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center sm:p-4"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Repostar Insight com comentário"
        className="w-full sm:max-w-lg max-h-[92vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl bg-background border border-border shadow-2xl"
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <span className="flex items-center gap-2 text-sm font-bold text-primary">
            <Quote className="w-4 h-4 text-accent" /> Repostar Insight com comentário
          </span>
          <button type="button" onClick={onClose} aria-label="Fechar" className="p-1 rounded-lg text-muted hover:text-primary">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-4">
          <div className="flex gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={me.avatar_url || '/assets/net/default-perfil'} alt="" className="w-9 h-9 rounded-full object-cover border border-border shrink-0" />
            <textarea
              autoFocus
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  void publish();
                }
              }}
              rows={4}
              placeholder="Adicione seu comentário a este Insight..."
              className="flex-1 min-w-0 bg-transparent text-[15px] text-primary placeholder:text-muted resize-none focus:outline-none leading-relaxed"
            />
          </div>
          <QuotedPostCard postId={post.id} preloaded={{ post, author }} />
          {error && <p className="mt-2 text-xs text-danger">{error}</p>}
        </div>
        <div className="flex items-center justify-between gap-2 px-4 py-3 border-t border-border">
          <span className={`text-[11px] font-mono ${text.length > MAX ? 'text-danger' : 'text-muted'}`}>
            {text.length}/{MAX}
          </span>
          <button
            type="button"
            onClick={publish}
            disabled={!text.trim() || text.length > MAX || sending}
            className="px-4 py-2 rounded-full bg-accent hover:bg-accent-hover text-white text-sm font-bold disabled:opacity-50 transition-colors"
          >
            {sending ? 'Publicando…' : 'Publicar Insight'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
