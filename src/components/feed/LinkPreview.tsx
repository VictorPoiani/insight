'use client';

import { useEffect, useState } from 'react';

type Preview = { url: string; title: string; description: string; image: string; site: string };
const cache = new Map<string, Promise<Preview | null>>();

function load(url: string) {
  let p = cache.get(url);
  if (!p) {
    p = fetch(`/api/link-preview?url=${encodeURIComponent(url)}`)
      .then((r) => (r.ok ? (r.json() as Promise<Preview>) : null))
      .catch(() => null);
    cache.set(url, p);
  }
  return p;
}

const SKIP = /(open\.spotify\.com|giphy\.com|tenor\.com|\.(png|jpe?g|gif|webp|mp4|webm|mov)(\?|$))/i;

/** Primeiro link "de verdade" do texto (ignora mídia que o post já mostra). */
export function firstLinkIn(texts: string[]): string | null {
  for (const t of texts) {
    // links em <a href> primeiro, depois endereços soltos no texto
    const hrefs = Array.from(t.matchAll(/href\s*=\s*["']([^"']+)["']/gi)).map((m) => m[1]);
    const plain = Array.from(t.replace(/<[^>]+>/g, ' ').matchAll(/https?:\/\/[^\s<>"')\]]+/gi)).map((m) => m[0]);
    for (const raw of [...hrefs, ...plain]) {
      const u = raw.replace(/&amp;/g, '&').replace(/[.,;:!?]+$/, '');
      if (/^https?:\/\//i.test(u) && !SKIP.test(u)) return u;
    }
  }
  return null;
}

/** Cartão de prévia de link (como no X/WhatsApp). Some se a página não tiver prévia. */
export function LinkPreview({ url }: { url: string }) {
  const [data, setData] = useState<Preview | null>(null);
  const [imgOk, setImgOk] = useState(true);

  useEffect(() => {
    let alive = true;
    void load(url).then((d) => alive && setData(d));
    return () => {
      alive = false;
    };
  }, [url]);

  if (!data) return null;
  const host = (() => {
    try {
      return new URL(data.url || url).hostname.replace(/^www\./, '');
    } catch {
      return data.site;
    }
  })();
  const wide = Boolean(data.image && imgOk);

  return (
    <a
      href={data.url || url}
      target="_blank"
      rel="noopener noreferrer nofollow ugc"
      onClick={(e) => e.stopPropagation()}
      className="mt-3 flex rounded-2xl border border-border overflow-hidden hover:bg-surface/60 transition-colors group/lp"
    >
      {wide && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={data.image}
          alt=""
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => setImgOk(false)}
          className="w-28 sm:w-36 shrink-0 object-cover bg-elevated border-r border-border"
        />
      )}
      <span className="min-w-0 flex-1 px-3.5 py-3 flex flex-col justify-center gap-0.5">
        <span className="text-[11px] text-muted truncate">{data.site && data.site !== host ? `${data.site} · ${host}` : host}</span>
        <span className="text-sm font-semibold text-primary leading-snug line-clamp-2 group-hover/lp:underline decoration-1 underline-offset-2">
          {data.title}
        </span>
        {data.description && <span className="text-xs text-secondary leading-snug line-clamp-2">{data.description}</span>}
      </span>
    </a>
  );
}
