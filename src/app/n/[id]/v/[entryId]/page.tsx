/** "Ler mais" de um termo do Sumário numa publicação (só verbetes públicos). */
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { createServerSupabase } from '@/lib/supabase/server';
import { PublicEntryView } from '@/components/notebook/publication/PublicationView';
import type { PublicEntry } from '@/lib/notebook/publication';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function load(id: string, entryId: string) {
  if (!UUID.test(id) || !UUID.test(entryId)) return null;
  const supabase = await createServerSupabase();
  const { data } = await supabase.from('notebook_publications').select('id, title, entries').eq('id', id).eq('is_public', true).maybeSingle();
  const entry = (data?.entries as Record<string, PublicEntry> | undefined)?.[entryId.toLowerCase()];
  return data && entry ? { pub: data, entry } : null;
}

export async function generateMetadata({ params }: { params: Promise<{ id: string; entryId: string }> }): Promise<Metadata> {
  const p = await params;
  const r = await load(p.id, p.entryId);
  return { title: r ? `${r.entry.title} · ${r.pub.title}` : 'Insight' };
}

export default async function PublicEntryPage({ params }: { params: Promise<{ id: string; entryId: string }> }) {
  const p = await params;
  const r = await load(p.id, p.entryId);
  if (!r) notFound();
  return (
    <main className="min-h-screen bg-[#0e0e10]">
      <PublicEntryView entry={r.entry} backHref={`/n/${r.pub.id}`} />
    </main>
  );
}
