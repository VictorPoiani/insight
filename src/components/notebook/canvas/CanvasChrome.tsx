'use client';

/**
 * Peças de interface do Canvas: barra flutuante da seleção, régua de controles
 * à direita, ajustes, painel de atalhos e o seletor de notas.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlignCenterHorizontal,
  AlignCenterVertical,
  AlignEndHorizontal,
  AlignEndVertical,
  AlignHorizontalDistributeCenter,
  AlignStartHorizontal,
  AlignStartVertical,
  AlignVerticalDistributeCenter,
  BookMarked,
  CircleHelp,
  Download,
  ExternalLink,
  FileText,
  Focus,
  Group,
  LayoutGrid,
  Lock,
  LockOpen,
  Maximize,
  Minus,
  Palette,
  Pencil,
  Plus,
  Redo2,
  Settings2,
  Trash2,
  Undo2,
  X,
} from 'lucide-react';
import type { NotebookItem } from '@/lib/notebook/types';
import { CANVAS_COLORS } from '@/lib/notebook/canvas';
import { CANVAS_TEMPLATES } from '@/lib/notebook/canvasTemplates';
import { entryLook, type NotebookEntry } from '@/lib/notebook/entries';
import { Glyph } from '../icons/Glyph';
import type { AlignKind } from '@/lib/notebook/canvasGeom';
import { itemIcon } from '../FileExplorer';
import { NbPortal } from '../history/VersionHistory';

/** Fecha um popover ao clicar fora. */
function useOutside(open: boolean, close: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const h = (e: PointerEvent) => !ref.current?.contains(e.target as Node) && close();
    window.addEventListener('pointerdown', h, true);
    return () => window.removeEventListener('pointerdown', h, true);
  }, [open, close]);
  return ref;
}

