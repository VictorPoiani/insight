'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import {
  Sun,
  Moon,
  Contrast,
  Type,
  Lock,
  LogOut,
  ShieldCheck,
  FileText,
  Shield,
  Check,
  BellPlus,
  Sparkles,
  Pin,
  Hash,
} from 'lucide-react';

interface UserPreferences {
  theme: 'dark' | 'light';
  highContrast: boolean;
  fontSize: number;
}

type NotifyMode = 'all' | 'tags' | 'pinned' | 'official_only';

const NEWSLETTER_TAGS = [
  'dev',
  'ia',
  'projetos',
  'rock',
  'musica',
  'artigue',
  'professional',
  'jardim',
];

const DEFAULT_PREFS: UserPreferences = {
  theme: 'dark',
  highContrast: false,
  fontSize: 19,
};

export default function ConfigPage() {
  const [prefs, setPrefs] = useState<UserPreferences>(DEFAULT_PREFS);
  const [mounted, setMounted] = useState(false);

  const [subEmail, setSubEmail] = useState('');
  const [notifyMode, setNotifyMode] = useState<NotifyMode>('all');
  const [subTags, setSubTags] = useState<string[]>(['dev', 'projetos']);
  const [savingSub, setSavingSub] = useState(false);
  const [subSaved, setSubSaved] = useState(false);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const supabase = createClient();

  const loadSubscriberPreferences = useCallback(
    async (targetEmail: string) => {
      const clean = targetEmail.trim().toLowerCase();
      if (!clean || !clean.includes('@')) return;

      const { data } = await supabase
        .from('subscribers')
        .select('notify_mode, interested_tags')
        .eq('email', clean)
        .maybeSingle();

      if (data) {
        setNotifyMode((data.notify_mode as NotifyMode) || 'all');
        if (Array.isArray(data.interested_tags) && data.interested_tags.length > 0) {
          setSubTags(data.interested_tags);
        }
      }
    },
    [supabase]
  );

  useEffect(() => {
    try {
      const saved = localStorage.getItem('insight-preferences');
      if (saved) {
        const parsed = JSON.parse(saved) as Partial<UserPreferences>;
        const merged: UserPreferences = {
          theme: parsed.theme === 'light' ? 'light' : 'dark',
          highContrast: Boolean(parsed.highContrast),
          fontSize: parsed.fontSize || 19,
        };
        setPrefs(merged);
        applyPreferencesToDOM(merged);
      }

      const savedSubEmail = localStorage.getItem('insight-subscriber-email');
      if (savedSubEmail) {
        setSubEmail(savedSubEmail);
        loadSubscriberPreferences(savedSubEmail);
      }
    } catch {
      // Ignora erro de leitura local
    }
    setMounted(true);

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUserEmail(session?.user?.email ?? null);
    });
  }, [supabase, loadSubscriberPreferences]);

  function applyPreferencesToDOM(nextPrefs: UserPreferences) {
    const root = document.documentElement;
    root.setAttribute('data-theme', nextPrefs.theme);

    if (nextPrefs.highContrast) {
      root.setAttribute('data-contrast', 'high');
    } else {
      root.removeAttribute('data-contrast');
    }

    root.style.fontSize = `${nextPrefs.fontSize}px`;
  }

  function updatePreferences(patch: Partial<UserPreferences>) {
    const nextPrefs = { ...prefs, ...patch };
    setPrefs(nextPrefs);
    localStorage.setItem('insight-preferences', JSON.stringify(nextPrefs));
    applyPreferencesToDOM(nextPrefs);
  }

  function toggleSubTag(tag: string) {
    setSubTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  }

  async function handleSaveNewsletterPrefs(e: React.FormEvent) {
    e.preventDefault();
    const cleanEmail = subEmail.trim().toLowerCase();
    if (!cleanEmail || savingSub) return;

    if (notifyMode === 'tags' && subTags.length === 0) {
      alert('Selecione pelo menos uma hashtag de seu interesse.');
      return;
    }

    setSavingSub(true);

    const { error } = await supabase.from('subscribers').upsert(
      {
        email: cleanEmail,
        notify_official_updates: true,
        notify_mode: notifyMode,
        interested_tags: notifyMode === 'tags' ? subTags : [],
      },
      { onConflict: 'email' }
    );

    if (error) {
      setSavingSub(false);
      alert('Erro ao salvar preferências de e-mail: ' + error.message);
      return;
    }

    localStorage.setItem('insight-subscriber-email', cleanEmail);

    await fetch('/api/newsletter', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'welcome',
        email: cleanEmail,
        notifyMode,
        interestedTags: subTags,
      }),
    }).catch(() => {});

    setSavingSub(false);
    setSubSaved(true);
    setTimeout(() => setSubSaved(false), 3000);
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setAuthLoading(true);
    setAuthError(null);

    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    setAuthLoading(false);

    if (error) {
      setAuthError('Credenciais inválidas. Verifique seu e-mail e senha no Supabase.');
      return;
    }

    setUserEmail(data.user?.email ?? null);
    setEmail('');
    setPassword('');
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    setUserEmail(null);
  }

  return (
    <div className="p-6 space-y-6">
      <header className="border-b border-border pb-4">
        <h1 className="text-2xl font-extrabold text-primary">Configurações</h1>
        <p className="text-xs sm:text-sm text-secondary mt-1">
          Personalize a aparência, notificações por e-mail, acessibilidade e acesso de autor.
        </p>
      </header>

      {/* 1. Aparência (Modo Escuro / Modo Claro) */}
      <section className="p-5 rounded-2xl bg-surface border border-border space-y-4">
        <div>
          <h2 className="text-sm font-bold text-primary">Tema da Interface</h2>
          <p className="text-xs text-secondary">
            Sua escolha fica salva neste navegador para os próximos acessos.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => updatePreferences({ theme: 'dark' })}
            className={`p-4 rounded-xl border flex items-center justify-between transition-all ${
              mounted && prefs.theme === 'dark'
                ? 'bg-accent/15 border-accent text-primary'
                : 'bg-elevated border-border text-secondary hover:text-primary'
            }`}
          >
            <div className="flex items-center gap-3">
              <Moon className="w-5 h-5 text-accent" />
              <div className="text-left">
                <p className="text-xs sm:text-sm font-bold">Modo Escuro</p>
                <p className="text-[11px] text-muted">Visual original Dark UI</p>
              </div>
            </div>
            {mounted && prefs.theme === 'dark' && (
              <Check className="w-4 h-4 text-accent shrink-0" />
            )}
          </button>

          <button
            type="button"
            onClick={() => updatePreferences({ theme: 'light' })}
            className={`p-4 rounded-xl border flex items-center justify-between transition-all ${
              mounted && prefs.theme === 'light'
                ? 'bg-accent/15 border-accent text-primary'
                : 'bg-elevated border-border text-secondary hover:text-primary'
            }`}
          >
            <div className="flex items-center gap-3">
              <Sun className="w-5 h-5 text-accent" />
              <div className="text-left">
                <p className="text-xs sm:text-sm font-bold">Modo Claro</p>
                <p className="text-[11px] text-muted">Leitura diurna clara</p>
              </div>
            </div>
            {mounted && prefs.theme === 'light' && (
              <Check className="w-4 h-4 text-accent shrink-0" />
            )}
          </button>
        </div>
      </section>

      {/* 2. Notificações por E-mail (Newsletter e Filtros de Postagens) */}
      <form
        onSubmit={handleSaveNewsletterPrefs}
        className="p-5 rounded-2xl bg-surface border border-border space-y-4"
      >
        <div>
          <h2 className="text-sm font-extrabold text-primary flex items-center gap-2">
            <BellPlus className="w-4 h-4 text-accent" />
            <span>Acompanhar por E-mail (Newsletter)</span>
          </h2>
          <p className="text-xs text-secondary mt-0.5">
            Inscreva seu e-mail ou personalize exatamente quais tipos de publicações deseja receber.
          </p>
        </div>

        <div>
          <input
            type="email"
            required
            value={subEmail}
            onChange={(e) => setSubEmail(e.target.value)}
            onBlur={(e) => loadSubscriberPreferences(e.target.value)}
            placeholder="Digite seu melhor e-mail..."
            className="w-full bg-elevated border border-border rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-primary placeholder:text-muted focus:outline-none focus:border-accent"
          />
        </div>

        {/* Regra Obrigatória: Atualizações Oficiais */}
        <div className="p-3.5 rounded-xl bg-elevated/70 border border-border flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-5 h-5 rounded bg-accent text-white flex items-center justify-center shrink-0">
              <Check className="w-3.5 h-3.5" />
            </div>
            <div>
              <p className="text-xs font-bold text-primary">
                Atualizações Oficiais da Plataforma (Aba Notificações)
              </p>
              <p className="text-[11px] text-muted">
                Novidades oficiais e notas de versão do Insight*
              </p>
            </div>
          </div>
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-surface border border-border text-[10px] font-bold text-secondary shrink-0">
            <Lock className="w-3 h-3 text-accent" />
            Padrão obrigatório
          </span>
        </div>

        {/* Opções de Filtro de Postagens do Feed */}
        <div className="space-y-2">
          <label className="text-xs font-bold text-secondary block">
            Notificações de novas postagens do feed:
          </label>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={() => setNotifyMode('all')}
              className={`p-3.5 rounded-xl border text-left transition-all flex items-start gap-2.5 ${
                notifyMode === 'all'
                  ? 'bg-accent/15 border-accent text-primary'
                  : 'bg-elevated border-border text-secondary hover:text-primary'
              }`}
            >
              <Sparkles className="w-4 h-4 text-accent shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-bold">Todas as postagens</p>
                <p className="text-[11px] text-muted">
                  Aviso sempre que um novo insight for publicado
                </p>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setNotifyMode('pinned')}
              className={`p-3.5 rounded-xl border text-left transition-all flex items-start gap-2.5 ${
                notifyMode === 'pinned'
                  ? 'bg-accent/15 border-accent text-primary'
                  : 'bg-elevated border-border text-secondary hover:text-primary'
              }`}
            >
              <Pin className="w-4 h-4 text-accent shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-bold">Apenas Fixadas (Destaques)</p>
                <p className="text-[11px] text-muted">
                  Somente publicações marcadas como fixadas
                </p>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setNotifyMode('tags')}
              className={`p-3.5 rounded-xl border text-left transition-all flex items-start gap-2.5 ${
                notifyMode === 'tags'
                  ? 'bg-accent/15 border-accent text-primary'
                  : 'bg-elevated border-border text-secondary hover:text-primary'
              }`}
            >
              <Hash className="w-4 h-4 text-accent shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-bold">Apenas temas que eu gosto</p>
                <p className="text-[11px] text-muted">
                  Filtrar pelas hashtags do meu interesse
                </p>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setNotifyMode('official_only')}
              className={`p-3.5 rounded-xl border text-left transition-all flex items-start gap-2.5 ${
                notifyMode === 'official_only'
                  ? 'bg-accent/15 border-accent text-primary'
                  : 'bg-elevated border-border text-secondary hover:text-primary'
              }`}
            >
              <Lock className="w-4 h-4 text-accent shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-bold">Somente Atualizações Oficiais</p>
                <p className="text-[11px] text-muted">
                  Não receber avisos de posts comuns do feed
                </p>
              </div>
            </button>
          </div>
        </div>

        {notifyMode === 'tags' && (
          <div className="p-3.5 rounded-xl bg-elevated border border-border space-y-2">
            <p className="text-xs font-semibold text-primary">
              Escolha as hashtags que deseja acompanhar:
            </p>
            <div className="flex flex-wrap gap-2">
              {NEWSLETTER_TAGS.map((tag) => {
                const active = subTags.includes(tag);
                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => toggleSubTag(tag)}
                    className={`px-3 py-1 rounded-full text-xs font-bold border flex items-center gap-1 transition-colors ${
                      active
                        ? 'bg-accent text-white border-accent'
                        : 'bg-surface text-secondary border-border hover:text-primary'
                    }`}
                  >
                    <span>#{tag}</span>
                    {active && <Check className="w-3 h-3" />}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className="flex justify-end pt-2 border-t border-border">
          <button
            type="submit"
            disabled={savingSub}
            className="px-5 py-2 rounded-xl bg-accent text-white text-xs font-bold hover:bg-accent-hover flex items-center gap-1.5 disabled:opacity-50 transition-colors"
          >
            {subSaved ? (
              <>
                <Check className="w-4 h-4" />
                <span>Preferências Salvas! Confira seu e-mail</span>
              </>
            ) : (
              <span>
                {savingSub ? 'Salvando...' : 'Salvar e Receber Confirmação'}
              </span>
            )}
          </button>
        </div>
      </form>

      {/* 3. Acessibilidade e Escala de Fonte */}
      <section className="p-5 rounded-2xl bg-surface border border-border space-y-4">
        <h2 className="text-sm font-bold text-primary">Acessibilidade e Leitura</h2>

        <div className="flex items-center justify-between gap-4 pt-1">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-elevated border border-border text-accent">
              <Contrast className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs sm:text-sm font-semibold text-primary">Alto Contraste</p>
              <p className="text-xs text-muted">
                Aumenta a definição de bordas e textos
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => updatePreferences({ highContrast: !prefs.highContrast })}
            className={`px-4 py-1.5 rounded-full text-xs font-bold border transition-colors ${
              mounted && prefs.highContrast
                ? 'bg-accent text-white border-accent'
                : 'bg-elevated text-secondary border-border hover:text-primary'
            }`}
          >
            {mounted && prefs.highContrast ? 'Ativado' : 'Desativado'}
          </button>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4 pt-3 border-t border-border">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-elevated border border-border text-accent">
              <Type className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs sm:text-sm font-semibold text-primary">Escala da Interface</p>
              <p className="text-xs text-muted">
                Ajuste o tamanho geral dos textos e cartões
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {[
              { size: 17, label: 'Compacto' },
              { size: 19, label: 'Padrão' },
              { size: 21, label: 'Grande' },
            ].map((item) => (
              <button
                key={item.size}
                type="button"
                onClick={() => updatePreferences({ fontSize: item.size })}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors ${
                  mounted && prefs.fontSize === item.size
                    ? 'bg-accent text-white border-accent'
                    : 'bg-elevated text-secondary border-border hover:text-primary'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* 4. Documentos Legais e LGPD */}
      <section className="p-5 rounded-2xl bg-surface border border-border space-y-3">
        <h2 className="text-sm font-bold text-primary">Privacidade e Termos</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Link
            href="/privacidade"
            className="p-3.5 rounded-xl bg-elevated border border-border hover:border-accent flex items-center gap-3 transition-colors"
          >
            <Shield className="w-4 h-4 text-accent shrink-0" />
            <div>
              <p className="text-xs font-bold text-primary">Política de Privacidade</p>
              <p className="text-[11px] text-muted">Seus direitos e conformidade LGPD</p>
            </div>
          </Link>

          <Link
            href="/termos"
            className="p-3.5 rounded-xl bg-elevated border border-border hover:border-accent flex items-center gap-3 transition-colors"
          >
            <FileText className="w-4 h-4 text-accent shrink-0" />
            <div>
              <p className="text-xs font-bold text-primary">Termos de Uso</p>
              <p className="text-[11px] text-muted">Regras e diretrizes da plataforma</p>
            </div>
          </Link>
        </div>
      </section>

      {/* 5. Acesso do Autor (Supabase Auth) */}
      <section className="p-5 rounded-2xl bg-surface border border-border space-y-4">
        <div className="flex items-center gap-2">
          <Lock className="w-4 h-4 text-accent" />
          <h2 className="text-sm font-bold text-primary">Modo Autor (Desenvolvimento)</h2>
        </div>

        {userEmail ? (
          <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-xl bg-elevated border border-accent/40">
            <div className="flex items-center gap-2.5">
              <ShieldCheck className="w-5 h-5 text-accent shrink-0" />
              <div>
                <p className="text-xs font-bold text-primary">Modo Autor Ativo</p>
                <p className="text-[11px] text-secondary">Autenticado como {userEmail}</p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleLogout}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-surface border border-border text-xs font-semibold text-danger hover:border-danger transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Bloquear Modo Autor</span>
            </button>
          </div>
        ) : (
          <form onSubmit={handleLogin} className="space-y-3">
            <p className="text-xs text-secondary">
              Exclusivo para Victor Poiani publicar novos insights, editar o perfil e atualizar o
              mural.
            </p>

            {authError && (
              <p className="text-xs text-danger bg-danger/10 border border-danger/30 rounded-lg px-3 py-2">
                {authError}
              </p>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="E-mail de administrador"
                className="bg-elevated border border-border rounded-xl px-3.5 py-2 text-xs text-primary placeholder:text-muted focus:outline-none focus:border-accent"
              />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Senha"
                className="bg-elevated border border-border rounded-xl px-3.5 py-2 text-xs text-primary placeholder:text-muted focus:outline-none focus:border-accent"
              />
            </div>

            <button
              type="submit"
              disabled={authLoading}
              className="px-4 py-2 rounded-xl bg-accent text-white text-xs font-bold hover:bg-accent-hover disabled:opacity-50 transition-colors"
            >
              {authLoading ? 'Verificando...' : 'Destravar Modo Autor'}
            </button>
          </form>
        )}
      </section>
    </div>
  );
}