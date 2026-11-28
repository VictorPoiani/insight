import type { MetadataRoute } from 'next';
import { createClient } from '@supabase/supabase-js';

const SITE = (process.env.NEXT_PUBLIC_SITE_URL || 'https://www.insight.app.br').replace(/\/$/, '');

// regenera no máximo a cada hora
export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const pages: MetadataRoute.Sitemap = ['', '/about', '/apoie', '/nitro', '/atualizacoes', '/tutorial', '/termos', '/privacidade'].map((p) => ({
    url: `${SITE}${p}`,
    changeFrequency: p === '' ? 'hourly' : 'weekly',
    priority: p === '' ? 1 : 0.5,
  }));
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return pages;
  try {
    const supabase = createClient(url, key, { auth: { persistSession: false } });
    // só o que é público (as regras do banco já escondem privados, rascunhos e moderados)
    const [{ data: posts }, { data: profiles }] = await Promise.all([
      supabase.from('posts').select('id, created_at, edited_at, is_nsfw').order('created_at', { ascending: false }).limit(2000),
      supabase.from('profiles').select('username, created_at').not('username', 'is', null).order('created_at', { ascending: false }).limit(2000),
    ]);
    for (const p of (posts as { id: string; created_at: string; edited_at: string | null; is_nsfw: boolean | null }[] | null) || []) {
      if (p.is_nsfw) continue;
      pages.push({ url: `${SITE}/post/${p.id}`, lastModified: p.edited_at || p.created_at, changeFrequency: 'weekly', priority: 0.6 });
    }
    for (const u of (profiles as { username: string; created_at: string }[] | null) || []) {
      pages.push({ url: `${SITE}/u/${encodeURIComponent(u.username)}`, changeFrequency: 'daily', priority: 0.7 });
    }
  } catch {
    /* sem banco: só as páginas fixas */
  }
  return pages;
}
