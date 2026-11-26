'use client';

import { useEffect, useState } from 'react';
import type { Editor } from '@tiptap/core';

/** Re-renderiza a cada transação do editor (menus que mostram estado ativo). */
export function useEditorTick(editor: Editor | null) {
  const [, force] = useState(0);
  useEffect(() => {
    if (!editor) return;
    const f = () => force((n) => n + 1);
    editor.on('transaction', f);
    return () => {
      editor.off('transaction', f);
    };
  }, [editor]);
}
