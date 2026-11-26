'use client';

/**
 * Exporta o artigo em Word (.docx) com a diagramação da norma: margens,
 * fonte, entrelinha, recuos, citação longa, legendas, notas de rodapé nativas
 * do Word, numeração de página e referências.
 */
import type { ArticleData } from '@/lib/notebook/article';
import type { Source } from '@/lib/notebook/sources';
import { PAGE_SPECS, articleMarkdown, buildArticle } from '@/lib/notebook/articleRender';
import { download, safeName } from '@/lib/notebook/interop';
import { articleBlocks } from './ArticleSheet';

const TW = 567; // twips por cm

export async function exportArticleDocx(title: string, md: string, sources: Record<string, Source>, a: ArticleData, cited: string[]) {
  const d = await import('docx');
  const spec = PAGE_SPECS[a.norm];
  const out = buildArticle(title, md, sources, a, cited);
  const blocks = await articleBlocks(out, a);
  const size = Math.round(spec.size * 2); // meio-pontos
  const small = Math.round((spec.size - 2) * 2);
  const line = Math.round(240 * spec.line);
  const footnotes: Record<number, { children: InstanceType<typeof d.Paragraph>[] }> = {};
  out.notes.forEach((n, i) => {
    const tmp = document.createElement('div');
    tmp.innerHTML = n;
    footnotes[i + 1] = { children: [new d.Paragraph({ children: [new d.TextRun({ text: tmp.textContent || '', size: small, font: 'Times New Roman' })], spacing: { line: 240 } })] };
  });

  type Run = InstanceType<typeof d.TextRun> | InstanceType<typeof d.FootnoteReferenceRun> | InstanceType<typeof d.ImageRun>;
  /** texto com negrito, itálico, sobrescrito e notas */
  const runs = (el: Node, st: { b?: boolean; i?: boolean; sz?: number; sup?: boolean } = {}): Run[] => {
    const out2: Run[] = [];
    el.childNodes.forEach((n) => {
      if (n.nodeType === 3) {
        const text = (n.textContent || '').replace(/\s+/g, ' ');
        if (text) out2.push(new d.TextRun({ text, bold: st.b, italics: st.i, size: st.sz || size, superScript: st.sup, font: spec.font.includes('Georgia') ? 'Georgia' : 'Times New Roman' }));
        return;
      }
      if (n.nodeType !== 1) return;
      const e = n as HTMLElement;
      const tag = e.tagName;
      if (tag === 'SUP' && e.classList.contains('nb-fn-ref')) {
        const id = Number(e.textContent);
        if (footnotes[id]) out2.push(new d.FootnoteReferenceRun(id));
        return;
      }
      if (tag === 'BR') return void out2.push(new d.TextRun({ break: 1 }));
      if (e.classList.contains('ar-math') || e.classList.contains('katex')) {
        const tex = e.querySelector('annotation')?.textContent || e.textContent || '';
        return void out2.push(new d.TextRun({ text: tex, italics: true, size: st.sz || size }));
      }
      out2.push(
        ...runs(e, {
          ...st,
          b: st.b || tag === 'STRONG' || tag === 'B',
          i: st.i || tag === 'EM' || tag === 'I',
          sup: st.sup || tag === 'SUP',
        })
      );
    });
    return out2;
  };

  const P = d.Paragraph;
  const A = d.AlignmentType;
  const body: (InstanceType<typeof d.Paragraph> | InstanceType<typeof d.Table>)[] = [];
  const para = (children: Run[], o: Record<string, unknown> = {}) =>
    new P({ children, spacing: { line, after: a.norm === 'abnt' ? 0 : 120 }, alignment: a.norm === 'abnt' ? A.JUSTIFIED : A.LEFT, indent: spec.indent ? { firstLine: Math.round(spec.indent * TW) } : undefined, ...o });

  for (const el of blocks) {
    const tag = el.tagName;
    if (el.classList.contains('ar-title')) {
      body.push(new P({ children: [new d.TextRun({ text: a.norm === 'abnt' ? (el.textContent || '').toUpperCase() : el.textContent || '', bold: true, size })], alignment: A.CENTER, spacing: { after: 240 } }));
    } else if (el.classList.contains('ar-subtitle')) {
      body.push(new P({ children: runs(el), alignment: A.CENTER, spacing: { after: 360 } }));
    } else if (el.classList.contains('ar-authors')) {
      el.querySelectorAll('p').forEach((p) => body.push(new P({ children: runs(p), alignment: a.norm === 'abnt' ? A.RIGHT : A.CENTER, spacing: { after: 0 } })));
      body.push(new P({ children: [] }));
    } else if (el.classList.contains('ar-abstract') || el.classList.contains('ar-keywords')) {
      body.push(new P({ children: runs(el), alignment: A.JUSTIFIED, spacing: { line: 240, after: 240 } }));
    } else if (/^H[1-4]$/.test(tag)) {
      const lv = Number(el.dataset.level || 1);
      const num = el.dataset.num ? `${el.dataset.num} ` : '';
      const txt = el.textContent || '';
      const isRefs = el.classList.contains('ar-refs-title');
      const upper = a.norm === 'abnt' && (lv <= 2 || isRefs);
      body.push(
        new P({
          children: [new d.TextRun({ text: `${num}${upper ? txt.toUpperCase() : txt}`, bold: lv === 1 || lv === 3 || isRefs, size })],
          alignment: isRefs && a.norm !== 'editorial' ? A.CENTER : A.LEFT,
          spacing: { before: 360, after: 240, line },
          keepNext: true,
          heading: lv === 1 ? d.HeadingLevel.HEADING_1 : lv === 2 ? d.HeadingLevel.HEADING_2 : d.HeadingLevel.HEADING_3,
        })
      );
    } else if (el.classList.contains('ar-ref')) {
      body.push(new P({ children: runs(el), alignment: A.LEFT, spacing: { line: a.norm === 'apa' ? 480 : 240, after: 240 }, indent: a.norm === 'apa' ? { hanging: Math.round(1.27 * TW), left: Math.round(1.27 * TW) } : undefined }));
    } else if (el.classList.contains('nb-longquote') || tag === 'BLOCKQUOTE') {
      // NBR 10520: recuo de 4 cm, fonte menor, espaço simples
      const ps = el.querySelectorAll('p');
      (ps.length ? Array.from(ps) : [el]).forEach((p) =>
        body.push(new P({ children: runs(p, { sz: small }), indent: { left: Math.round(4 * TW) }, alignment: A.JUSTIFIED, spacing: { line: 240, before: 120, after: 240 } }))
      );
    } else if (el.classList.contains('nb-cap')) {
      const fonte = el.classList.contains('nb-cap--fonte');
      body.push(new P({ children: runs(el, { sz: small }), alignment: fonte ? A.LEFT : A.CENTER, spacing: { line: 240, before: fonte ? 60 : 240, after: fonte ? 240 : 60 }, keepNext: !fonte }));
    } else if (tag === 'UL' || tag === 'OL') {
      Array.from(el.children).forEach((li, i) => body.push(new P({ children: [new d.TextRun({ text: tag === 'OL' ? `${i + 1}. ` : '• ', size }), ...runs(li)], indent: { left: Math.round(1.25 * TW) }, spacing: { line, after: 60 } })));
    } else if (el.classList.contains('nb-table-wrap') || tag === 'TABLE') {
      const table = tag === 'TABLE' ? el : el.querySelector('table');
      if (!table) continue;
      const rows = Array.from(table.querySelectorAll('tr')).map(
        (tr) =>
          new d.TableRow({
            children: Array.from(tr.children).map(
              (td) => new d.TableCell({ children: [new P({ children: runs(td, { sz: small, b: td.tagName === 'TH' }), spacing: { line: 240 } })] })
            ),
          })
      );
      if (rows.length) body.push(new d.Table({ rows, width: { size: 100, type: d.WidthType.PERCENTAGE } }));
    } else if (tag === 'FIGURE' || el.querySelector('img')) {
      const img = el.querySelector('img');
      const cap = el.querySelector('figcaption')?.textContent || '';
      if (cap) body.push(new P({ children: [new d.TextRun({ text: `Figura – ${cap}`, size: small })], alignment: A.CENTER, keepNext: true, spacing: { before: 240 } }));
      if (img?.getAttribute('src')) {
        try {
          const res = await fetch(img.getAttribute('src')!);
          const buf = await res.arrayBuffer();
          const bmp = await createImageBitmap(new Blob([buf]));
          const w = Math.min(15 * 37.8, bmp.width);
          const h = Math.round((w * bmp.height) / bmp.width);
          const type = /png/i.test(res.headers.get('content-type') || '') ? 'png' : 'jpg';
          body.push(new P({ children: [new d.ImageRun({ data: buf, transformation: { width: w, height: h }, type })], alignment: A.CENTER }));
        } catch {
          body.push(new P({ children: [new d.TextRun({ text: `[imagem: ${img.getAttribute('src')}]`, size: small })] }));
        }
      }
    } else if (el.classList.contains('ar-math--block') || tag === 'PRE') {
      body.push(new P({ children: runs(el), alignment: A.CENTER, spacing: { before: 120, after: 120 } }));
    } else if (tag === 'HR') {
      body.push(new P({ children: [new d.TextRun({ text: '* * *', size })], alignment: A.CENTER }));
    } else {
      body.push(para(runs(el)));
    }
  }

  const [mt, mr, mb, ml] = spec.margins.map((c) => Math.round(c * TW));
  const pageNum = new d.Header({ children: [new P({ alignment: A.RIGHT, children: [new d.TextRun({ children: [d.PageNumber.CURRENT], size: small })] })] });
  const doc = new d.Document({
    creator: 'Insight Notebook',
    title,
    styles: { default: { document: { run: { font: spec.font.includes('Georgia') ? 'Georgia' : 'Times New Roman', size } } } },
    footnotes,
    sections: [
      {
        properties: {
          page: { size: { width: 11906, height: 16838 }, margin: { top: mt, right: mr, bottom: mb, left: ml, header: Math.round(2 * TW) } },
          titlePage: a.norm === 'abnt',
        },
        headers: a.norm === 'abnt' ? { default: pageNum, first: new d.Header({ children: [] }) } : { default: pageNum },
        children: body,
      },
    ],
  });
  const blob = await d.Packer.toBlob(doc);
  download(`${safeName(title)}.docx`, blob, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
}

export function exportArticleMarkdown(title: string, md: string, sources: Record<string, Source>, a: ArticleData, cited: string[]) {
  download(`${safeName(title)}.md`, articleMarkdown(title, md, sources, a, cited), 'text/markdown;charset=utf-8');
}
