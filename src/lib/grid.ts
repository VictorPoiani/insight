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

export function gridCellStyle(span: unknown, start: unknown): { gridColumn: string } {
  const sp = normalizeGridSpan(span);
  const st = normalizeGridStart(start, sp);
  return {
    gridColumn: st > 0 ? `${st} / span ${sp}` : `span ${sp} / span ${sp}`,
  };
}
