'use client';

/**
 * Quick Capture: Ctrl+Alt+N em qualquer tela do Insight abre uma caixa para
 * anotar uma ideia, um trecho ou um endereço, sem escolher projeto. Vai para a
 * Caixa de entrada do Notebook, de onde pode ser movido para um projeto ou
 * arrastado para um canvas. Sem rede, fica guardado e sobe depois.
 */
import { notify } from '@/lib/ui/feedback';
import { useEffect, useRef, useState } from 'react';
import { Loader2, X } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { enqueueWrite, isNetworkError } from '@/lib/notebook/localStore';

export const QUICK_CAPTURE_EVENT = 'insight-quick-capture';
export const QUICK_CAPTURED_EVENT = 'insight-quick-captured';
const CACHE = 'insight-quick-capture';

type Cache = { profileId: string; inboxId: string | null };
const readCache = (): Cache | null => {
  try {
    return JSON.parse(localStorage.getItem(CACHE) || 'null');
  } catch {
    return null;
  }
};
const writeCache = (c: Cache) => {
  try {
    localStorage.setItem(CACHE, JSON.stringify(c));
  } catch {
    /* ignora */
  }
};

/** Título e conteúdo a partir do que foi digitado. */
export function captureToNote(raw: string) {
  const text = raw.trim();
  const first = text.split('\n')[0].trim();
  if (/^https?:\/\/\S+$/.test(first)) {
    let host = first;
    try {
      host = new URL(first).hostname.replace(/^www\./, '');
    } catch {
      /* fica o endereço */
    }
    const rest = text.slice(first.length).trim();
    return { title: `Referência: ${host}`.slice(0, 200), content: `[${host}](${first})${rest ? `\n\n${rest}` : ''}\n` };
  }
  const title = first.replace(/^#+\s*/, '').slice(0, 80) || `Ideia de ${new Date().toLocaleDateString('pt-BR')}`;
  const body = text.split('\n').slice(1).join('\n').trim();
  return { title, content: body ? `${body}\n` : first.length > 80 ? `${first}\n` : '' };
}

export function QuickCapture() {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [state, setState] = useState<'idle' | 'saving' | 'saved' | 'queued' | 'denied'>('idle');
  const ta = useRef<HTMLTextAreaElement>(null);
  /** a conta tem o Notebook? (null = ainda não sabe) */
  const allowed = useRef<boolean | null>(null);
  useEffect(() => {
    void createClient()
      .rpc('notebook_has_access')
      .then(({ data, error }) => {
        if (!error) allowed.current = data === true;
      });
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.altKey && (e.key.toLowerCase() === 'n' || e.code === 'KeyN')) {
        // Notebook ainda trancado para a conta: o atalho não faz nada
        if (allowed.current === false) return;
        e.preventDefault();
        e.stopPropagation();
        setOpen(true);
        setState('idle');
      }
    };
    const onOpen = () => (setOpen(true), setState('idle'));
    window.addEventListener('keydown', onKey, true);
    window.addEventListener(QUICK_CAPTURE_EVENT, onOpen);
    return () => {
      window.removeEventListener('keydown', onKey, true);
      window.removeEventListener(QUICK_CAPTURE_EVENT, onOpen);
    };
  }, []);
  useEffect(() => {
    if (open) setTimeout(() => ta.current?.focus(), 30);
  }, [open]);

  const save = async () => {
    if (!text.trim()) return;
    setState('saving');
    const supabase = createClient();
    const { title, content } = captureToNote(text);
    const id = crypto.randomUUID();
    let cache = readCache();
    try {
      // perfil e acesso (guardados para funcionar sem rede da próxima vez)
      if (!cache?.profileId || navigator.onLine) {
        const [{ data: pid, error }, { data: allowed }] = await Promise.all([supabase.rpc('current_profile_id'), supabase.rpc('notebook_has_access')]);
        if (error) throw error;
        if (!pid || !allowed) return setState('denied');
        cache = { profileId: String(pid), inboxId: cache?.profileId === pid ? cache?.inboxId ?? null : null };
      }
      if (!cache) return;
      // Caixa de entrada: acha ou cria
      if (!cache.inboxId) {
        const { data: found, error } = await supabase.from('notebook_items').select('id').eq('profile_id', cache.profileId).eq('template', 'inbox').is('archived_at', null).limit(1);
        if (error) throw error;
        let inbox = (found as { id: string }[] | null)?.[0]?.id || null;
        if (!inbox) {
          inbox = crypto.randomUUID();
          const { error: e2 } = await supabase.from('notebook_items').insert({ id: inbox, profile_id: cache.profileId, kind: 'folder', template: 'inbox', title: 'Caixa de entrada', icon: 'inbox', position: -1 });
          if (e2) throw e2;
        }
        cache.inboxId = inbox;
        writeCache(cache);
      }
      const row = { id, profile_id: cache.profileId, parent_id: cache.inboxId, kind: 'note', template: 'markdown', title, content, position: Date.now() % 1_000_000_000 };
      const { error } = await supabase.from('notebook_items').insert(row);
      if (error) throw error;
      setState('saved');
      window.dispatchEvent(new CustomEvent(QUICK_CAPTURED_EVENT, { detail: { id } }));
    } catch (err) {
      // sem rede: guarda na fila (sobe quando o Notebook abrir com conexão)
      if (isNetworkError(err) && cache?.profileId) {
        if (!cache.inboxId) {
          const inbox = crypto.randomUUID();
          await enqueueWrite(cache.profileId, { table: 'notebook_items', op: 'insert', id: inbox, row: { id: inbox, profile_id: cache.profileId, kind: 'folder', template: 'inbox', title: 'Caixa de entrada', icon: 'inbox', position: -1 } });
          cache.inboxId = inbox;
          writeCache(cache);
        }
        await enqueueWrite(cache.profileId, { table: 'notebook_items', op: 'insert', id, row: { id, profile_id: cache.profileId, parent_id: cache.inboxId, kind: 'note', template: 'markdown', title, content, position: Date.now() % 1_000_000_000 } });
        setState('queued');
      } else {
        setState('idle');
        notify('Não foi possível guardar a ideia agora.');
        return;
      }
    }
    setText('');
    setTimeout(() => setOpen(false), 700);
  };

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[200] flex items-start justify-center pt-[14vh] px-4 bg-black/60" onMouseDown={() => setOpen(false)}>
      <div
        className="w-full max-w-lg rounded-lg border border-white/10 bg-[#121214] shadow-2xl"
        role="dialog"
        aria-label="Capturar ideia"
        onMouseDown={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === 'Escape') setOpen(false);
          if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) void save();
        }}
      >
        <div className="flex items-center justify-between px-4 pt-3 pb-1">
          <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-zinc-500">Caixa de entrada</span>
          <button type="button" onClick={() => setOpen(false)} aria-label="Fechar" className="p-1 text-zinc-500 hover:text-zinc-200">
            <X className="w-4 h-4" />
          </button>
        </div>
        {state === 'denied' ? (
          <p className="px-4 pb-5 pt-2 text-[13px] text-zinc-400">O Notebook ainda não está liberado para a sua conta.</p>
        ) : (
          <>
            <textarea
              ref={ta}
              value={text}
              onChange={(e) => setText(e.target.value.slice(0, 20000))}
              placeholder={'Uma ideia, um trecho ou um endereço.\nA primeira linha vira o título.'}
              aria-label="Ideia"
              rows={5}
              className="block w-full resize-none bg-transparent px-4 py-2 text-[14px] leading-relaxed text-zinc-100 outline-none placeholder:text-zinc-600"
            />
            <div className="flex items-center justify-between gap-3 border-t border-white/5 px-4 py-2.5">
              <span className="text-[11.5px] text-zinc-500">
                {state === 'saved' ? 'Guardado na Caixa de entrada.' : state === 'queued' ? 'Sem conexão: guardado neste aparelho.' : 'Ctrl+Enter para guardar · Esc para fechar'}
              </span>
              <button
                type="button"
                onClick={() => void save()}
                disabled={!text.trim() || state === 'saving'}
                className="flex h-8 items-center gap-2 rounded-md border border-white/10 px-3 text-[12.5px] font-semibold text-zinc-100 hover:border-white/25 disabled:opacity-40"
              >
                {state === 'saving' && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Guardar
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
