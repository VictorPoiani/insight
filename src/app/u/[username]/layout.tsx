import type { Metadata } from 'next';
import { createClient } from '@supabase/supabase-js';
import { siteUrl } from '@/lib/account/mailer';

/** Prévia do link do perfil (WhatsApp, Instagram, X...). */
export async function generateMetadata({ params }: { params: Promise<{ username: string }> }): Promise<Metadata> {
  const { username } = await params;
  const handle = decodeURIComponent(username).slice(0, 60);
  const base = siteUrl();
  try {
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
      auth: { persistSession: false },
    });
    const { data: p } = await supabase
      .from('profiles')
      .select('display_name, full_name, username, bio')
      .eq('username', handle)
      .maybeSingle();
    if (!p) return { title: 'Perfil · Insight*' };
    const name = p.display_name || p.full_name || p.username;
    const title = `${name} (@${p.username}) · Insight*`;
    const description = String(p.bio || `Siga ${name} no Insight*`).replace(/\s+/g, ' ').slice(0, 180);
    const image = `${base}/api/share/profile/${encodeURIComponent(p.username)}?format=og`;
    const url = `${base}/u/${encodeURIComponent(p.username)}`;
    return {
      title,
      description,
      alternates: { canonical: url },
      openGraph: { title, description, url, siteName: 'Insight*', type: 'profile', images: [{ url: image, width: 1200, height: 630 }] },
      twitter: { card: 'summary_large_image', title, description, images: [image] },
    };
  } catch {
    return { title: 'Perfil · Insight*' };
  }
}

export default function ProfileLayout({ children }: { children: React.ReactNode }) {
  return children;
}
