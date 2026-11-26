'use client';

import { useEffect, useState } from 'react';
import { MarkdownEditor } from '../MarkdownEditor';
import { RichNoteEditor, type RichNoteEditorProps } from './RichNoteEditor';

const MODE_KEY = 'insight-nb-editor-mode';
type Mode = 'visual' | 'markdown';

/**
 * Editor universal das notas: modo Visual (novo editor) e modo Markdown
 * (código-fonte, com pré-visualização). Os dois leem e gravam o mesmo markdown.
 */
export function NoteEditor(props: RichNoteEditorProps) {
  const [mode, setMode] = useState<Mode>('visual');
  useEffect(() => {
    try {
      const m = localStorage.getItem(MODE_KEY);
      if (m === 'visual' || m === 'markdown') setMode(m);
    } catch {
      /* ignora */
    }
  }, []);
  const choose = (m: Mode) => {
    setMode(m);
    try {
      localStorage.setItem(MODE_KEY, m);
    } catch {
      /* ignora */
    }
  };

  return (
    <div>
      <div className="flex justify-end -mt-2 mb-2">
        <div className="inline-flex p-0.5 rounded-lg border border-[var(--nb-line)] bg-[var(--nb-pane)]" role="radiogroup" aria-label="Modo do editor">
          {(
            [
              ['visual', 'Visual'],
              ['markdown', 'Markdown'],
            ] as const
          ).map(([m, label]) => (
            <button
              key={m}
              type="button"
              role="radio"
              aria-checked={mode === m}
              onClick={() => choose(m)}
              className={`h-6 px-2.5 rounded-md text-[11px] font-bold transition-colors ${
                mode === m ? 'bg-[var(--nb-pane-2)] text-[var(--nb-ink)]' : 'text-[var(--nb-ink-3)] hover:text-[var(--nb-ink)]'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      {mode === 'visual' ? <RichNoteEditor key="v" {...props} variant={props.item.template === 'poem' ? 'poem' : props.item.template === 'article' ? 'article' : undefined} /> : <MarkdownEditor key="m" {...props} />}
    </div>
  );
}
