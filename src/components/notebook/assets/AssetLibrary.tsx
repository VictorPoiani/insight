'use client';

/**
 * Biblioteca de Mídias: tudo o que foi enviado ao R2 pelo Notebook (imagens,
 * PDFs, áudios, vídeos), com onde cada arquivo é usado, reaproveitamento sem
 * novo envio e limpeza das órfãs (sem uso em nota, capítulo, canvas ou verbete).
 *
 * Mover para a lixeira não apaga na hora: o arquivo sai do R2 depois de 30 dias
 * (rotina diária), e pode ser restaurado até lá.
 */
import { ask as confirmDialog } from '@/lib/ui/feedback';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Copy, ExternalLink, FileAudio, FileText, FileVideo, ImageIcon, Loader2, RotateCcw, Search, Trash2, X } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import type { NotebookApi } from '@/lib/notebook/useNotebook';
import type { NotebookEntry } from '@/lib/notebook/entries';
import { isProject, projectRootOf } from '@/lib/notebook/projects';
import { formatSize } from '@/lib/notebook/canvasMedia';
import { itemIcon } from '../FileExplorer';
import { NbPortal } from '../history/VersionHistory';

export interface Asset {
  id: string;
  url: string;
  r2_key: string;
  preview_key: string | null;
  content_type: string | null;
  size_bytes: number;
  width: number | null;
  height: number | null;
  original_name: string | null;
  project_id: string | null;
  item_id: string | null;
  created_at: string;
  deleted_at: string | null;
}
interface Use {
  kind: 'nota' | 'canvas' | 'verbete';
  id: string;
  title: string;
}

const BASE = (process.env.NEXT_PUBLIC_R2_PUBLIC_URL || '').trim().replace(/\/$/, '');
const typeOf = (a: Asset) => {
  const t = a.content_type || '';
  return t.startsWith('image/') ? 'imagem' : t === 'application/pdf' ? 'pdf' : t.startsWith('audio/') ? 'audio' : t.startsWith('video/') ? 'video' : 'outro';
};
const nameOf = (a: Asset) => a.original_name || a.r2_key.split('/').pop()?.replace(/^[0-9a-f-]{36}-/, '') || 'arquivo';
const thumbOf = (a: Asset) => (a.preview_key && BASE ? `${BASE}/${a.preview_key}` : typeOf(a) === 'imagem' ? a.url : null);

