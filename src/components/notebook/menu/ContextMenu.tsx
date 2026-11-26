'use client';

import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ChevronRight } from 'lucide-react';

/**
 * Menu de contexto (botão direito) do Notebook: um só sistema para todo o app.
 * Componentes com ações próprias (mapa, grafo, Cronos…) chamam `open`; o resto
 * (texto, campos, abas, menções e o fundo) é tratado por um ouvinte global.
 */
export type MenuEntry =
  | 'sep'
  | {
      label: string;
      icon?: React.ReactNode;
      shortcut?: string;
      run?: () => void;
      danger?: boolean;
      disabled?: boolean;
      submenu?: MenuEntry[];
    };

type MenuState = { x: number; y: number; items: MenuEntry[]; title?: string } | null;

const Ctx = createContext<{ open: (e: { clientX: number; clientY: number; preventDefault: () => void; stopPropagation?: () => void }, items: MenuEntry[], title?: string) => void }>({
  open: () => {},
});

export const useNotebookMenu = () => useContext(Ctx);

export function ContextMenuProvider({ children }: { children: React.ReactNode }) {
  const [menu, setMenu] = useState<MenuState>(null);
  const open = useCallback(
    (e: { clientX: number; clientY: number; preventDefault: () => void; stopPropagation?: () => void }, items: MenuEntry[], title?: string) => {
      e.preventDefault();
      e.stopPropagation?.();
      const clean = tidy(items);
      if (clean.length) setMenu({ x: e.clientX, y: e.clientY, items: clean, title });
    },
    []
  );
  return (
    <Ctx.Provider value={{ open }}>
      {children}
      {menu && <MenuPanel x={menu.x} y={menu.y} items={menu.items} title={menu.title} onClose={() => setMenu(null)} />}
    </Ctx.Provider>
  );
}

/** Remove separadores repetidos ou nas pontas. */
function tidy(items: MenuEntry[]): MenuEntry[] {
  const out: MenuEntry[] = [];
  for (const it of items) {
    if (it === 'sep' && (!out.length || out[out.length - 1] === 'sep')) continue;
    if (it !== 'sep' && it.submenu) {
      const sub = tidy(it.submenu);
      if (!sub.length) continue;
      out.push({ ...it, submenu: sub });
      continue;
    }
    out.push(it);
  }
  while (out[out.length - 1] === 'sep') out.pop();
  return out;
}

function MenuPanel({ x, y, items, title, onClose, nested = false }: { x: number; y: number; items: MenuEntry[]; title?: string; onClose: () => void; nested?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ left: x, top: y });
  const [active, setActive] = useState(-1);
  const [sub, setSub] = useState<{ i: number; x: number; y: number } | null>(null);

  // mantém o menu dentro da tela
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setPos({
      left: Math.max(8, x + r.width > window.innerWidth - 8 ? (nested ? x - r.width - 196 : window.innerWidth - r.width - 8) : x),
      top: Math.max(8, y + r.height > window.innerHeight - 8 ? window.innerHeight - r.height - 8 : y),
    });
  }, [x, y, nested]);

  useEffect(() => {
    if (nested) return;
    const close = (e: Event) => {
      if (e.type === 'mousedown' && (e.target as HTMLElement)?.closest?.('.nb-ctx')) return;
      onClose();
    };
    const key = (e: KeyboardEvent) => {
      const list = items.map((it, i) => ({ it, i })).filter(({ it }) => it !== 'sep' && !it.disabled);
      if (e.key === 'Escape') return onClose();
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        const idx = list.findIndex((l) => l.i === active);
        const next = e.key === 'ArrowDown' ? (idx + 1) % list.length : (idx - 1 + list.length) % list.length;
        setActive(list[next]?.i ?? -1);
      }
      if (e.key === 'Enter' && active >= 0) {
        e.preventDefault();
        const it = items[active];
        if (it !== 'sep' && it.run && !it.disabled) {
          onClose();
          it.run();
        }
      }
    };
    window.addEventListener('mousedown', close);
    window.addEventListener('blur', close);
    window.addEventListener('resize', close);
    window.addEventListener('scroll', close, true);
    window.addEventListener('keydown', key, true);
    return () => {
      window.removeEventListener('mousedown', close);
      window.removeEventListener('blur', close);
      window.removeEventListener('resize', close);
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('keydown', key, true);
    };
  }, [items, active, onClose, nested]);

  return (
    <div ref={ref} className="nb-ctx" style={pos} role="menu" onContextMenu={(e) => e.preventDefault()}>
      {title && <p className="nb-ctx-title">{title}</p>}
      {items.map((it, i) =>
        it === 'sep' ? (
          <div key={i} className="nb-ctx-sep" role="separator" />
        ) : (
          <button
            key={i}
            type="button"
            role="menuitem"
            disabled={it.disabled}
            data-active={active === i}
            data-danger={it.danger}
            onMouseDown={(e) => e.preventDefault()}
            onMouseEnter={(e) => {
              setActive(i);
              if (it.submenu) {
                const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
                setSub({ i, x: r.right + 2, y: r.top - 5 });
              } else setSub(null);
            }}
            onClick={() => {
              if (it.submenu || it.disabled) return;
              onClose();
              it.run?.();
            }}
            className="nb-ctx-item"
          >
            <span className="nb-ctx-icon">{it.icon}</span>
            <span className="flex-1 truncate">{it.label}</span>
            {it.shortcut && <span className="nb-ctx-kbd">{it.shortcut}</span>}
            {it.submenu && <ChevronRight className="w-3.5 h-3.5 text-[var(--nb-ink-3)]" />}
          </button>
        )
      )}
      {sub && items[sub.i] !== 'sep' && (items[sub.i] as { submenu?: MenuEntry[] }).submenu && (
        <MenuPanel x={sub.x} y={sub.y} items={(items[sub.i] as { submenu: MenuEntry[] }).submenu} onClose={onClose} nested />
      )}
    </div>
  );
}
