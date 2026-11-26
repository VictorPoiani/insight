import { GLYPHS, type GlyphName } from '@/lib/notebook/glyphs';

/** Ícone autoral do Notebook. Tamanho padrão = tamanho da fonte (1em). */
export function Glyph({ name, className = '', title }: { name: GlyphName; className?: string; title?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="1em"
      height="1em"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      className={`inline-block shrink-0 align-[-0.125em] ${className}`}
      // marcação estática definida em lib/notebook/glyphs.ts (nunca vem do usuário)
      dangerouslySetInnerHTML={{ __html: GLYPHS[name] }}
    />
  );
}
