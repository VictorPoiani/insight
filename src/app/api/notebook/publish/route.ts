/**
 * Monta a publicação de uma nota NO SERVIDOR (segredos do autor removidos aqui).
 *   POST { itemId, mode: 'preview' }  → { title, html, entries }        (Prova Final)
 *   POST { itemId, mode: 'prepare' }  → { publicationId, title, html, entries }
 * A cópia preparada só fica pública depois que o post é publicado (/confirm).
 */
import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';
import { buildPublication, PublicationError, type PublicationInput } from '@/lib/notebook/publication';
import { articleData } from '@/lib/notebook/article';
import type { Source } from '@/lib/notebook/sources';
import type { CodexCategory } from '@/lib/notebook/codex';

export const runtime = 'nodejs';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Entre na sua conta.' }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as { itemId?: string; mode?: string };
  if (!body.itemId || !UUID.test(body.itemId)) return NextResponse.json({ error: 'Nota inválida.' }, { status: 400 });

  // tudo pela sessão do usuário: a RLS garante que só as notas dele são lidas
  const { data: item } = await supabase.from('notebook_items').select('id, profile_id, title, template, content, data, source_refs, parent_id').eq('id', body.itemId).maybeSingle();
  if (!item) return NextResponse.json({ error: 'Nota não encontrada.' }, { status: 404 });

  const { data: ents } = await supabase
    .from('notebook_entries')
    .select('id, title, summary, kind, category, image_url, aliases, is_secret, is_public, codex_category_id')
    .eq('profile_id', item.profile_id)
    .is('deleted_at', null)
    .limit(5000);
  const entries: PublicationInput['entries'] = {};
  for (const e of (ents || []) as PublicationInput['entries'][string][]) entries[e.id] = e;

  let sources: Record<string, Source> = {};
  if (item.template === 'article') {
    const ids = Array.from(new Set([...((item.source_refs as string[]) || []), ...articleData(item.data).sources])).filter((x) => UUID.test(x));
    if (ids.length) {
      const { data: rows } = await supabase.from('notebook_sources').select('*').in('id', ids);
      sources = Object.fromEntries(((rows || []) as Source[]).map((r) => [r.id, { ...r, authors: Array.isArray(r.authors) ? r.authors : [], extra: r.extra || {} }]));
    }
  }
  let categories: Record<string, CodexCategory> = {};
  if (item.template === 'codex') {
    const { data: rows } = await supabase.from('notebook_codex_categories').select('*').eq('profile_id', item.profile_id).is('deleted_at', null).limit(2000);
    categories = Object.fromEntries(((rows || []) as CodexCategory[]).map((c) => [c.id, c]));
  }

  let out;
  try {
    out = buildPublication({ item: { ...item, content: item.content || '', data: (item.data || {}) as Record<string, unknown>, source_refs: (item.source_refs as string[]) || [] }, entries, sources, categories });
  } catch (err) {
    return NextResponse.json({ error: err instanceof PublicationError ? err.message : 'Não foi possível montar a publicação.' }, { status: 422 });
  }
  if (body.mode !== 'prepare') return NextResponse.json(out);

  const row = { profile_id: item.profile_id, item_id: item.id, title: out.title.slice(0, 300) || 'Sem título', template: item.template, html: out.html, entries: out.entries };
  const { data: existing } = await supabase.from('notebook_publications').select('id').eq('item_id', item.id).maybeSingle();
  const res = existing
    ? await supabase.from('notebook_publications').update(row).eq('id', existing.id).select('id').single()
    : await supabase.from('notebook_publications').insert(row).select('id').single();
  if (res.error || !res.data) return NextResponse.json({ error: res.error?.message?.includes('secret') ? 'A checagem final encontrou um segredo do autor. Nada foi publicado.' : 'Não foi possível preparar a publicação.' }, { status: 422 });
  return NextResponse.json({ ...out, publicationId: res.data.id });
}
