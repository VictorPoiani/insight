'use client';

import { useEffect, useState } from 'react';
import { NOTEBOOK_NAME } from '@/lib/notebook/copy';

const SEEN_KEY = 'insight-nb-intro';

function Mark() {
  // asterisco do Insight desenhado traço a traço
  return (
    <svg viewBox="0 0 48 48" className="nb-splash-mark" aria-hidden="true">
      <g fill="none" stroke="currentColor" strokeWidth="4.2" strokeLinecap="round">
        <path d="M24 6v36" pathLength={1} />
        <path d="M8.4 15l31.2 18" pathLength={1} />
        <path d="M8.4 33l31.2-18" pathLength={1} />
      </g>
    </svg>
  );
}

function Panel({ leaving = false }: { leaving?: boolean }) {
  return (
    <div className="nb-splash" data-leaving={leaving} role="status" aria-label={`Abrindo o ${NOTEBOOK_NAME}`}>
      <div className="nb-splash-inner">
        <Mark />
        <p className="nb-splash-name">{NOTEBOOK_NAME}</p>
        <span className="nb-splash-bar" aria-hidden="true" />
      </div>
    </div>
  );
}

/** Tela de abertura enquanto confere o acesso. */
export function NotebookSplash() {
  return <Panel />;
}

/**
 * Saída da abertura quando a área de trabalho monta: na primeira visita da
 * sessão a marca termina de desenhar e a tela se abre; depois, só um fade curto.
 */
export function NotebookSplashExit() {
  const [state, setState] = useState<'show' | 'leaving' | 'gone'>('show');
  useEffect(() => {
    let first = true;
    try {
      first = sessionStorage.getItem(SEEN_KEY) !== '1';
      sessionStorage.setItem(SEEN_KEY, '1');
    } catch {
      /* ignora */
    }
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const hold = reduce ? 0 : first ? 650 : 120;
    const t1 = window.setTimeout(() => setState('leaving'), hold);
    const t2 = window.setTimeout(() => setState('gone'), hold + (reduce ? 0 : 520));
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, []);
  if (state === 'gone') return null;
  return <Panel leaving={state === 'leaving'} />;
}
