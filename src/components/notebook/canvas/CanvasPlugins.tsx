'use client';

/**
 * Painel "Fontes externas" do Canvas: abas com os plugins registrados, busca e
 * resultados. Clique insere no centro; arrastar solta no ponto escolhido.
 */
import { useEffect, useRef, useState } from 'react';
import { HardDrive, KeyRound, Loader2, Search, X } from 'lucide-react';
import { CANVAS_PLUGINS, stockStatus, type PluginResult } from '@/lib/notebook/canvasPlugins';
import { downloadDriveFile, googleDriveReady, pickFromDrive } from '@/lib/notebook/googleDrive';

export const PLUGIN_DRAG = 'application/x-insight-plugin';

export function PluginPanel({
  tab,
  setTab,
  onInsert,
  onFiles,
  maxBytes,
  onClose,
}: {
  tab: string;
  setTab: (t: string) => void;
  onInsert: (r: PluginResult) => void;
  onFiles: (files: File[]) => void;
  maxBytes: number;
  onClose: () => void;
}) {
  const [status, setStatus] = useState<Record<string, boolean>>({});
  useEffect(() => {
    void stockStatus().then(setStatus);
  }, []);
  const plugin = CANVAS_PLUGINS.find((p) => p.id === tab) || CANVAS_PLUGINS[0];
  const off = (p: (typeof CANVAS_PLUGINS)[number]) => (p.id === 'gdrive' ? !googleDriveReady() : !!p.needsKey && !(p.provider && status[p.provider]));
  const locked = off(plugin);
  const [q, setQ] = useState('');
  const [state, setState] = useState<{ loading: boolean; error: string | null; results: PluginResult[]; for: string }>({ loading: false, error: null, results: [], for: '' });
  const ctrl = useRef<AbortController | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setState({ loading: false, error: null, results: [], for: '' });
    inputRef.current?.focus();
  }, [plugin.id]);

  const run = async (term = q) => {
    const t = term.trim();
    if (!t || locked) return;
    ctrl.current?.abort();
    const c = new AbortController();
    ctrl.current = c;
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const results = await plugin.search(t, c.signal);
      if (!c.signal.aborted) setState({ loading: false, error: null, results, for: t });
    } catch (err) {
      if (c.signal.aborted) return;
      setState({ loading: false, error: err instanceof Error ? err.message : 'A busca falhou.', results: [], for: t });
    }
  };

  // busca enquanto digita (menos no recortador, que espera o Enter)
  useEffect(() => {
    if (plugin.id === 'clipper' || q.trim().length < 3) return;
    const t = setTimeout(() => void run(), 450);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, plugin.id]);

  const drag = (e: React.DragEvent, r: PluginResult) => {
    e.dataTransfer.setData(PLUGIN_DRAG, JSON.stringify(r));
    e.dataTransfer.effectAllowed = 'copy';
  };

  const images = state.results.filter((r) => r.kind === 'image');
  const others = state.results.filter((r) => r.kind !== 'image');

  return (
    <aside className="nb-cv-plugins" data-cv-ui aria-label="Fontes externas" onPointerDown={(e) => e.stopPropagation()} onKeyDown={(e) => e.key === 'Escape' && onClose()}>
      <header>
        <h2>Fontes externas</h2>
        <button type="button" onClick={onClose} aria-label="Fechar">
          <X />
        </button>
      </header>
      <nav className="nb-cv-plugins-tabs" role="tablist">
        {CANVAS_PLUGINS.map((p) => (
          <button key={p.id} type="button" role="tab" aria-selected={p.id === plugin.id} data-off={off(p) || undefined} onClick={() => setTab(p.id)}>
            {p.name}
          </button>
        ))}
      </nav>
      <p className="nb-cv-plugins-desc">{plugin.description}</p>

      {locked ? (
        <div className="nb-cv-plugins-key">
          <KeyRound />
          <p>
            Esta fonte precisa de uma chave no servidor ({plugin.needsKey}). Quando ela for criada na Vercel, a aba liga sozinha.
          </p>
        </div>
      ) : plugin.id === 'gdrive' ? (
        <DrivePane onFiles={onFiles} maxBytes={maxBytes} />
      ) : (
        <>
          <form
            className="nb-cv-plugins-search"
            onSubmit={(e) => {
              e.preventDefault();
              void run();
            }}
          >
            <Search />
            <input ref={inputRef} value={q} onChange={(e) => setQ(e.target.value.slice(0, 300))} placeholder={plugin.hint} aria-label={plugin.hint} />
            {state.loading && <Loader2 className="animate-spin" />}
          </form>
          <div className="nb-cv-plugins-list nb-scroll">
            {state.error && <p className="nb-cv-plugins-msg nb-cv-plugins-msg--err">{state.error}</p>}
            {!state.error && !state.loading && state.for && !state.results.length && <p className="nb-cv-plugins-msg">Nada encontrado para “{state.for}”.</p>}
            {!state.for && !state.loading && <p className="nb-cv-plugins-msg">{plugin.id === 'clipper' ? 'Cole o endereço e aperte Enter.' : 'Digite ao menos três letras.'}</p>}
            {images.length > 0 && (
              <div className="nb-cv-plugins-grid">
                {images.map((r) => (
                  <button key={r.id} type="button" draggable onDragStart={(e) => drag(e, r)} onClick={() => onInsert(r)} title={`${r.title}\n${r.kind === 'image' ? r.credit : ''}`}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={r.kind === 'image' ? r.thumb : ''} alt={r.title} loading="lazy" referrerPolicy="no-referrer" />
                  </button>
                ))}
              </div>
            )}
            {others.map((r) => (
              <button key={r.id} type="button" className="nb-cv-plugins-row" draggable onDragStart={(e) => drag(e, r)} onClick={() => onInsert(r)}>
                {(r.kind === 'text' ? r.thumb : r.kind === 'link' ? r.image : null) && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={(r.kind === 'text' ? r.thumb : r.kind === 'link' ? r.image : '') || ''} alt="" loading="lazy" referrerPolicy="no-referrer" />
                )}
                <span>
                  <strong>{r.title}</strong>
                  <small>{r.kind === 'text' ? r.text : r.kind === 'link' ? r.description || r.url : ''}</small>
                </span>
              </button>
            ))}
          </div>
          {images.length > 0 && (
            <p className="nb-cv-plugins-foot">
              Clique para pôr no centro ou arraste para o quadro.{' '}
              {plugin.id === 'unsplash' ? 'A foto fica no Unsplash, com o crédito do fotógrafo.' : 'A imagem original sobe para o seu Notebook com o crédito do autor.'}
            </p>
          )}
        </>
      )}
    </aside>
  );
}

