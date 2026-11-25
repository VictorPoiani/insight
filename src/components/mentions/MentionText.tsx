'use client';

import Link from 'next/link';
import { Fragment } from 'react';

/** @usuario (letras, números, _ e ., sem ponto no fim). Precisa vir no início ou depois de espaço/pontuação. */
export const MENTION_RE = /(^|[^\w@/.])@([A-Za-z0-9_](?:[A-Za-z0-9_.]{0,28}[A-Za-z0-9_])?)/g;

/** Texto puro com @menções viradas em link para o perfil. */
export function MentionText({ text }: { text?: string | null }) {
  const src = text || '';
  if (!src.includes('@')) return <>{src}</>;
  const out: React.ReactNode[] = [];
  let last = 0;
  let k = 0;
  for (const m of src.matchAll(MENTION_RE)) {
    const start = (m.index ?? 0) + m[1].length;
    out.push(<Fragment key={k++}>{src.slice(last, start)}</Fragment>);
    out.push(
      <Link key={k++} href={`/u/${encodeURIComponent(m[2])}`} className="mention-link" onClick={(e) => e.stopPropagation()}>
        @{m[2]}
      </Link>
    );
    last = start + 1 + m[2].length;
  }
  out.push(<Fragment key={k++}>{src.slice(last)}</Fragment>);
  return <>{out}</>;
}
