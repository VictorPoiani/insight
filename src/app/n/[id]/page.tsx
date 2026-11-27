/**
 * Versão pública de um texto publicado a partir do Notebook, com os balões do
 * Sumário. Lê só a cópia publicada (notebook_publications), nunca o Notebook.
 */
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createServerSupabase } from '@/lib/supabase/server';
import { PublicationView } from '@/components/notebook/publication/PublicationView';
import type { PublicEntry } from '@/lib/notebook/publication';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function load(id: string) {
  if (!UUID.test(id)) return null;
  const supabase = await createServerSupabase();
  const { data } = await supabase.from('notebook_publications').select('id, title, html, entries, post_id, profile_id, published_at').eq('id', id).eq('is_public', true).maybeSingle();
  if (!data) return null;
  const { data: author } = await supabase.from('profiles').select('display_name, username').eq('id', data.profile_id).maybeSingle();
  return { ...data, author: author as { display_name: string | null; username: string | null } | null };
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const pub = await load((await params).id);
  return pub ? { title: `${pub.title} · Insight` } : { title: 'Insight' };
}

export default async function PublicationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const pub = await load(id);
  if (!pub) notFound();
  const date = pub.published_at ? new Date(pub.published_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' }) : '';
  return (
    <main className="min-h-screen bg-[#0e0e10]">
      <PublicationView
        title={pub.title}
        html={pub.html}
        entries={(pub.entries || {}) as Record<string, PublicEntry>}
        readMoreBase={`/n/${pub.id}/v/`}
        byline={
          <>
            {pub.author?.username ? <Link href={`/u/${pub.author.username}`}>{pub.author.display_name || pub.author.username}</Link> : pub.author?.display_name}
            {date ? ` · ${date}` : ''}
            {pub.post_id ? (
              <>
                {' · '}
                <Link href={`/post/${pub.post_id}`}>ver o post e os comentários</Link>
              </>
            ) : null}
          </>
        }
      />
    </main>
  );
}
