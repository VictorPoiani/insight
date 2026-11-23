'use client';

import { useCallback, useEffect, useRef } from 'react';

const PREF_KEY = 'insight:auto-focus-mode';

export function autoFocusModeEnabled(): boolean {
  try {
    return localStorage.getItem(PREF_KEY) !== 'off';
  } catch {
    return true;
  }
}

export function setAutoFocusModeEnabled(on: boolean) {
  try {
    localStorage.setItem(PREF_KEY, on ? 'on' : 'off');
  } catch {
    /* modo privado */
  }
}

function emit(collapse: boolean) {
  window.dispatchEvent(new CustomEvent('insight-toggle-focus-mode', { detail: { collapse, auto: true } }));
}

/**
 * Modo foco automático: ao começar a digitar no compositor, as barras laterais
 * se recolhem suavemente; ao sair do compositor (ou fechar), voltam como
 * estavam. Só no PC/tablet (no celular não há barras laterais).
 */
export function useAutoFocusMode(enabled = true) {
  const active = useRef(false);
  const leaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const exit = useCallback(() => {
    if (leaveTimer.current) clearTimeout(leaveTimer.current);
    if (!active.current) return;
    active.current = false;
    emit(false);
  }, []);

  useEffect(() => exit, [exit]);

  const onInput = useCallback(() => {
    if (leaveTimer.current) clearTimeout(leaveTimer.current);
    if (active.current || !enabled || !autoFocusModeEnabled()) return;
    if (window.matchMedia('(max-width: 767px)').matches) return;
    active.current = true;
    emit(true);
  }, [enabled]);

  const onFocusCapture = useCallback(() => {
    if (leaveTimer.current) clearTimeout(leaveTimer.current);
  }, []);

  const onBlurCapture = useCallback(
    (e: React.FocusEvent<HTMLElement>) => {
      const root = e.currentTarget;
      const next = e.relatedTarget as Node | null;
      if (next && root.contains(next)) return;
      if (leaveTimer.current) clearTimeout(leaveTimer.current);
      // pequena folga: clicar num menu/modal do próprio editor não desfaz o foco
      leaveTimer.current = setTimeout(() => {
        const el = document.activeElement;
        if (el && el !== document.body && root.contains(el)) return;
        exit();
      }, 2500);
    },
    [exit]
  );

  return { onInput, onFocusCapture, onBlurCapture, exit };
}
