'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import { BubbleMenu } from '@tiptap/react/menus';
import StarterKit from '@tiptap/starter-kit';
import { Markdown } from '@tiptap/markdown';
import Highlight from '@tiptap/extension-highlight';
import { Placeholder } from '@tiptap/extensions';
import { Bold, Highlighter, Italic, List, Quote, Strikethrough } from 'lucide-react';
import { Glyph } from '../icons/Glyph';
import { EntryRef, TagHighlight, WikiLink } from './extensions';
import { EntryLinkButtons } from './RichNoteEditor';
import { useNotebookLinks } from './linkContext';

/**
 * Campo de texto rico e leve (ficha de personagem e afins): negrito, itálico,
 * listas, citação, marca-texto e [[ligações]]. Lê e devolve markdown.
 */
export function RichField({
  value,
  onChange,
  placeholder,
  serif = false,
  className = '',
  label,
}: {
  value: string;
  onChange: (md: string) => void;
  placeholder?: string;
  serif?: boolean;
  className?: string;
  label?: string;
}) {
  const links = useNotebookLinks();
  const existsRef = useRef(links.exists);
  existsRef.current = links.exists;
  const openRef = useRef(links.open);
  openRef.current = links.open;
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const last = useRef(value);

  const extensions = useMemo(
    () => [
      StarterKit.configure({ underline: false, code: false, codeBlock: false, horizontalRule: false, heading: { levels: [3] }, link: { openOnClick: false, autolink: true } }),
      Highlight,
      Markdown,
      WikiLink.configure({ exists: (t: string) => existsRef.current(t) }),
      TagHighlight,
      EntryRef,
      Placeholder.configure({ placeholder: placeholder || '' }),
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const editor = useEditor({
    extensions,
    content: value || '',
    contentType: 'markdown',
    immediatelyRender: false,
    editorProps: {
      attributes: { 'aria-label': label || placeholder || 'Texto', spellcheck: 'true' },
      handleClickOn: (_v, _p, node, _np, e) => {
        if (node.type.name === 'wikiLink') {
          e.preventDefault();
          openRef.current(node.attrs.target);
          return true;
        }
        return false;
      },
    },
    onUpdate: ({ editor: ed }) => {
      const md = ed.getMarkdown().replace(/\n{3,}/g, '\n\n').trim();
      if (md === last.current) return;
      last.current = md;
      onChangeRef.current(md);
    },
  });

  // valor trocado por fora (ex.: conversão): recarrega sem perder o cursor à toa
  useEffect(() => {
    if (!editor || value === last.current) return;
    last.current = value;
    editor.commands.setContent(value || '', { contentType: 'markdown', emitUpdate: false });
  }, [editor, value]);

  const c = () => editor!.chain().focus();
  const btn = (labelTxt: string, active: boolean, run: () => void, icon: React.ReactNode) => (
    <button
      type="button"
      title={labelTxt}
      aria-label={labelTxt}
      aria-pressed={active}
      onMouseDown={(e) => e.preventDefault()}
      onClick={run}
      className={`h-7 w-7 grid place-items-center rounded-md [&>svg]:w-3.5 [&>svg]:h-3.5 ${
        active ? 'bg-[var(--nb-hl-soft)] text-[var(--nb-hl)]' : 'text-[var(--nb-ink-3)] hover:text-[var(--nb-ink)] hover:bg-[var(--nb-pane-2)]'
      }`}
    >
      {icon}
    </button>
  );

  return (
    <div className={`nb-field ${className}`} style={serif ? { fontFamily: "var(--nb-literata), Georgia, 'Times New Roman', serif" } : undefined}>
      {editor && (
        <BubbleMenu editor={editor}>
          <div className="nb-rich-bubble" style={{ fontFamily: 'var(--font-sans, ui-sans-serif), system-ui, sans-serif' }}>
            {btn('Negrito', editor.isActive('bold'), () => c().toggleBold().run(), <Bold />)}
            {btn('Itálico', editor.isActive('italic'), () => c().toggleItalic().run(), <Italic />)}
            {btn('Tachado', editor.isActive('strike'), () => c().toggleStrike().run(), <Strikethrough />)}
            {btn('Marca-texto', editor.isActive('highlight'), () => c().toggleHighlight().run(), <Highlighter />)}
            {btn('Lista', editor.isActive('bulletList'), () => c().toggleBulletList().run(), <List />)}
            {btn('Citação', editor.isActive('blockquote'), () => c().toggleBlockquote().run(), <Quote />)}
            {btn(
              'Transformar em ligação para nota',
              false,
              () => {
                const { from, to } = editor.state.selection;
                const text = editor.state.doc.textBetween(from, to, ' ').trim().slice(0, 120);
                if (text) c().insertContentAt({ from, to }, { type: 'wikiLink', attrs: { target: text } }).run();
              },
              <Glyph name="mindmap" className="text-[14px]" />
            )}
            <span className="w-px h-4 mx-0.5 bg-[var(--nb-line)]" />
            <EntryLinkButtons editor={editor} size="sm" />
          </div>
        </BubbleMenu>
      )}
      <EditorContent editor={editor} />
    </div>
  );
}
