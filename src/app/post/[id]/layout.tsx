import type { Metadata } from 'next';
import { createClient } from '@supabase/supabase-js';
import { siteUrl } from '@/lib/account/mailer';

/** Prévia do link do post (WhatsApp, Instagram, X, Telegram...). */
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const base = siteUrl();
  const fallback: Metadata = { title: 'Publicação · Insight*' };
  if (!/^[0-9a-f-]{36}$/i.test(id)) return fallback;

  try {
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
      auth: { persistSession: false },
    });
    const { data: post } = await supabase
      .from('posts')
      .select('content, profile_id, author_id, visibility, is_draft')
      .eq('id', id)
      .maybeSingle();
    if (!post || post.visibility === 'private' || post.is_draft) return fallback;
    const { data: author } = await supabase
      .from('profiles')
      .select('display_name, full_name, username')
      .eq('id', post.profile_id || post.author_id)
      .maybeSingle();

    const name = author?.display_name || author?.full_name || author?.username || 'Insight*';
    const text = String(post.content || '').replace(/\s+/g, ' ').trim();
    const description = text.length > 180 ? `${text.slice(0, 177)}…` : text || 'Confira esta publicação no Insight*';
    const title = `${name} no Insight*`;
    const image = `${base}/api/share/${id}?format=og`;
    const url = `${base}/post/${id}`;

    return {
      title,
      description,
      alternates: { canonical: url },
      openGraph: { title, description, url, siteName: 'Insight*', type: 'article', images: [{ url: image, width: 1200, height: 630, alt: description }] },
      twitter: { card: 'summary_large_image', title, description, images: [image] },
    };
  } catch {
    return fallback;
  }
}

export default function PostLayout({ children }: { children: React.ReactNode }) {
  return children;
}
