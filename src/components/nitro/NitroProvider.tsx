'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { createClient } from '@/lib/supabase/client';
import { Profile } from '@/types/database';
import { NitroCosmetics, NitroItem, getNitroItem } from '@/lib/nitro/catalog';
import { filterCosmetics, itemLockReason, type LockReason } from '@/lib/nitro/access';
import {
  NITRO_KILL_SWITCH,
  NitroEntitlement,
  NitroEntitlementInput,
  resolveNitroEntitlement,
} from '@/lib/nitro/entitlement';
import './nitro.css';
import './themes.css';

/**
 * Interruptor geral: NEXT_PUBLIC_INSIGHT_NITRO=off desliga o Nitro inteiro
 * (inclusive para admins) sem precisar de deploy de código.
 */
export { NITRO_KILL_SWITCH };

export interface NitroViewerPrefs {
  /** Reproduzir animações de abertura ao visitar perfis. */
  playIntros: boolean;
  /** Animar molduras em listas (feed, respostas) ao passar o mouse. */
  animateLists: boolean;
}

const PREFS_KEY = 'insight-nitro-prefs';
const DEFAULT_PREFS: NitroViewerPrefs = { playIntros: true, animateLists: true };

interface NitroContextValue {
  ready: boolean;
  viewer: Profile | null;
  /** Pode usar o Nitro agora (assinatura, vitalício do Nível 5 ou admin na beta). */
  hasAccess: boolean;
  entitlement: NitroEntitlement;
  prefs: NitroViewerPrefs;
  setPrefs: (next: NitroViewerPrefs) => void;
  /** Cosméticos salvos nesta sessão, por perfil (atualização instantânea na UI). */
  overrides: Record<string, NitroCosmetics | null>;
  saveCosmetics: (next: NitroCosmetics) => Promise<{ ok: boolean; error?: string }>;
  /** Tema mostrado temporariamente (provador); null = volta ao tema salvo. */
  previewTheme: string | null;
  setPreviewTheme: (id: string | null) => void;
  /** Por que o item está bloqueado para quem está logado (null = pode usar). */
  lockReason: (item: NitroItem) => LockReason;
}

const NitroContext = createContext<NitroContextValue>({
  ready: false,
  viewer: null,
  hasAccess: false,
  entitlement: resolveNitroEntitlement(null),
  prefs: DEFAULT_PREFS,
  setPrefs: () => {},
  overrides: {},
  saveCosmetics: async () => ({ ok: false, error: 'Nitro indisponível' }),
  previewTheme: null,
  setPreviewTheme: () => {},
  lockReason: () => 'nitro',
});

/** Guardado no aparelho para aplicar o tema antes da hidratação (sem piscar). */
export const NITRO_THEME_KEY = 'insight-nitro-theme';

