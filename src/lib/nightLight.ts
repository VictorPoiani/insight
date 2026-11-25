/**
 * Luz noturna: filtro laranja manual (warmFilter) + agendado por horário.
 * Preferências ficam em localStorage 'insight-preferences'.
 */
export interface NightLightPrefs {
  warmFilter?: number;
  nightLight?: boolean;
  nightStart?: string; // "HH:MM"
  nightEnd?: string; // "HH:MM"
  nightStrength?: number; // 0–40 (%)
}

export const NIGHT_DEFAULTS = { nightStart: '21:00', nightEnd: '06:00', nightStrength: 25 };
export const PREFS_EVENT = 'insight-preferences-changed';

function minutes(hhmm: string | undefined, fallback: string): number {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm || '') || /^(\d{1,2}):(\d{2})$/.exec(fallback)!;
  return (Math.min(23, Number(m[1])) * 60 + Math.min(59, Number(m[2]))) % 1440;
}

/** O horário agendado está valendo agora? (atravessa a meia-noite) */
export function isNightWindow(prefs: NightLightPrefs, now = new Date()): boolean {
  if (!prefs.nightLight) return false;
  const start = minutes(prefs.nightStart, NIGHT_DEFAULTS.nightStart);
  const end = minutes(prefs.nightEnd, NIGHT_DEFAULTS.nightEnd);
  const cur = now.getHours() * 60 + now.getMinutes();
  if (start === end) return true;
  return start < end ? cur >= start && cur < end : cur >= start || cur < end;
}

/** Opacidade final da camada laranja (0–1). */
export function effectiveWarmOpacity(prefs: NightLightPrefs, now = new Date()): number {
  const manual = typeof prefs.warmFilter === 'number' ? prefs.warmFilter : 0;
  const scheduled = isNightWindow(prefs, now)
    ? typeof prefs.nightStrength === 'number'
      ? prefs.nightStrength
      : NIGHT_DEFAULTS.nightStrength
    : 0;
  return Math.max(0, Math.min(40, Math.max(manual, scheduled))) / 100;
}

export function readPrefs(): Record<string, unknown> {
  try {
    return JSON.parse(localStorage.getItem('insight-preferences') || '{}') || {};
  } catch {
    return {};
  }
}

export function writePrefs(patch: Record<string, unknown>) {
  const next = { ...readPrefs(), ...patch };
  try {
    localStorage.setItem('insight-preferences', JSON.stringify(next));
  } catch {
    /* modo privado */
  }
  window.dispatchEvent(new CustomEvent(PREFS_EVENT, { detail: next }));
  return next;
}

export function applyWarmOverlay(prefs: NightLightPrefs) {
  document.documentElement.style.setProperty('--warm-overlay-opacity', effectiveWarmOpacity(prefs).toFixed(2));
}
