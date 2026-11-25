'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

interface Candidate {
  id: string;
  username: string;
  display_name?: string | null;
  full_name?: string | null;
  avatar_url?: string | null;
}

type Target =
  | { kind: 'textarea'; el: HTMLTextAreaElement | HTMLInputElement; start: number; end: number }
  | { kind: 'editable'; el: HTMLElement; node: Text; start: number; end: number };

const TRIGGER = /(^|[\s(\[{"'“])@([A-Za-z0-9_.]{0,30})$/;

function editableRoot(node: Node | null): HTMLElement | null {
  let el = node instanceof HTMLElement ? node : node?.parentElement ?? null;
  while (el) {
    if (el.isContentEditable && el.classList.contains('notion-editable')) return el;
    if (el.getAttribute('contenteditable') === 'false') return null;
    el = el.parentElement;
  }
  return null;
}

/** Acha "@consulta" logo antes do cursor no campo ativo. */
function detect(): { target: Target; query: string } | null {
  const active = document.activeElement as HTMLElement | null;
  if (!active) return null;

  if ((active instanceof HTMLTextAreaElement || active instanceof HTMLInputElement) && active.dataset.mentions === 'true') {
    const pos = active.selectionStart ?? 0;
    if (pos !== active.selectionEnd) return null;
    const m = TRIGGER.exec(active.value.slice(0, pos));
    if (!m) return null;
    return { target: { kind: 'textarea', el: active, start: pos - m[2].length - 1, end: pos }, query: m[2] };
  }

  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0 || !sel.isCollapsed) return null;
  const range = sel.getRangeAt(0);
  const node = range.startContainer;
  if (node.nodeType !== Node.TEXT_NODE) return null;
  const root = editableRoot(node);
  if (!root) return null;
  if ((node.parentElement as HTMLElement | null)?.closest('a, code, pre')) return null;
  const before = (node.textContent || '').slice(0, range.startOffset).replace(/ /g, ' ');
  const m = TRIGGER.exec(before);
  if (!m) return null;
  return {
    target: { kind: 'editable', el: root, node: node as Text, start: range.startOffset - m[2].length - 1, end: range.startOffset },
    query: m[2],
  };
}

function caretRect(t: Target): DOMRect {
  if (t.kind === 'editable') {
    const r = document.createRange();
    r.setStart(t.node, t.start);
    r.setEnd(t.node, t.end);
    const rect = r.getBoundingClientRect();
    if (rect.width || rect.height) return rect;
  }
  const box = t.el.getBoundingClientRect();
  return new DOMRect(box.left, box.bottom - 4, 0, 0);
}

/**
 * Autocompletar de @menções para todo o site: editor de posts (.notion-editable)
 * e campos com data-mentions="true" (respostas, comentários de repost).
 */
export function MentionAutocomplete() {
  const supabase = useRef(createClient()).current;
  const [target, setTarget] = useState<Target | null>(null);
  const [query, setQuery] = useState('');
  const [items, setItems] = useState<Candidate[]>([]);
  const [index, setIndex] = useState(0);
  const [pos, setPos] = useState<{ left: number; top: number; up: boolean } | null>(null);
  const stateRef = useRef({ open: false, items: [] as Candidate[], index: 0, target: null as Target | null });
  stateRef.current = { open: Boolean(target && items.length), items, index, target };

  const close = useCallback(() => {
    setTarget(null);
    setItems([]);
    setIndex(0);
  }, []);

  const refresh = useCallback(() => {
    const hit = detect();
    if (!hit) {
      if (stateRef.current.target) close();
      return;
    }
    const rect = caretRect(hit.target);
    const up = rect.bottom + 260 > window.innerHeight;
    setPos({ left: Math.min(rect.left, window.innerWidth - 272), top: up ? rect.top - 6 : rect.bottom + 6, up });
    setTarget(hit.target);
    setQuery(hit.query);
  }, [close]);

  // busca (com atraso curto) conforme a pessoa digita
  useEffect(() => {
    if (!target) return;
    let cancelled = false;
    const q = query.replace(/[%_,()]/g, '').trim();
    const timer = window.setTimeout(async () => {
      let req = supabase
        .from('profiles')
        .select('id, username, display_name, full_name, avatar_url')
        .not('username', 'is', null)
        .limit(6);
      req = q
        ? req.or(`username.ilike.${q}%,display_name.ilike.%${q}%,full_name.ilike.%${q}%`)
        : req.order('last_seen_at', { ascending: false, nullsFirst: false });
      const { data } = await req;
      if (cancelled) return;
      const list = ((data as Candidate[]) || []).filter((c) => c.username);
      // quem começa com a consulta vem primeiro
      list.sort((a, b) => Number(!a.username.toLowerCase().startsWith(q.toLowerCase())) - Number(!b.username.toLowerCase().startsWith(q.toLowerCase())));
      setItems(list);
      setIndex(0);
    }, q ? 140 : 0);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [query, target, supabase]);

  const choose = useCallback(
    (c: Candidate) => {
      const t = stateRef.current.target;
      if (!t) return;
      const handle = c.username.replace(/[^A-Za-z0-9_.]/g, '');
      if (t.kind === 'textarea') {
        const el = t.el;
        const next = `${el.value.slice(0, t.start)}@${handle} ${el.value.slice(t.end)}`;
        const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
        Object.getOwnPropertyDescriptor(proto, 'value')?.set?.call(el, next);
        el.dispatchEvent(new Event('input', { bubbles: true }));
        const caret = t.start + handle.length + 2;
        el.focus();
        el.setSelectionRange(caret, caret);
      } else {
        const sel = window.getSelection();
        const r = document.createRange();
        r.setStart(t.node, t.start);
        r.setEnd(t.node, t.end);
        sel?.removeAllRanges();
        sel?.addRange(r);
        document.execCommand(
          'insertHTML',
          false,
          `<a href="/u/${handle}" data-mention="${handle}" class="mention-link">@${handle}</a>&nbsp;`
        );
      }
      close();
    },
    [close]
  );

  useEffect(() => {
    const onInput = () => window.requestAnimationFrame(refresh);
    function onKeyDown(e: KeyboardEvent) {
      const st = stateRef.current;
      if (!st.open) return;
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        e.stopPropagation();
        const d = e.key === 'ArrowDown' ? 1 : -1;
        setIndex((i) => (i + d + st.items.length) % st.items.length);
      } else if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        e.stopPropagation();
        choose(st.items[st.index]);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        close();
      }
    }
    function onPointer(e: PointerEvent) {
      if (!(e.target as HTMLElement)?.closest?.('[data-mention-popover]')) window.setTimeout(refresh, 0);
    }
    document.addEventListener('input', onInput, true);
    window.addEventListener('keydown', onKeyDown, true);
    document.addEventListener('pointerdown', onPointer, true);
    window.addEventListener('scroll', close, true);
    return () => {
      document.removeEventListener('input', onInput, true);
      window.removeEventListener('keydown', onKeyDown, true);
      document.removeEventListener('pointerdown', onPointer, true);
      window.removeEventListener('scroll', close, true);
    };
  }, [refresh, choose, close]);

  if (!target || !items.length || !pos) return null;

  return (
    <div
      data-mention-popover
      role="listbox"
      aria-label="Marcar alguém"
      style={{ left: Math.max(8, pos.left), top: pos.top, transform: pos.up ? 'translateY(-100%)' : undefined }}
      className="fixed z-[9996] w-64 rounded-xl border border-border bg-surface/95 backdrop-blur-xl shadow-2xl py-1 overflow-hidden"
    >
      {items.map((c, i) => (
        <button
          key={c.id}
          type="button"
          role="option"
          aria-selected={i === index}
          onMouseDown={(e) => e.preventDefault()}
          onMouseEnter={() => setIndex(i)}
          onClick={() => choose(c)}
          className={`w-full flex items-center gap-2.5 px-3 py-2 text-left ${i === index ? 'bg-accent-soft' : ''}`}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={c.avatar_url || '/assets/net/default-perfil'} alt="" className="w-7 h-7 rounded-full object-cover bg-elevated border border-border shrink-0" />
          <span className="min-w-0">
            <span className="block text-xs font-bold text-primary truncate">{c.display_name || c.full_name || c.username}</span>
            <span className="block text-[11px] text-muted truncate">@{c.username}</span>
          </span>
        </button>
      ))}
    </div>
  );
}