export function NitroProvider({ children }: { children: React.ReactNode }) {
  const supabase = useMemo(() => createClient(), []);
  const [ready, setReady] = useState(false);
  const [viewer, setViewer] = useState<Profile | null>(null);
  const [prefs, setPrefsState] = useState<NitroViewerPrefs>(DEFAULT_PREFS);
  const [overrides, setOverrides] = useState<Record<string, NitroCosmetics | null>>({});
  const [previewTheme, setPreviewTheme] = useState<string | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(PREFS_KEY);
      if (raw) {
        setPrefsState({ ...DEFAULT_PREFS, ...JSON.parse(raw) });
        return;
      }
    } catch {
      // armazenamento indisponível: usa o padrão
    }
    // Sem preferência salva: aparelho fraco ou economia de dados começa sem animar listas
    if (isLowPowerDevice()) setPrefsState({ ...DEFAULT_PREFS, animateLists: false });
  }, []);

  const setPrefs = useCallback((next: NitroViewerPrefs) => {
    setPrefsState(next);
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify(next));
    } catch {
      // ignora
    }
  }, []);

  useEffect(() => {
    if (NITRO_KILL_SWITCH) {
      setReady(true);
      return;
    }
    let active = true;

    async function load() {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!active) return;
      if (!session?.user) {
        setViewer(null);
        setReady(true);
        return;
      }
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .or(`user_id.eq.${session.user.id},id.eq.${session.user.id}`)
        .maybeSingle();
      if (!active) return;
      setViewer((data as Profile) || null);
      setReady(true);
    }

    load();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => load());
    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [supabase]);

  const entitlement = useMemo(() => resolveNitroEntitlement(viewer), [viewer]);
  const hasAccess = entitlement.active;

  // Rainbow (benefício Nitro): logo e asteriscos de carregamento em espectro.
  const ownCosmetics = viewer ? (viewer.id in overrides ? overrides[viewer.id] : viewer.cosmetics) : null;
  const rainbowOn = hasAccess && ownCosmetics?.rainbow !== false;

  useEffect(() => {
    const root = document.documentElement;
    if (rainbowOn) root.setAttribute('data-nitro-rainbow', 'on');
    else root.removeAttribute('data-nitro-rainbow');
  }, [rainbowOn]);

  // Tema de app: só o dono vê (é aplicado no aparelho de quem usa, nunca no perfil)
  const ownTheme = hasAccess ? ownCosmetics?.theme ?? null : null;
  const appliedTheme = getNitroItem(previewTheme ?? ownTheme, 'theme');
  useEffect(() => {
    if (!ready) return;
    const root = document.documentElement;
    if (!root.dataset.baseTheme) root.dataset.baseTheme = root.getAttribute('data-theme') || 'dark';
    let prefs: { theme?: string; accentColor?: string } = {};
    try {
      prefs = JSON.parse(localStorage.getItem('insight-preferences') || '{}');
    } catch {
      prefs = {};
    }
    if (appliedTheme) {
      root.setAttribute('data-nitro-theme', appliedTheme.id);
      root.setAttribute('data-theme', appliedTheme.mode);
      // a cor de destaque personalizada (inline) cede lugar à do tema
      root.style.removeProperty('--accent');
      root.style.removeProperty('--accent-hover');
    } else {
      root.removeAttribute('data-nitro-theme');
      delete root.dataset.ntMode;
      // volta ao tema e à cor escolhidos nas configurações
      root.setAttribute('data-theme', prefs.theme || root.dataset.baseTheme || 'dark');
      if (prefs.accentColor) {
        root.style.setProperty('--accent', prefs.accentColor);
        root.style.setProperty('--accent-hover', prefs.accentColor);
      }
    }
    try {
      const own = getNitroItem(ownTheme, 'theme');
      if (own) localStorage.setItem(NITRO_THEME_KEY, JSON.stringify({ id: own.id, mode: own.mode }));
      else localStorage.removeItem(NITRO_THEME_KEY);
    } catch {
      // armazenamento indisponível
    }
  }, [ready, appliedTheme, ownTheme]);

  const saveCosmetics = useCallback(
    async (next: NitroCosmetics) => {
      if (!viewer) return { ok: false, error: 'Entre na sua conta.' };
      // só vai o que esta conta pode usar (o banco confere de novo, item a item)
      next = filterCosmetics(next, viewer) || {};
      const payload = {
        title: next.title ?? null,
        tag: next.tag ?? null,
        frame: next.frame ?? null,
        intro: next.intro ?? null,
        frameEnabled: next.frameEnabled ?? true,
        frameAnimated: next.frameAnimated ?? true,
        introEnabled: next.introEnabled ?? true,
        levelAnimation: next.levelAnimation ?? true,
        rainbow: next.rainbow ?? true,
        font: next.font ?? null,
        theme: next.theme ?? null,
      };
      const { data, error } = await supabase.rpc('set_my_cosmetics', { p_cosmetics: payload });
      if (error) return { ok: false, error: error.message };
      const saved = data as NitroCosmetics;
      setViewer((prev) => (prev ? { ...prev, cosmetics: saved } : prev));
      setOverrides((prev) => ({ ...prev, [viewer.id]: saved }));
      return { ok: true };
    },
    [supabase, viewer]
  );

  const lockReason = useCallback((item: NitroItem) => itemLockReason(item, viewer), [viewer]);

  const value = useMemo(
    () => ({ ready, viewer, hasAccess, entitlement, prefs, setPrefs, overrides, saveCosmetics, previewTheme, setPreviewTheme, lockReason }),
    [ready, viewer, hasAccess, entitlement, prefs, setPrefs, overrides, saveCosmetics, previewTheme, lockReason]
  );

  return <NitroContext.Provider value={value}>{children}</NitroContext.Provider>;
}

export function useNitro() {
  return useContext(NitroContext);
}

/**
 * Cosméticos a exibir para um perfil, ou null. Todo mundo vê os cosméticos de
 * quem tem Nitro (vitrine); só quem tem acesso pode equipar.
 */
export function useProfileCosmetics(
  profile: (Pick<Profile, 'id'> & { cosmetics?: NitroCosmetics | null } & NitroEntitlementInput) | null | undefined
): NitroCosmetics | null {
  const { overrides } = useNitro();
  if (!profile || NITRO_KILL_SWITCH) return null;
  const cosmetics = profile.id in overrides ? overrides[profile.id] : profile.cosmetics || null;
  if (!cosmetics) return null;
  // cada item vale só enquanto a conta pode usá-lo (patente pelo nível, resto pelo Nitro)
  return filterCosmetics(cosmetics, profile);
}

/** Aparelho com poucos núcleos/memória ou modo de economia de dados. */
export function isLowPowerDevice(): boolean {
  if (typeof navigator === 'undefined') return false;
  const nav = navigator as Navigator & {
    deviceMemory?: number;
    connection?: { saveData?: boolean };
  };
  return (
    (nav.hardwareConcurrency ?? 8) <= 2 ||
    (nav.deviceMemory ?? 8) <= 2 ||
    Boolean(nav.connection?.saveData)
  );
}

/** true quando o usuário pediu menos movimento (SO ou preferência do Insight). */
export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false;
  if (document.documentElement.getAttribute('data-reduce-motion') === 'true') return true;
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
}
