/**
 * Regras da grade de 12 colunas usada pelos blocos de post/atualização.
 *
 * gridStart = 0 significa "fluxo automático": a célula se encaixa ao lado da
 * anterior se couber (ex.: duas de 50% lado a lado). Um gridStart explícito
 * fixa a célula numa coluna — e duas células fixadas na mesma coluna nunca
 * ficam lado a lado. Por isso a coluna 1 é tratada como automática: é onde
 * uma célula em fluxo já começaria quando abre uma nova linha.
 */
export function normalizeGridSpan(span: unknown): number {
  return Math.max(3, Math.min(12, Number(span) || 12));
}

export function normalizeGridStart(start: unknown, span: unknown): number {
  const s = Number(start) || 0;
  const sp = normalizeGridSpan(span);
  if (sp >= 12 || s <= 1) return 0;
  return Math.min(s, 13 - sp);
}

export function gridCellStyle(
  span: unknown,
  start: unknown,
  height?: unknown
): { gridColumn: string; minHeight?: number; alignSelf?: 'start' } {
  const sp = normalizeGridSpan(span);
  const st = normalizeGridStart(start, sp);
  const h = normalizeBlockHeight(height);
  return {
    gridColumn: st > 0 ? `${st} / span ${sp}` : `span ${sp} / span ${sp}`,
    // altura definida na alça inferior: a célula para de esticar até a linha e
    // fica com pelo menos essa altura (nunca corta o conteúdo)
    ...(h ? { minHeight: h, alignSelf: 'start' as const } : {}),
  };
}

/** Altura de célula válida (48–1600 px) ou undefined (automática). */
export function normalizeBlockHeight(h: unknown): number | undefined {
  const n = Math.round(Number(h));
  return Number.isFinite(n) && n >= 48 ? Math.min(1600, n) : undefined;
}
