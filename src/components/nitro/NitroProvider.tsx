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
import { NitroCosmetics } from '@/lib/nitro/catalog';
import './nitro.css';

/**
 * Interruptor geral: NEXT_PUBLIC_INSIGHT_NITRO=off desliga o Nitro inteiro
 * (inclusive para admins) sem precisar de deploy de código.
 */
export const NITRO_KILL_SWITCH = process.env.NEXT_PUBLIC_INSIGHT_NITRO === 'off';

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
  /** Beta fechada: só role = 'admin' acessa o Nitro e vê cosméticos. */
  hasAccess: boolean;
  prefs: NitroViewerPrefs;
  setPrefs: (next: NitroViewerPrefs) => void;
  /** Cosméticos salvos nesta sessão, por perfil (atualização instantânea na UI). */
  overrides: Record<string, NitroCosmetics | null>;
  saveCosmetics: (next: NitroCosmetics) => Promise<{ ok: boolean; error?: string }>;
}

const NitroContext = createContext<NitroContextValue>({
  ready: false,
  viewer: null,
  hasAccess: false,
  prefs: DEFAULT_PREFS,
  setPrefs: () => {},
  overrides: {},
  saveCosmetics: async () => ({ ok: false, error: 'Nitro indisponível' }),
});

export function NitroProvider({ children }: { children: React.ReactNode }) {
  const supabase = useMemo(() => createClient(), []);
  const [ready, setReady] = useState(false);
  const [viewer, setViewer] = useState<Profile | null>(null);
  const [prefs, setPrefsState] = useState<NitroViewerPrefs>(DEFAULT_PREFS);
  const [overrides, setOverrides] = useState<Record<string, NitroCosmetics | null>>({});

  useEffect(() => {
    try {
      const raw = localStorage.getItem(PREFS_KEY);
      if (raw) setPrefsState({ ...DEFAULT_PREFS, ...JSON.parse(raw) });
    } catch {
      // armazenamento indisponível: usa o padrão
    }
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

  const hasAccess = !NITRO_KILL_SWITCH && viewer?.role === 'admin';

  const saveCosmetics = useCallback(
    async (next: NitroCosmetics) => {
      if (!viewer || !hasAccess) return { ok: false, error: 'Acesso restrito.' };
      const payload = {
        title: next.title ?? null,
        tag: next.tag ?? null,
        frame: next.frame ?? null,
        intro: next.intro ?? null,
        frameEnabled: next.frameEnabled ?? true,
        frameAnimated: next.frameAnimated ?? true,
        introEnabled: next.introEnabled ?? true,
        levelAnimation: next.levelAnimation ?? true,
      };
      const { data, error } = await supabase.rpc('set_my_cosmetics', { p_cosmetics: payload });
      if (error) return { ok: false, error: error.message };
      const saved = data as NitroCosmetics;
      setViewer((prev) => (prev ? { ...prev, cosmetics: saved } : prev));
      setOverrides((prev) => ({ ...prev, [viewer.id]: saved }));
      return { ok: true };
    },
    [hasAccess, supabase, viewer]
  );

  const value = useMemo(
    () => ({ ready, viewer, hasAccess, prefs, setPrefs, overrides, saveCosmetics }),
    [ready, viewer, hasAccess, prefs, setPrefs, overrides, saveCosmetics]
  );

  return <NitroContext.Provider value={value}>{children}</NitroContext.Provider>;
}

export function useNitro() {
  return useContext(NitroContext);
}

/**
 * Cosméticos a exibir para um perfil, ou null.
 * Beta fechada: só quem tem acesso (admin) enxerga cosméticos.
 */
export function useProfileCosmetics(
  profile: Pick<Profile, 'id'> & { cosmetics?: NitroCosmetics | null } | null | undefined
): NitroCosmetics | null {
  const { hasAccess, overrides } = useNitro();
  if (!hasAccess || !profile) return null;
  if (profile.id in overrides) return overrides[profile.id];
  return profile.cosmetics || null;
}

/** true quando o usuário pediu menos movimento (SO ou preferência do Insight). */
export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false;
  if (document.documentElement.getAttribute('data-reduce-motion') === 'true') return true;
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
}