/** Aba do Google Drive: o seletor oficial do Google, sem busca própria. */
function DrivePane({ onFiles, maxBytes }: { onFiles: (files: File[]) => void; maxBytes: number }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const pick = async () => {
    setError(null);
    try {
      setBusy('Abrindo o Google…');
      const docs = await pickFromDrive();
      if (!docs.length) return;
      const files: File[] = [];
      const fails: string[] = [];
      for (const [i, d] of docs.slice(0, 20).entries()) {
        setBusy(`Baixando ${i + 1} de ${Math.min(docs.length, 20)}…`);
        try {
          files.push(await downloadDriveFile(d, maxBytes));
        } catch (err) {
          fails.push(err instanceof Error ? err.message : d.name);
        }
      }
      if (files.length) onFiles(files);
      if (fails.length) setError(fails.join(' '));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível abrir o Drive.');
    } finally {
      setBusy(null);
    }
  };
  return (
    <div className="nb-cv-drive">
      <button type="button" className="nb-cv-drive-btn" onClick={() => void pick()} disabled={!!busy}>
        {busy ? <Loader2 className="animate-spin" /> : <HardDrive />}
        {busy || 'Escolher do Drive'}
      </button>
      <p>Na primeira vez, o Google pede permissão. Os arquivos escolhidos sobem sem perda para o seu Notebook; Google Docs viram cartões de texto e Planilhas e Apresentações viram PDF.</p>
      {error && <p className="nb-cv-plugins-msg nb-cv-plugins-msg--err">{error}</p>}
    </div>
  );
}
