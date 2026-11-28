'use client';

import { useEffect, useState } from 'react';
import { Keyboard, X } from 'lucide-react';
import { applyWarmOverlay, PREFS_EVENT, readPrefs, writePrefs, type NightLightPrefs } from '@/lib/nightLight';

/** Lista usada no modal de ajuda e no tutorial. */
export const SHORTCUTS: { keys: string[]; label: string }[] = [
  { keys: ['Ctrl', 'Shift', 'F'], label: 'Modo foco (recolhe as barras laterais)' },
  { keys: ['Ctrl', 'Shift', 'L'], label: 'Modo leitura confortável' },
  { keys: ['Enter'], label: 'Pular linha no bloco de texto' },
  { keys: ['Ctrl', 'Enter'], label: 'Criar outro bloco abaixo' },
  { keys: ['/'], label: 'Inserir bloco (no início de um bloco vazio)' },
  { keys: ['@'], label: 'Marcar alguém da comunidade' },
  { keys: ['Ctrl', 'B'], label: 'Negrito (com texto selecionado)' },
  { keys: ['Ctrl', 'I'], label: 'Itálico (com texto selecionado)' },
  { keys: ['Ctrl', 'Alt', 'N'], label: 'Capturar uma ideia na Caixa de entrada do Notebook' },
  { keys: ['J'], label: 'Próximo Insight do feed' },
  { keys: ['K'], label: 'Insight anterior' },
  { keys: ['L'], label: 'Curtir o Insight em destaque' },
  { keys: ['?'], label: 'Mostrar esta lista de atalhos' },
];

/** Posts na tela (cartões do feed/perfil), na ordem. */
function postCards(): HTMLElement[] {
  return Array.from(document.querySelectorAll<HTMLElement>('article[data-post-view]'));
}

/** Post "em destaque": o primeiro cujo topo passou da faixa do cabeçalho fixo. */
function currentIndex(cards: HTMLElement[]) {
  const line = 90;
  let idx = -1;
  cards.forEach((c, i) => {
    if (c.getBoundingClientRect().top <= line + 4) idx = i;
  });
  return idx;
}

function focusCard(card: HTMLElement) {
  const top = card.getBoundingClientRect().top + window.scrollY - 64;
  window.scrollTo({ top, behavior: 'smooth' });
  card.classList.add('insight-kbd-focus');
  window.setTimeout(() => card.classList.remove('insight-kbd-focus'), 900);
}

function isTyping(target: EventTarget | null) {
  const el = target as HTMLElement | null;
  if (!el) return false;
  const tag = el.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable;
}

export function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="min-w-[1.6rem] px-1.5 py-0.5 rounded-md border border-border bg-elevated text-[11px] font-mono font-bold text-primary text-center shadow-sm">
      {children}
    </kbd>
  );
}

/**
 * Atalhos globais (foco, leitura, ajuda) e agendador da luz noturna laranja.
 */
export function GlobalShortcuts() {
  const [helpOpen, setHelpOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // Luz noturna: reavalia a cada minuto e quando as preferências mudam
  useEffect(() => {
    const tick = () => applyWarmOverlay(readPrefs() as NightLightPrefs);
    tick();
    const id = window.setInterval(tick, 60_000);
    const onVisible = () => document.visibilityState === 'visible' && tick();
    window.addEventListener(PREFS_EVENT, tick);
    window.addEventListener('storage', tick);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearInterval(id);
      window.removeEventListener(PREFS_EVENT, tick);
      window.removeEventListener('storage', tick);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 1800);
    return () => window.clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const mod = e.ctrlKey || e.metaKey;
      const key = e.key.toLowerCase();
      // no Notebook, Ctrl+Shift+F é a busca global dele
      if (mod && e.shiftKey && key === 'f' && !window.location.pathname.startsWith('/notebook')) {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent('insight-toggle-focus-mode', { detail: {} }));
        setToast('Modo foco alternado');
        return;
      }
      if (mod && e.shiftKey && key === 'l') {
        e.preventDefault();
        const on = !readPrefs().readingMode;
        writePrefs({ readingMode: on });
        if (on) document.documentElement.setAttribute('data-reading', 'comfortable');
        else document.documentElement.removeAttribute('data-reading');
        setToast(on ? 'Modo leitura ativado' : 'Modo leitura desativado');
        return;
      }
      // J / K / L: navegar e curtir no feed (sem modificadores, fora de campos de texto)
      if (!mod && !e.altKey && !e.shiftKey && !isTyping(e.target) && (key === 'j' || key === 'k' || key === 'l')) {
        if (document.querySelector('[role="dialog"][aria-modal="true"]')) return;
        const cards = postCards();
        if (!cards.length) return;
        e.preventDefault();
        const cur = currentIndex(cards);
        if (key === 'j') focusCard(cards[Math.min(cards.length - 1, cur + 1)]);
        else if (key === 'k') focusCard(cards[Math.max(0, cur - 1)]);
        else {
          const card = cards[Math.max(0, cur)];
          const like = card.querySelector<HTMLButtonElement>('button[aria-label="Curtir Insight"], button[aria-label="Descurtir Insight"]');
          if (like) {
            like.click();
            card.classList.add('insight-kbd-focus');
            window.setTimeout(() => card.classList.remove('insight-kbd-focus'), 900);
          }
        }
        return;
      }
      if (e.key === '?' && !mod && !isTyping(e.target)) {
        e.preventDefault();
        setHelpOpen((v) => !v);
        return;
      }
      if (e.key === 'Escape') setHelpOpen(false);
    }
    function onOpen() {
      setHelpOpen(true);
    }
    window.addEventListener('keydown', onKey);
    window.addEventListener('insight-open-shortcuts', onOpen);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('insight-open-shortcuts', onOpen);
    };
  }, []);

  return (
    <>
      {toast && (
        <div className="fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 z-[9998] px-4 py-2 rounded-full bg-surface border border-border shadow-xl text-xs font-semibold text-primary">
          {toast}
        </div>
      )}
      {helpOpen && (
        <div
          className="fixed inset-0 z-[9997] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setHelpOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Atalhos de teclado"
            className="w-full max-w-md rounded-2xl bg-surface border border-border shadow-2xl p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="flex items-center gap-2 text-sm font-bold text-primary">
                <Keyboard className="w-4 h-4 text-accent" /> Atalhos de teclado
              </h2>
              <button type="button" aria-label="Fechar" onClick={() => setHelpOpen(false)} className="p-1 rounded-md text-muted hover:text-primary">
                <X className="w-4 h-4" />
              </button>
            </div>
            <ul className="space-y-2.5">
              {SHORTCUTS.map((s) => (
                <li key={s.label} className="flex items-center justify-between gap-3 text-xs">
                  <span className="text-secondary">{s.label}</span>
                  <span className="flex items-center gap-1 shrink-0">
                    {s.keys.map((k) => (
                      <Kbd key={k}>{k}</Kbd>
                    ))}
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-4 text-[11px] text-muted">
              No Mac, use ⌘ no lugar de Ctrl.{' '}
              <a href="/tutorial" className="text-accent font-bold hover:underline">
                Ver tutorial completo
              </a>
            </p>
          </div>
        </div>
      )}
    </>
  );
}