export function SelectionBar({
  x,
  y,
  below,
  count,
  kind,
  locked,
  onDelete,
  onColor,
  onZoom,
  onEdit,
  onOpen,
  onAlign,
  onDistribute,
  onGrid,
  onGroup,
  onLock,
}: {
  x: number;
  y: number;
  below: boolean;
  count: number;
  kind: string | null;
  locked: boolean;
  onDelete: () => void;
  onColor: (c: string | null) => void;
  onZoom: () => void;
  onEdit?: () => void;
  onOpen?: () => void;
  onAlign: (k: AlignKind) => void;
  onDistribute: (axis: 'x' | 'y') => void;
  onGrid: () => void;
  onGroup: () => void;
  onLock: () => void;
}) {
  const [pop, setPop] = useState<'color' | 'align' | null>(null);
  const ref = useOutside(!!pop, () => setPop(null));
  const multi = count > 1;
  return (
    <div ref={ref} className="nb-cv-selbar" data-cv-ui data-below={below || undefined} style={{ left: x, top: y }} onPointerDown={(e) => e.stopPropagation()}>
      <button type="button" title="Apagar (Del)" aria-label="Apagar" onClick={onDelete}>
        <Trash2 />
      </button>
      <button type="button" title="Cor" aria-label="Cor" data-on={pop === 'color' || undefined} onClick={() => setPop(pop === 'color' ? null : 'color')}>
        <Palette />
      </button>
      <button type="button" title="Ampliar na seleção (Shift+2)" aria-label="Ampliar na seleção" onClick={onZoom}>
        <Focus />
      </button>
      {!multi && onEdit && (
        <button type="button" title="Editar (Enter)" aria-label="Editar" onClick={onEdit}>
          <Pencil />
        </button>
      )}
      {!multi && onOpen && (
        <button type="button" title={kind === 'image' ? 'Abrir o original' : 'Abrir'} aria-label="Abrir" onClick={onOpen}>
          <ExternalLink />
        </button>
      )}
      {multi && (
        <>
          <button type="button" title="Alinhar e distribuir" aria-label="Alinhar e distribuir" data-on={pop === 'align' || undefined} onClick={() => setPop(pop === 'align' ? null : 'align')}>
            <AlignStartVertical />
          </button>
          <button type="button" title="Criar grupo (Ctrl+G)" aria-label="Criar grupo" onClick={onGroup}>
            <Group />
          </button>
        </>
      )}
      <button type="button" title={locked ? 'Destravar (Ctrl+Shift+L)' : 'Travar posição (Ctrl+Shift+L)'} aria-label={locked ? 'Destravar' : 'Travar'} onClick={onLock}>
        {locked ? <LockOpen /> : <Lock />}
      </button>

      {pop === 'color' && (
        <div className="nb-cv-pop nb-cv-swatches">
          <button type="button" className="nb-cv-swatch nb-cv-swatch--none" title="Sem cor" aria-label="Sem cor" onClick={() => (onColor(null), setPop(null))} />
          {CANVAS_COLORS.map((c) => (
            <button key={c.id} type="button" className="nb-cv-swatch" title={c.label} aria-label={c.label} style={{ background: c.css }} onClick={() => (onColor(c.id), setPop(null))} />
          ))}
        </div>
      )}
      {pop === 'align' && (
        <div className="nb-cv-pop nb-cv-align">
          <span className="nb-cv-pop-h">Alinhar</span>
          <div className="nb-cv-pop-row">
            {(
              [
                ['left', AlignStartVertical, 'À esquerda'],
                ['hcenter', AlignCenterVertical, 'Ao centro (horizontal)'],
                ['right', AlignEndVertical, 'À direita'],
                ['top', AlignStartHorizontal, 'Em cima'],
                ['vcenter', AlignCenterHorizontal, 'Ao meio (vertical)'],
                ['bottom', AlignEndHorizontal, 'Embaixo'],
              ] as const
            ).map(([k, Icon, label]) => (
              <button key={k} type="button" title={label} aria-label={label} onClick={() => onAlign(k)}>
                <Icon />
              </button>
            ))}
          </div>
          <span className="nb-cv-pop-h">Distribuir</span>
          <div className="nb-cv-pop-row">
            <button type="button" title="Espaços iguais na horizontal" aria-label="Distribuir na horizontal" disabled={count < 3} onClick={() => onDistribute('x')}>
              <AlignHorizontalDistributeCenter />
            </button>
            <button type="button" title="Espaços iguais na vertical" aria-label="Distribuir na vertical" disabled={count < 3} onClick={() => onDistribute('y')}>
              <AlignVerticalDistributeCenter />
            </button>
            <button type="button" title="Organizar em grade" aria-label="Organizar em grade" onClick={onGrid}>
              <LayoutGrid />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export interface CanvasPrefs {
  snap: boolean;
  grid: boolean;
}

export function RightRail({
  zoom,
  canUndo,
  canRedo,
  prefs,
  setPrefs,
  onZoomIn,
  onZoomOut,
  onReset,
  onFit,
  onUndo,
  onRedo,
  onHelp,
  onDownload,
}: {
  zoom: number;
  canUndo: boolean;
  canRedo: boolean;
  prefs: CanvasPrefs;
  setPrefs: (p: CanvasPrefs) => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onReset: () => void;
  onFit: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onHelp: () => void;
  onDownload: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useOutside(open, () => setOpen(false));
  return (
    <div ref={ref} className="nb-cv-rail" data-cv-ui onPointerDown={(e) => e.stopPropagation()}>
      <div className="nb-cv-rail-group">
        <button type="button" title="Ajustes do canvas" aria-label="Ajustes do canvas" data-on={open || undefined} onClick={() => setOpen((o) => !o)}>
          <Settings2 />
        </button>
      </div>
      <div className="nb-cv-rail-group">
        <button type="button" title="Aproximar (Ctrl+roda)" aria-label="Aproximar" onClick={onZoomIn}>
          <Plus />
        </button>
        <button type="button" title="Voltar para 100% (Shift+0)" aria-label="Voltar para 100%" className="nb-cv-rail-zoom" onClick={onReset}>
          {Math.round(zoom * 100)}%
        </button>
        <button type="button" title="Enquadrar tudo (Shift+1)" aria-label="Enquadrar tudo" onClick={onFit}>
          <Maximize />
        </button>
        <button type="button" title="Afastar" aria-label="Afastar" onClick={onZoomOut}>
          <Minus />
        </button>
      </div>
      <div className="nb-cv-rail-group">
        <button type="button" title="Desfazer (Ctrl+Z)" aria-label="Desfazer" disabled={!canUndo} onClick={onUndo}>
          <Undo2 />
        </button>
        <button type="button" title="Refazer (Ctrl+Shift+Z)" aria-label="Refazer" disabled={!canRedo} onClick={onRedo}>
          <Redo2 />
        </button>
      </div>
      <div className="nb-cv-rail-group">
        <button type="button" title="Atalhos (?)" aria-label="Atalhos" onClick={onHelp}>
          <CircleHelp />
        </button>
      </div>
      {open && (
        <div className="nb-cv-pop nb-cv-settings">
          <span className="nb-cv-pop-h">Ao mover</span>
          <label>
            <input type="checkbox" checked={prefs.snap} onChange={(e) => setPrefs({ ...prefs, snap: e.target.checked })} />
            <span>
              Guias magnéticas
              <small>Encosta em bordas, centros e espaços iguais. Segure Alt para soltar.</small>
            </span>
          </label>
          <label>
            <input type="checkbox" checked={prefs.grid} onChange={(e) => setPrefs({ ...prefs, grid: e.target.checked })} />
            <span>
              Encaixar na grade
              <small>Posições de 20 em 20 pontos.</small>
            </span>
          </label>
          <span className="nb-cv-pop-h">Arquivo</span>
          <button type="button" className="nb-cv-pop-item" onClick={() => (onDownload(), setOpen(false))}>
            <Download /> Baixar .canvas (abre no Obsidian)
          </button>
        </div>
      )}
    </div>
  );
}

const SHORTCUTS: [string, [string, string][]][] = [
  [
    'Navegar',
    [
      ['Arrastar o vazio', 'Seleção em área'],
      ['Espaço + arrastar', 'Mover a vista'],
      ['Botão do meio', 'Mover a vista'],
      ['Roda / dois dedos', 'Rolar'],
      ['Ctrl + roda / pinça', 'Zoom no cursor'],
      ['Shift + 1', 'Enquadrar tudo'],
      ['Shift + 2', 'Ampliar na seleção'],
      ['Shift + 0', 'Zoom em 100%'],
    ],
  ],
  [
    'Selecionar e mover',
    [
      ['Shift + clique', 'Somar ou tirar da seleção'],
      ['Ctrl + A', 'Selecionar tudo'],
      ['Setas', 'Mover 1 ponto (Shift: 10)'],
      ['Alt ao arrastar', 'Sem guias magnéticas'],
      ['Shift ao redimensionar', 'Manter a proporção'],
      ['Esc', 'Limpar a seleção'],
    ],
  ],
  [
    'Editar',
    [
      ['Clique duplo no vazio', 'Novo cartão'],
      ['Enter', 'Editar o cartão'],
      ['Ctrl + Z', 'Desfazer'],
      ['Ctrl + Shift + Z / Ctrl + Y', 'Refazer'],
      ['Ctrl + C / X / V', 'Copiar, recortar, colar'],
      ['Ctrl + D', 'Duplicar'],
      ['Del', 'Apagar'],
    ],
  ],
  [
    'Arrumar',
    [
      ['Ctrl + G', 'Criar grupo'],
      ['Ctrl + Shift + G', 'Desfazer o grupo'],
      ['Ctrl + Shift + L', 'Travar ou destravar'],
      [']  /  [', 'Avançar ou recuar uma camada'],
      ['Shift + ]  /  Shift + [', 'Para a frente ou para trás de tudo'],
    ],
  ],
];

export function HelpPanel({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onClose]);
  return (
    <NbPortal>
      <div className="nb-modal-back" onClick={onClose}>
        <div className="nb-modal nb-cv-help !max-w-2xl" role="dialog" aria-label="Atalhos do canvas" onClick={(e) => e.stopPropagation()}>
          <header>
            <h2>Atalhos do canvas</h2>
            <button type="button" onClick={onClose} aria-label="Fechar">
              <X className="w-4 h-4" />
            </button>
          </header>
          <div className="nb-cv-help-grid">
            {SHORTCUTS.map(([h, rows]) => (
              <section key={h}>
                <h3>{h}</h3>
                <dl>
                  {rows.map(([k, v]) => (
                    <div key={k}>
                      <dt>{k}</dt>
                      <dd>{v}</dd>
                    </div>
                  ))}
                </dl>
              </section>
            ))}
          </div>
        </div>
      </div>
    </NbPortal>
  );
}

export function NotePicker({ items, onPick, onClose }: { items: NotebookItem[]; onPick: (i: NotebookItem) => void; onClose: () => void }) {
  const [q, setQ] = useState('');
  const [sel, setSel] = useState(0);
  const list = useMemo(() => {
    const t = q.trim().toLowerCase();
    return items
      .filter((i) => !t || i.title.toLowerCase().includes(t))
      .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
      .slice(0, 40);
  }, [items, q]);
  return (
    <NbPortal>
      <div className="nb-modal-back" onClick={onClose}>
        <div className="nb-modal !max-w-lg" role="dialog" aria-label="Escolher nota" onClick={(e) => e.stopPropagation()}>
          <label className="flex items-center gap-3 px-4 h-14 border-b border-[var(--nb-line)]">
            <FileText className="w-4 h-4 text-[var(--nb-ink-3)]" />
            <input
              autoFocus
              value={q}
              onChange={(e) => (setQ(e.target.value), setSel(0))}
              onKeyDown={(e) => {
                if (e.key === 'ArrowDown') (e.preventDefault(), setSel((s) => Math.min(list.length - 1, s + 1)));
                if (e.key === 'ArrowUp') (e.preventDefault(), setSel((s) => Math.max(0, s - 1)));
                if (e.key === 'Enter' && list[sel]) onPick(list[sel]);
                if (e.key === 'Escape') onClose();
              }}
              placeholder="Nota para pôr no canvas…"
              aria-label="Buscar nota"
              className="flex-1 bg-transparent outline-none text-[15px]"
            />
            <button type="button" onClick={onClose} aria-label="Fechar" className="p-1 text-[var(--nb-ink-3)]">
              <X className="w-4 h-4" />
            </button>
          </label>
          <div className="nb-scroll overflow-y-auto py-1.5">
            {list.map((i, k) => (
              <button
                key={i.id}
                type="button"
                onMouseMove={() => sel !== k && setSel(k)}
                onClick={() => onPick(i)}
                className={`w-full flex items-center gap-3 px-4 py-2 text-left ${k === sel ? 'bg-white/[0.05]' : ''}`}
              >
                <span className="w-5 text-center">{itemIcon(i)}</span>
                <span className="flex-1 truncate text-sm">{i.title}</span>
              </button>
            ))}
            {!list.length && <p className="px-4 py-8 text-center text-sm text-[var(--nb-ink-3)]">Nenhuma nota encontrada.</p>}
          </div>
        </div>
      </div>
    </NbPortal>
  );
}

/** Lista de modelos (abre acima da barra de inserir). */
export function TemplateMenu({ onPick, onClose }: { onPick: (id: string) => void; onClose: () => void }) {
  const ref = useOutside(true, onClose);
  return (
    <div ref={ref} className="nb-cv-pop nb-cv-templates" role="menu" aria-label="Modelos">
      <span className="nb-cv-pop-h">Modelos</span>
      {CANVAS_TEMPLATES.map((t) => (
        <button key={t.id} type="button" role="menuitem" className="nb-cv-tpl" onClick={() => onPick(t.id)}>
          <strong>{t.label}</strong>
          <span>{t.description}</span>
        </button>
      ))}
    </div>
  );
}

export function EntryPicker({ entries, onPick, onClose }: { entries: NotebookEntry[]; onPick: (e: NotebookEntry) => void; onClose: () => void }) {
  const [q, setQ] = useState('');
  const [sel, setSel] = useState(0);
  const list = useMemo(() => {
    const t = q.trim().toLowerCase();
    return entries
      .filter((e) => !t || e.title.toLowerCase().includes(t) || e.aliases.some((a) => a.toLowerCase().includes(t)))
      .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
      .slice(0, 50);
  }, [entries, q]);
  return (
    <NbPortal>
      <div className="nb-modal-back" onClick={onClose}>
        <div className="nb-modal !max-w-lg" role="dialog" aria-label="Escolher verbete" onClick={(e) => e.stopPropagation()}>
          <label className="flex items-center gap-3 px-4 h-14 border-b border-[var(--nb-line)]">
            <BookMarked className="w-4 h-4 text-[var(--nb-ink-3)]" />
            <input
              autoFocus
              value={q}
              onChange={(e) => (setQ(e.target.value), setSel(0))}
              onKeyDown={(e) => {
                if (e.key === 'ArrowDown') (e.preventDefault(), setSel((s) => Math.min(list.length - 1, s + 1)));
                if (e.key === 'ArrowUp') (e.preventDefault(), setSel((s) => Math.max(0, s - 1)));
                if (e.key === 'Enter' && list[sel]) onPick(list[sel]);
                if (e.key === 'Escape') onClose();
              }}
              placeholder="Verbete para pôr no canvas…"
              aria-label="Buscar verbete"
              className="flex-1 bg-transparent outline-none text-[15px]"
            />
            <button type="button" onClick={onClose} aria-label="Fechar" className="p-1 text-[var(--nb-ink-3)]">
              <X className="w-4 h-4" />
            </button>
          </label>
          <div className="nb-scroll overflow-y-auto py-1.5">
            {list.map((e, k) => {
              const look = entryLook(e);
              return (
                <button
                  key={e.id}
                  type="button"
                  onMouseMove={() => sel !== k && setSel(k)}
                  onClick={() => onPick(e)}
                  className={`w-full flex items-center gap-3 px-4 py-2 text-left ${k === sel ? 'bg-white/[0.05]' : ''}`}
                >
                  <span className="w-5 text-center" style={{ color: look.color }}>
                    <Glyph name={look.glyph} />
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block truncate text-sm">{e.title}</span>
                    {e.summary && <span className="block truncate text-[11.5px] text-[var(--nb-ink-3)]">{e.summary}</span>}
                  </span>
                  <span className="text-[11px] text-[var(--nb-ink-3)]">{look.label}</span>
                </button>
              );
            })}
            {!list.length && <p className="px-4 py-8 text-center text-sm text-[var(--nb-ink-3)]">Nenhum verbete encontrado.</p>}
          </div>
        </div>
      </div>
    </NbPortal>
  );
}
