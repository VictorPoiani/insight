'use client';

import { useEffect, useState } from 'react';
import type { Editor } from '@tiptap/core';
import { AlignCenter, AlignHorizontalSpaceAround, MoveHorizontal, PanelLeft, PanelRight, Trash2 } from 'lucide-react';
import { useEditorTick } from './useEditorTick';
import { FIGURE_LAYOUTS, FIGURE_WIDTHS, type FigureLayout } from './bookExtensions';

const ICON: Record<FigureLayout, React.ReactNode> = {
  center: <AlignCenter />,
  full: <MoveHorizontal />,
  wide: <AlignHorizontalSpaceAround />,
  left: <PanelLeft />,
  right: <PanelRight />,
};

/** Barra da ilustração selecionada: diagramação, largura, legenda e texto alternativo. */
export function ImageBar({ editor }: { editor: Editor }) {
  useEditorTick(editor);
  const attrs = editor.getAttributes('image') as { caption?: string; layout?: FigureLayout; width?: number; alt?: string };
  const [caption, setCaption] = useState(attrs.caption || '');
  const [alt, setAlt] = useState(attrs.alt || '');
  useEffect(() => {
    setCaption(attrs.caption || '');
    setAlt(attrs.alt || '');
  }, [attrs.caption, attrs.alt]);
  const set = (patch: Record<string, unknown>) => editor.chain().updateAttributes('image', patch).run();
  const layout = attrs.layout || 'center';
  const width = Number(attrs.width) || 100;
  const sized = layout === 'center' || layout === 'left' || layout === 'right';

  return (
    <div className="nb-rich-bubble flex-col !items-stretch gap-1.5 p-2 w-[300px]" onMouseDown={(e) => e.stopPropagation()}>
      <div className="flex items-center gap-0.5">
        {FIGURE_LAYOUTS.map((l) => (
          <button
            key={l.id}
            type="button"
            title={l.label}
            aria-label={l.label}
            aria-pressed={layout === l.id}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => set({ layout: l.id, ...(l.id === 'left' || l.id === 'right' ? { width: Math.min(width, 50) } : {}) })}
            className={`h-7 w-7 grid place-items-center rounded-md [&>svg]:w-3.5 [&>svg]:h-3.5 ${
              layout === l.id ? 'bg-[var(--nb-hl-soft)] text-[var(--nb-hl)]' : 'text-[var(--nb-ink-3)] hover:text-[var(--nb-ink)] hover:bg-[var(--nb-pane-2)]'
            }`}
          >
            {ICON[l.id]}
          </button>
        ))}
        <span className="flex-1" />
        <button
          type="button"
          title="Remover ilustração"
          aria-label="Remover ilustração"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => editor.chain().focus().deleteSelection().run()}
          className="h-7 w-7 grid place-items-center rounded-md text-[var(--nb-ink-3)] hover:text-red-400 [&>svg]:w-3.5 [&>svg]:h-3.5"
        >
          <Trash2 />
        </button>
      </div>
      {sized && (
        <label className="flex items-center gap-2 px-1 text-[11px] text-[var(--nb-ink-3)]">
          Largura
          <input
            type="range"
            min={0}
            max={FIGURE_WIDTHS.length - 1}
            step={1}
            value={Math.max(0, FIGURE_WIDTHS.indexOf(width))}
            onChange={(e) => set({ width: FIGURE_WIDTHS[Number(e.target.value)] })}
            className="flex-1 accent-[var(--nb-hl)]"
            aria-label="Largura da ilustração"
          />
          <span className="w-9 text-right tabular-nums text-[var(--nb-ink-2)]">{width}%</span>
        </label>
      )}
      <input
        value={caption}
        onChange={(e) => setCaption(e.target.value.slice(0, 240))}
        onBlur={() => set({ caption: caption.trim() })}
        onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), set({ caption: caption.trim() }), editor.commands.focus())}
        placeholder="Legenda (opcional)"
        aria-label="Legenda"
        className="h-7 px-2 rounded-md bg-[var(--nb-pane-2)] text-[12px] outline-none"
      />
      <input
        value={alt}
        onChange={(e) => setAlt(e.target.value.slice(0, 300))}
        onBlur={() => set({ alt: alt.trim() })}
        placeholder="Descrição para leitores de tela"
        aria-label="Texto alternativo"
        className="h-7 px-2 rounded-md bg-[var(--nb-pane-2)] text-[12px] outline-none"
      />
    </div>
  );
}
