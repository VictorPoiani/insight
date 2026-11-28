'use client';

import { notify } from '@/lib/ui/feedback';
import { useEffect, useMemo, useState } from 'react';
import { Heart, MessageCircle, UserPlus, Repeat2, FileText, BarChart3, Loader2, Check, AtSign } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

/** Tipos de notificação do app que cada pessoa pode ligar/desligar. */
export const NOTIFICATION_TYPES = [
  { id: 'like', label: 'Curtidas', desc: 'Quando curtem um post seu', icon: Heart, color: 'text-rose-500' },
  { id: 'reply', label: 'Respostas', desc: 'Quando respondem seus posts', icon: MessageCircle, color: 'text-accent' },
  { id: 'mention', label: 'Menções', desc: 'Quando alguém marca você com @', icon: AtSign, color: 'text-violet-400' },
  { id: 'poll_vote', label: 'Votos em enquetes', desc: 'Quando alguém vota numa enquete sua', icon: BarChart3, color: 'text-amber-400' },
  { id: 'follow', label: 'Novos seguidores', desc: 'Quando alguém começa a seguir você', icon: UserPlus, color: 'text-emerald-400' },
  { id: 'repost', label: 'Reposts', desc: 'Quando repostam algo seu', icon: Repeat2, color: 'text-[#1DB954]' },
  { id: 'new_post', label: 'Novos posts de quem você segue', desc: 'Aviso aqui no app', icon: FileText, color: 'text-sky-400' },
] as const;

export type NotificationPrefs = Partial<Record<(typeof NOTIFICATION_TYPES)[number]['id'], boolean>>;

/**
 * Preferências das notificações dentro do app (o sininho). Tipo desligado não
 * chega a ser gravado — o filtro roda no banco (notifications_respect_prefs).
 */
export function NotificationSettings({ profileId }: { profileId: string }) {
  const supabase = useMemo(() => createClient(), []);
  const [prefs, setPrefs] = useState<NotificationPrefs>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  useEffect(() => {
    let alive = true;
    supabase
      .from('notification_prefs')
      .select('prefs')
      .eq('profile_id', profileId)
      .maybeSingle()
      .then(({ data }) => {
        if (!alive) return;
        setPrefs((data?.prefs as NotificationPrefs) || {});
        setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [profileId, supabase]);

  async function toggle(id: keyof NotificationPrefs) {
    const next = { ...prefs, [id]: prefs[id] === false };
    setPrefs(next);
    setSaving(id);
    const { error } = await supabase
      .from('notification_prefs')
      .upsert({ profile_id: profileId, prefs: next, updated_at: new Date().toISOString() }, { onConflict: 'profile_id' });
    setSaving(null);
    if (error) {
      setPrefs(prefs);
      notify('Não foi possível salvar a preferência agora.');
      return;
    }
    setSavedAt(Date.now());
  }

  return (
    <div className="px-4 sm:px-6 py-4 border-b border-border bg-surface/40 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-sm font-extrabold text-primary">O que aparece no sininho</p>
          <p className="text-[11px] text-muted">Só notificações dentro do app. Push e e-mail têm configurações próprias.</p>
        </div>
        {savedAt && !saving && (
          <span className="flex items-center gap-1 text-[11px] text-emerald-400" aria-live="polite">
            <Check className="w-3.5 h-3.5" /> salvo
          </span>
        )}
      </div>
      {loading ? (
        <Loader2 className="w-4 h-4 animate-spin text-muted" />
      ) : (
        <div className="grid sm:grid-cols-2 gap-2">
          {NOTIFICATION_TYPES.map((t) => {
            const on = prefs[t.id] !== false;
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                type="button"
                role="switch"
                aria-checked={on}
                onClick={() => void toggle(t.id)}
                className={`flex items-center gap-3 p-3 rounded-xl border text-left transition-colors ${
                  on ? 'border-border bg-background hover:border-accent/50' : 'border-border/60 bg-background/40 opacity-70 hover:opacity-100'
                }`}
              >
                <Icon className={`w-4 h-4 shrink-0 ${t.color}`} />
                <span className="flex-1 min-w-0">
                  <span className="block text-xs font-bold text-primary">{t.label}</span>
                  <span className="block text-[11px] text-muted truncate">{t.desc}</span>
                </span>
                {saving === t.id ? (
                  <Loader2 className="w-4 h-4 animate-spin text-muted" />
                ) : (
                  <span className={`relative w-9 h-5 rounded-full shrink-0 transition-colors ${on ? 'bg-accent' : 'bg-elevated border border-border'}`}>
                    <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${on ? 'left-[18px]' : 'left-0.5'}`} />
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
