'use client';

/**
 * Backup portátil em um clique: o Notebook inteiro ou um projeto, com os
 * textos em Markdown, os dados em JSON e (opcional) as mídias originais.
 */
import { notify } from '@/lib/ui/feedback';
import { useMemo, useState } from 'react';
import { Download, Loader2, X } from 'lucide-react';
import type { NotebookApi } from '@/lib/notebook/useNotebook';
import type { NotebookEntry } from '@/lib/notebook/entries';
import { exportAll } from '@/lib/notebook/interop';
import { isProject } from '@/lib/notebook/projects';
import { NbPortal } from '../history/VersionHistory';

export function BackupDialog({ api, entries, projectId, onClose }: { api: NotebookApi; entries: Record<string, NotebookEntry>; projectId: string | null; onClose: () => void }) {
  const projects = useMemo(() => Object.values(api.items).filter((i) => isProject(i) && !i.archived_at).sort((a, b) => a.title.localeCompare(b.title)), [api.items]);
  const [scope, setScope] = useState<string>(projectId || 'tudo');
  const [media, setMedia] = useState(true);
  const [progress, setProgress] = useState<[number, number] | null>(null);
  const [done, setDone] = useState<{ files: number; media: number; failed: string[] } | null>(null);

  const run = async () => {
    setDone(null);
    setProgress([0, 1]);
    try {
      const r = await exportAll(api, entries, (n, t) => setProgress([n, t]), { projectId: scope === 'tudo' ? null : scope, media });
      setDone(r);
    } catch {
      notify('Não foi possível gerar o arquivo .zip.');
    }
    setProgress(null);
  };

  return (
    <NbPortal>
      <div className="nb-modal-back" onClick={() => !progress && onClose()}>
        <div className="nb-modal nb-backup !max-w-md" role="dialog" aria-label="Backup do Notebook" onClick={(e) => e.stopPropagation()}>
          <header>
            <h2>Backup (.zip)</h2>
            <button type="button" onClick={onClose} disabled={!!progress} aria-label="Fechar">
              <X className="w-4 h-4" />
            </button>
          </header>
          <div className="nb-backup-body">
            <label>
              <span>O que entra</span>
              <select value={scope} onChange={(e) => setScope(e.target.value)} disabled={!!progress}>
                <option value="tudo">Todo o Notebook</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    Projeto: {p.title}
                  </option>
                ))}
              </select>
            </label>
            <label className="nb-backup-check">
              <input type="checkbox" checked={media} onChange={(e) => setMedia(e.target.checked)} disabled={!!progress} />
              <span>
                Incluir as mídias originais
                <small>Imagens, PDFs, áudios e vídeos sem perda de qualidade. O arquivo fica maior.</small>
              </span>
            </label>
            <ul className="nb-backup-list">
              <li>
                <strong>Markdown/</strong> notas, capítulos e fichas; canvases em JSON Canvas
              </li>
              <li>
                <strong>dados/</strong> verbetes, relações, Codex, fontes e canvases em JSON
              </li>
              {media && (
                <li>
                  <strong>midias/</strong> os originais, já ligados ao Markdown
                </li>
              )}
              <li>
                <strong>insight-notebook-backup.json</strong> para importar de volta
              </li>
            </ul>
            {progress && (
              <div className="nb-backup-progress" aria-live="polite">
                <span style={{ width: `${Math.round((progress[0] / Math.max(1, progress[1])) * 100)}%` }} />
                <small>
                  Preparando {progress[0]} de {progress[1]}…
                </small>
              </div>
            )}
            {done && (
              <p className="nb-backup-done">
                Pronto: {done.files} arquivos{done.media ? `, ${done.media} mídias` : ''}.{done.failed.length ? ` ${done.failed.length} não puderam ser baixadas (lista no LEIA-ME).` : ''}
              </p>
            )}
          </div>
          <footer>
            <button type="button" onClick={() => void run()} disabled={!!progress}>
              {progress ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              Gerar .zip
            </button>
          </footer>
        </div>
      </div>
    </NbPortal>
  );
}