export function AssetLibrary({
  api,
  profileId,
  entries,
  projectId,
  onOpen,
  onPick,
  onClose,
}: {
  api: NotebookApi;
  profileId: string;
  entries: Record<string, NotebookEntry>;
  projectId: string | null;
  onOpen: (id: string) => void;
  /** modo escolher (ex.: inserir no canvas sem novo envio) */
  onPick?: (a: Asset) => void;
  onClose: () => void;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [assets, setAssets] = useState<Asset[] | null>(null);
  const [canvasUse, setCanvasUse] = useState<Map<string, Set<string>>>(new Map());
  const [view, setView] = useState<'todas' | 'orfas' | 'lixeira'>('todas');
  const [type, setType] = useState('todos');
  const [scope, setScope] = useState<string>(projectId || 'todos');
  const [q, setQ] = useState('');
  const [open, setOpen] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('notebook_assets')
      .select('id, url, r2_key, preview_key, content_type, size_bytes, width, height, original_name, project_id, item_id, created_at, deleted_at')
      .eq('profile_id', profileId)
      .order('created_at', { ascending: false })
      .limit(3000);
    const list = (data || []) as Asset[];
    setAssets(list);
    // uso nos canvases (cartões apontam para o anexo ou para o endereço)
    const map = new Map<string, Set<string>>();
    const ids = list.map((a) => a.id);
    for (let i = 0; i < ids.length; i += 200) {
      const { data: nodes } = await supabase.from('notebook_canvas_nodes').select('canvas_id, asset_id, url').in('asset_id', ids.slice(i, i + 200));
      for (const n of (nodes || []) as { canvas_id: string; asset_id: string }[]) (map.get(n.asset_id) || map.set(n.asset_id, new Set()).get(n.asset_id)!).add(n.canvas_id);
    }
    const urls = list.map((a) => a.url);
    for (let i = 0; i < urls.length; i += 100) {
      const { data: nodes } = await supabase.from('notebook_canvas_nodes').select('canvas_id, url').in('url', urls.slice(i, i + 100));
      for (const n of (nodes || []) as { canvas_id: string; url: string }[]) {
        const a = list.find((x) => x.url === n.url);
        if (a) (map.get(a.id) || map.set(a.id, new Set()).get(a.id)!).add(n.canvas_id);
      }
    }
    setCanvasUse(map);
  }, [profileId, supabase]);
  useEffect(() => {
    void load();
  }, [load]);

  /** onde cada mídia é usada */
  const uses = useMemo(() => {
    const byUrl = new Map<string, Use[]>();
    for (const it of Object.values(api.items)) {
      if (it.archived_at) continue;
      for (const u of it.media_refs || []) (byUrl.get(u) || byUrl.set(u, []).get(u)!).push({ kind: it.template === 'canvas' ? 'canvas' : 'nota', id: it.id, title: it.title });
    }
    for (const e of Object.values(entries)) if (e.image_url) (byUrl.get(e.image_url) || byUrl.set(e.image_url, []).get(e.image_url)!).push({ kind: 'verbete', id: e.id, title: e.title });
    const out = new Map<string, Use[]>();
    for (const a of assets || []) {
      const list = [...(byUrl.get(a.url) || []), ...(a.preview_key && BASE ? byUrl.get(`${BASE}/${a.preview_key}`) || [] : [])];
      for (const cid of canvasUse.get(a.id) || []) if (!list.some((x) => x.id === cid) && api.items[cid] && !api.items[cid].archived_at) list.push({ kind: 'canvas', id: cid, title: api.items[cid].title });
      out.set(a.id, list);
    }
    return out;
  }, [assets, api.items, entries, canvasUse]);

  const projects = useMemo(() => Object.values(api.items).filter((i) => isProject(i) && !i.archived_at), [api.items]);
  const projectOf = (a: Asset) => a.project_id || (a.item_id ? projectRootOf(api.items, a.item_id) : null);
  const shown = (assets || []).filter((a) => {
    if (view === 'lixeira' ? !a.deleted_at : a.deleted_at) return false;
    if (view === 'orfas' && (uses.get(a.id) || []).length) return false;
    if (type !== 'todos' && typeOf(a) !== type) return false;
    if (scope !== 'todos' && (scope === 'nenhum' ? projectOf(a) : projectOf(a) !== scope)) return false;
    if (q && !nameOf(a).toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  });
  const orphans = (assets || []).filter((a) => !a.deleted_at && !(uses.get(a.id) || []).length);
  const totalBytes = shown.reduce((s, a) => s + (Number(a.size_bytes) || 0), 0);

  const setDeleted = async (ids: string[], deleted: boolean) => {
    setBusy(true);
    const at = deleted ? new Date().toISOString() : null;
    for (let i = 0; i < ids.length; i += 200) await supabase.from('notebook_assets').update({ deleted_at: at }).in('id', ids.slice(i, i + 200));
    setAssets((list) => list && list.map((a) => (ids.includes(a.id) ? { ...a, deleted_at: at } : a)));
    setBusy(false);
  };

  const Icon = (a: Asset) => {
    const t = typeOf(a);
    const C = t === 'pdf' ? FileText : t === 'audio' ? FileAudio : t === 'video' ? FileVideo : ImageIcon;
    return <C className="w-6 h-6" />;
  };

  return (
    <NbPortal>
      <div className="nb-modal-back" onClick={onClose}>
        <div className="nb-modal nb-lib !max-w-5xl" role="dialog" aria-label="Biblioteca de mídias" onClick={(e) => e.stopPropagation()}>
          <header>
            <div>
              <h2>{onPick ? 'Escolher da biblioteca' : 'Biblioteca de mídias'}</h2>
              <p>
                {assets ? `${shown.length} ${shown.length === 1 ? 'arquivo' : 'arquivos'} · ${formatSize(totalBytes) || '0 KB'}` : 'Carregando…'}
                {onPick ? ' · reaproveita o arquivo, sem novo envio' : ''}
              </p>
            </div>
            <button type="button" onClick={onClose} aria-label="Fechar">
              <X className="w-4 h-4" />
            </button>
          </header>
          <div className="nb-lib-bar">
            <nav role="tablist">
              {(
                [
                  ['todas', 'Todas'],
                  ['orfas', `Sem uso${orphans.length ? ` (${orphans.length})` : ''}`],
                  ['lixeira', 'Na lixeira'],
                ] as const
              )
                .filter(([id]) => !onPick || id === 'todas')
                .map(([id, label]) => (
                  <button key={id} type="button" role="tab" aria-selected={view === id} onClick={() => setView(id)}>
                    {label}
                  </button>
                ))}
            </nav>
            <label className="nb-lib-search">
              <Search className="w-3.5 h-3.5" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nome do arquivo" aria-label="Buscar por nome" />
            </label>
            <select value={type} onChange={(e) => setType(e.target.value)} aria-label="Tipo">
              <option value="todos">Todos os tipos</option>
              <option value="imagem">Imagens</option>
              <option value="pdf">PDFs</option>
              <option value="audio">Áudios</option>
              <option value="video">Vídeos</option>
              <option value="outro">Outros</option>
            </select>
            <select value={scope} onChange={(e) => setScope(e.target.value)} aria-label="Projeto">
              <option value="todos">Todos os projetos</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title}
                </option>
              ))}
              <option value="nenhum">Sem projeto</option>
            </select>
            {view === 'orfas' && shown.length > 0 && (
              <button type="button" className="nb-lib-clean" disabled={busy} onClick={async () => (await confirmDialog({ message: `Mover ${shown.length} ${shown.length === 1 ? 'arquivo sem uso' : 'arquivos sem uso'} para a lixeira? Saem do armazenamento em 30 dias.`, danger: true })) && void setDeleted(shown.map((a) => a.id), true)}>
                {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />} Limpar {shown.length}
              </button>
            )}
          </div>
          <div className="nb-lib-grid nb-scroll">
            {!assets && (
              <p className="nb-lib-empty">
                <Loader2 className="w-4 h-4 animate-spin" />
              </p>
            )}
            {assets && !shown.length && <p className="nb-lib-empty">{view === 'orfas' ? 'Nenhum arquivo sem uso.' : view === 'lixeira' ? 'Lixeira vazia.' : 'Nenhum arquivo ainda.'}</p>}
            {shown.map((a) => {
              const u = uses.get(a.id) || [];
              const th = thumbOf(a);
              return (
                <article key={a.id} className="nb-lib-card" data-open={open === a.id || undefined}>
                  <button type="button" className="nb-lib-thumb" onClick={() => (onPick ? onPick(a) : setOpen(open === a.id ? null : a.id))} title={onPick ? 'Usar este arquivo' : 'Detalhes'}>
                    {th ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={th} alt="" loading="lazy" />
                    ) : (
                      Icon(a)
                    )}
                  </button>
                  <div className="nb-lib-meta">
                    <strong title={nameOf(a)}>{nameOf(a)}</strong>
                    <small>
                      {[formatSize(Number(a.size_bytes)), a.width && a.height ? `${a.width} × ${a.height}` : '', u.length ? `usada em ${u.length}` : 'sem uso'].filter(Boolean).join(' · ')}
                    </small>
                  </div>
                  {open === a.id && !onPick && (
                    <div className="nb-lib-detail">
                      {u.length > 0 && (
                        <ul>
                          {u.map((x) => (
                            <li key={`${x.kind}-${x.id}`}>
                              <button type="button" disabled={x.kind === 'verbete'} onClick={() => (onOpen(x.id), onClose())}>
                                {api.items[x.id] ? <span className="text-[12px]">{itemIcon(api.items[x.id])}</span> : null}
                                <span className="truncate">{x.title}</span>
                                <small>{x.kind}</small>
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                      <div className="nb-lib-actions">
                        <button type="button" title="Copiar o endereço" onClick={() => void navigator.clipboard?.writeText(a.url)}>
                          <Copy className="w-3.5 h-3.5" /> Endereço
                        </button>
                        {typeOf(a) === 'imagem' && (
                          <button type="button" title="Copiar como imagem em Markdown" onClick={() => void navigator.clipboard?.writeText(`![${nameOf(a).replace(/[[\]]/g, '')}](${a.url})`)}>
                            <Copy className="w-3.5 h-3.5" /> Markdown
                          </button>
                        )}
                        <a href={a.url} target="_blank" rel="noopener noreferrer" title="Abrir o original">
                          <ExternalLink className="w-3.5 h-3.5" /> Original
                        </a>
                        {a.deleted_at ? (
                          <button type="button" onClick={() => void setDeleted([a.id], false)}>
                            <RotateCcw className="w-3.5 h-3.5" /> Restaurar
                          </button>
                        ) : (
                          <button type="button" className="nb-lib-danger" onClick={async () => (!u.length || (await confirmDialog({ message: `Este arquivo é usado em ${u.length} ${u.length === 1 ? 'lugar' : 'lugares'}. Mover para a lixeira mesmo assim?`, danger: true }))) && void setDeleted([a.id], true)}>
                            <Trash2 className="w-3.5 h-3.5" /> Lixeira
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        </div>
      </div>
    </NbPortal>
  );
}
