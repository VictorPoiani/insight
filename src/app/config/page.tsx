'use client';

import { SignupSwitch } from '@/components/account/SignupSwitch';
import { BlockedAccounts } from '@/components/account/BlockedAccounts';
import { askText } from '@/lib/ui/feedback';
import { notify } from '@/lib/ui/feedback';
import { applyWarmOverlay, PREFS_EVENT } from '@/lib/nightLight';

import { autoFocusModeEnabled, setAutoFocusModeEnabled } from '@/lib/useAutoFocusMode';
import { PasswordStrength, validateNewPassword } from '@/components/account/PasswordStrength';
import { VerifiedBadge } from '@/components/account/VerifiedBadge';
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Profile } from '@/types/database';
import { useNitro } from '@/components/nitro/NitroProvider';
import { NitroConfigTab } from '@/components/nitro/NitroConfigTab';
import { Zap as NitroZap } from 'lucide-react';
import {
  BookOpen,
  Eye,
  EyeOff,
  Lock,
  LogOut,
  ShieldCheck,
  FileText,
  Shield,
  Check,
  Bell,
  Pin,
  Hash,
  KeyRound,
  Trash2,
  Plus,
  Copy,
  Flag,
  ExternalLink,
  LogIn,
  AtSign,
  Download,
  UserCheck,
  CheckCircle2,
  XCircle,
  Loader2,
  RotateCcw,
  Sparkles,
} from 'lucide-react';

type ThemeOption = 'dark' | 'light' | 'night' | 'oled';
type ReadingFontOption = 'sans' | 'serif' | 'mono';

interface UserPreferences {
  theme: ThemeOption;
  highContrast: boolean;
  fontSize: number;
  readingMode: boolean;
  readingFont: ReadingFontOption;
  warmFilter: number;
  nightLight: boolean;
  nightStart: string;
  nightEnd: string;
  nightStrength: number;
  accentColor: string;
  reduceMotion: boolean;
}

type NotifyMode = 'all' | 'tags' | 'pinned' | 'official_only';
type ConfigTabId = 'appearance' | 'account' | 'notifications' | 'nitro' | 'staff';

interface InviteCodeRow {
  id: string;
  code: string;
  max_uses: number;
  uses_count: number;
  created_at: string;
}

interface ReportRow {
  id: string;
  reporter_id: string | null;
  target_post_id: string | null;
  target_profile_id: string | null;
  reason: string;
  status: 'pending' | 'resolved' | 'dismissed';
  created_at: string;
}

const FOUNDER_PROFILE_ID = '96d271a9-9102-49b1-b593-9279c5dfe3f4';

const DEFAULT_VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

const RESERVED_USERNAMES = new Set([
  'admin',
  'insight',
  'suporte',
  'explore',
  'login',
  'config',
  'notificacoes',
  'apoie',
  'about',
  'termos',
  'privacidade',
  'api',
  'root',
  'moderator',
]);

// 5 níveis na trilha estilo X/Twitter (Aa ---o---o---o--- Aa)
const FONT_SIZE_STEPS = [16, 17.5, 19, 20.5, 22];

const ACCENT_PRESETS = [
  { label: 'Azul Insight', color: '#2563eb' },
  { label: 'Celeste', color: '#38bdf8' },
  { label: 'Amarelo Sol', color: '#eab308' },
  { label: 'Carmesim', color: '#f43f5e' },
  { label: 'Violeta', color: '#8b5cf6' },
  { label: 'Âmbar Quente', color: '#e08b3e' },
  { label: 'Esmeralda', color: '#10b981' },
];

const NEWSLETTER_TAGS = [
  'dev',
  'ia',
  'projetos',
  'rock',
  'musica',
  'artigue',
];

const DEFAULT_PREFS: UserPreferences = {
  theme: 'dark',
  highContrast: false,
  fontSize: 19,
  readingMode: false,
  readingFont: 'sans',
  warmFilter: 0,
  nightLight: false,
  nightStart: '21:00',
  nightEnd: '06:00',
  nightStrength: 25,
  accentColor: '#2563eb',
  reduceMotion: false,
};

function generateRandomBetaCode(): string {
  // gerador criptográfico e 12 caracteres aleatórios (~60 bits): inviável adivinhar
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  const s = Array.from(bytes, (b) => chars.charAt(b % chars.length)).join('');
  return `INSG-${s.slice(0, 4)}-${s.slice(4, 8)}-${s.slice(8, 12)}`;
}

/**
 * Chave deslizante minimalista (Toggle Switch)
 */
function FluidSwitch({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={onChange}
      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
        checked ? 'bg-accent' : 'bg-elevated border-border'
      }`}
    >
      <span
        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
          checked ? 'translate-x-5' : 'translate-x-0'
        }`}
      />
    </button>
  );
}

export default function ConfigPage() {
  const router = useRouter();
  const supabase = createClient();

  const [activeTab, setActiveTab] = useState<ConfigTabId>('appearance');
  const { hasAccess: nitroActive, viewer: nitroViewer } = useNitro();
  // aba Nitro: assinantes e quem tem itens de patente (nível 1+)
  const hasNitroAccess = nitroActive || (nitroViewer?.contributor_level ?? 0) >= 1;
  const [prefs, setPrefs] = useState<UserPreferences>(DEFAULT_PREFS);
  const [mounted, setMounted] = useState(false);
  const [focusSidebarsCollapsed, setFocusSidebarsCollapsed] = useState(false);
  const [autoFocusWriting, setAutoFocusWriting] = useState(true);
  useEffect(() => setAutoFocusWriting(autoFocusModeEnabled()), []);

  // Notificações (Web Push + Newsletter)
  const [pushSupported, setPushSupported] = useState(false);
  const [pushSubscribed, setPushSubscribed] = useState(false);
  const [loadingPush, setLoadingPush] = useState(false);
  const [subEmail, setSubEmail] = useState('');
  const [notifyMode, setNotifyMode] = useState<NotifyMode>('all');
  const [subTags, setSubTags] = useState<string[]>(['dev', 'projetos']);
  const [savingSub, setSavingSub] = useState(false);
  const [subSaved, setSubSaved] = useState(false);

  // Conta Autenticada
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [myProfile, setMyProfile] = useState<Profile | null>(null);

  const [newUsername, setNewUsername] = useState('');
  const [usernameStatus, setUsernameStatus] = useState<
    'idle' | 'checking' | 'available' | 'taken' | 'invalid'
  >('idle');
  const [savingUsername, setSavingUsername] = useState(false);
  const [usernameMsg, setUsernameMsg] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  const [currentPassword, setCurrentPassword] = useState('');
  const [sendingVerify, setSendingVerify] = useState(false);
  const [verifyMsg, setVerifyMsg] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [updatingPassword, setUpdatingPassword] = useState(false);
  const [passwordMsg, setPasswordMsg] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  const [exportingData, setExportingData] = useState(false);

  // Painel da Equipe Dev
  const [isStaff, setIsStaff] = useState(false);
  const [inviteCodes, setInviteCodes] = useState<InviteCodeRow[]>([]);
  const [newCodeMaxUses, setNewCodeMaxUses] = useState(5);
  const [creatingInvite, setCreatingInvite] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [reports, setReports] = useState<ReportRow[]>([]);

  const loadSubscriberPreferences = useCallback(
    async (targetEmail: string) => {
      const clean = targetEmail.trim().toLowerCase();
      if (!clean || !clean.includes('@')) return;

      const { data: prefs } = await supabase.rpc('get_newsletter_prefs', { p_email: clean });
      const data = prefs as { notify_mode?: string; interested_tags?: string[] } | null;

      if (data) {
        setNotifyMode((data.notify_mode as NotifyMode) || 'all');
        if (Array.isArray(data.interested_tags) && data.interested_tags.length > 0) {
          setSubTags(data.interested_tags);
        }
      }
    },
    [supabase]
  );

  const loadStaffPanelData = useCallback(async () => {
    const [{ data: codesData }, { data: reportsData }] = await Promise.all([
      supabase
        .from('invite_codes')
        .select('*')
        .order('created_at', { ascending: false }),
      supabase
        .from('reports')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(30),
    ]);

    if (codesData) setInviteCodes(codesData as InviteCodeRow[]);
    if (reportsData) setReports(reportsData as ReportRow[]);
  }, [supabase]);

  function applyPreferencesToDOM(nextPrefs: UserPreferences) {
    const root = document.documentElement;
    // com Tema Nitro ativo, o modo claro/escuro vem do tema
    if (!root.hasAttribute('data-nitro-theme')) root.setAttribute('data-theme', nextPrefs.theme);

    if (nextPrefs.highContrast) {
      root.setAttribute('data-contrast', 'high');
    } else {
      root.removeAttribute('data-contrast');
    }

    if (nextPrefs.readingMode) {
      root.setAttribute('data-reading', 'comfortable');
    } else {
      root.removeAttribute('data-reading');
    }

    root.setAttribute('data-reading-font', nextPrefs.readingFont);

    if (nextPrefs.reduceMotion) {
      root.setAttribute('data-reduce-motion', 'true');
    } else {
      root.removeAttribute('data-reduce-motion');
    }

    const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
    const effectiveSize = isMobile
      ? Math.max(14, Math.min(18, nextPrefs.fontSize - 3))
      : nextPrefs.fontSize;
    root.style.fontSize = `${effectiveSize}px`;

    root.style.setProperty('--accent', nextPrefs.accentColor);
    root.style.setProperty('--accent-hover', nextPrefs.accentColor);
    applyWarmOverlay(nextPrefs);
  }

  useEffect(() => {
    try {
      const saved = localStorage.getItem('insight-preferences');
      if (saved) {
        const parsed = JSON.parse(saved) as Partial<UserPreferences>;
        const merged: UserPreferences = {
          theme:
            parsed.theme === 'light' ||
            parsed.theme === 'night' ||
            parsed.theme === 'oled'
              ? parsed.theme
              : 'dark',
          highContrast: Boolean(parsed.highContrast),
          fontSize: parsed.fontSize || 19,
          readingMode: Boolean(parsed.readingMode),
          readingFont: parsed.readingFont || 'sans',
          warmFilter: typeof parsed.warmFilter === 'number' ? parsed.warmFilter : 0,
          nightLight: Boolean(parsed.nightLight),
          nightStart: parsed.nightStart || '21:00',
          nightEnd: parsed.nightEnd || '06:00',
          nightStrength: typeof parsed.nightStrength === 'number' ? parsed.nightStrength : 25,
          accentColor: parsed.accentColor || '#2563eb',
          reduceMotion: Boolean(parsed.reduceMotion),
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
      // Ignora erro local
    }
    setMounted(true);

    if (
      typeof window !== 'undefined' &&
      'serviceWorker' in navigator &&
      'PushManager' in window
    ) {
      setPushSupported(true);
      navigator.serviceWorker
        .register('/sw.js')
        .then((reg) => reg.pushManager.getSubscription())
        .then((sub) => setPushSubscribed(Boolean(sub)))
        .catch(() => {});
    }

    async function loadUserSession() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.user) {
        setUserEmail(null);
        setMyProfile(null);
        setIsStaff(false);
        return;
      }

      setUserEmail(session.user.email ?? null);
      if (!subEmail && session.user.email) {
        setSubEmail(session.user.email);
        loadSubscriberPreferences(session.user.email);
      }

      const { data: prof } = await supabase
        .from('profiles')
        .select('*')
        .or(`user_id.eq.${session.user.id},id.eq.${session.user.id}`)
        .maybeSingle();

      if (prof) {
        const typed = prof as Profile;
        setMyProfile(typed);
        setNewUsername(typed.username || '');
        const staffMember =
          typed.role === 'admin' ||
          typed.role === 'moderator' ||
          typed.id === FOUNDER_PROFILE_ID;
        setIsStaff(staffMember);
        if (staffMember) {
          loadStaffPanelData();
        }
      }
    }

    loadUserSession();
  }, [supabase, loadSubscriberPreferences, loadStaffPanelData]);

  // Verifica unicidade do novo @username em tempo real
  useEffect(() => {
    if (!myProfile) return;
    const clean = newUsername.trim().toLowerCase().replace(/[^a-z0-9_]/g, '');

    if (!clean || clean === myProfile.username.toLowerCase()) {
      setUsernameStatus('idle');
      return;
    }

    if (clean.length < 3 || RESERVED_USERNAMES.has(clean)) {
      setUsernameStatus('invalid');
      return;
    }

    setUsernameStatus('checking');
    let cancelled = false;

    const timer = setTimeout(async () => {
      const { data: rpcAvailable, error: rpcErr } = await supabase.rpc(
        'check_username_available',
        {
          target_username: clean,
          exclude_profile_id: myProfile.id,
        }
      );

      let isFree = false;
      if (!rpcErr && typeof rpcAvailable === 'boolean') {
        isFree = rpcAvailable;
      } else {
        const { data: rows } = await supabase
          .from('profiles')
          .select('id')
          .ilike('username', clean)
          .neq('id', myProfile.id)
          .limit(1);
        isFree = !rows || rows.length === 0;
      }

      if (!cancelled) {
        setUsernameStatus(isFree ? 'available' : 'taken');
      }
    }, 320);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [newUsername, myProfile, supabase]);

  // atalho Ctrl+Shift+L muda o modo leitura de qualquer tela: mantém o switch em dia
  useEffect(() => {
    function sync(e: Event) {
      const d = (e as CustomEvent<Partial<UserPreferences>>).detail;
      if (d && typeof d.readingMode === 'boolean') {
        setPrefs((p) => (p.readingMode === d.readingMode ? p : { ...p, readingMode: Boolean(d.readingMode) }));
      }
    }
    window.addEventListener(PREFS_EVENT, sync);
    return () => window.removeEventListener(PREFS_EVENT, sync);
  }, []);

  function updatePreferences(patch: Partial<UserPreferences>) {
    const nextPrefs = { ...prefs, ...patch };
    setPrefs(nextPrefs);
    localStorage.setItem('insight-preferences', JSON.stringify(nextPrefs));
    applyPreferencesToDOM(nextPrefs);
    window.dispatchEvent(new CustomEvent(PREFS_EVENT, { detail: nextPrefs }));
  }

  function handleResetVisualPreferences() {
    setPrefs(DEFAULT_PREFS);
    localStorage.setItem('insight-preferences', JSON.stringify(DEFAULT_PREFS));
    applyPreferencesToDOM(DEFAULT_PREFS);
  }

  function handleToggleFocusSidebars() {
    const next = !focusSidebarsCollapsed;
    setFocusSidebarsCollapsed(next);
    window.dispatchEvent(
      new CustomEvent('insight-toggle-focus-mode', {
        detail: { collapse: next },
      })
    );
  }

  async function handleUpdateUsername(e: React.FormEvent) {
    e.preventDefault();
    if (!myProfile || savingUsername) return;
    setUsernameMsg(null);

    const clean = newUsername.trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
    if (clean.length < 3 || RESERVED_USERNAMES.has(clean)) {
      setUsernameMsg({
        type: 'error',
        text: 'Escolha um @username válido com pelo menos 3 caracteres.',
      });
      return;
    }

    if (usernameStatus === 'taken') {
      setUsernameMsg({
        type: 'error',
        text: `O identificador @${clean} já pertence a outra conta.`,
      });
      return;
    }

    setSavingUsername(true);
    const { error } = await supabase
      .from('profiles')
      .update({ username: clean })
      .eq('id', myProfile.id);
    setSavingUsername(false);

    if (error) {
      setUsernameMsg({
        type: 'error',
        text: 'Não foi possível alterar o @username: ' + error.message,
      });
      return;
    }

    setMyProfile({ ...myProfile, username: clean });
    setUsernameStatus('idle');
    setUsernameMsg({
      type: 'success',
      text: `Seu identificador agora é @${clean}`,
    });
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    setPasswordMsg(null);

    const problem = validateNewPassword(newPassword, confirmPassword);
    if (problem) {
      setPasswordMsg({ type: 'error', text: problem });
      return;
    }
    if (!currentPassword) {
      setPasswordMsg({ type: 'error', text: 'Digite sua senha atual.' });
      return;
    }

    setUpdatingPassword(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user?.email) {
      setUpdatingPassword(false);
      setPasswordMsg({ type: 'error', text: 'Sessão expirada. Entre de novo.' });
      return;
    }

    // confirma a senha atual antes de trocar
    const { error: reauthError } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: currentPassword,
    });
    if (reauthError) {
      setUpdatingPassword(false);
      setPasswordMsg({ type: 'error', text: 'A senha atual está incorreta.' });
      return;
    }

    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (!error) await supabase.auth.signOut({ scope: 'others' }).catch(() => {});
    setUpdatingPassword(false);

    if (error) {
      setPasswordMsg({
        type: 'error',
        text: error.message.toLowerCase().includes('different')
          ? 'A nova senha precisa ser diferente da atual.'
          : 'Não foi possível atualizar a senha. Tente novamente.',
      });
      return;
    }

    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setPasswordMsg({
      type: 'success',
      text: 'Senha atualizada! Encerramos a sessão nos outros aparelhos.',
    });
  }

  async function handleSendVerification() {
    setVerifyMsg(null);
    setSendingVerify(true);
    const res = await fetch('/api/account/verify-email', { method: 'POST' });
    const d = await res.json().catch(() => ({}));
    setSendingVerify(false);
    if (d.alreadyVerified) setVerifyMsg('Seu e-mail já está verificado.');
    else setVerifyMsg(res.ok ? 'Link enviado! Confira sua caixa de entrada (e o spam).' : d.error || 'Não foi possível enviar.');
  }

  async function handleExportUserData() {
    if (!myProfile || exportingData) return;
    setExportingData(true);

    try {
      const { data: userPosts } = await supabase
        .from('posts')
        .select('*')
        .or(`profile_id.eq.${myProfile.id},author_id.eq.${myProfile.id}`)
        .order('created_at', { ascending: false });

      const backupPayload = {
        exported_at: new Date().toISOString(),
        platform: 'Insight*',
        profile: myProfile,
        posts_count: userPosts?.length || 0,
        posts: userPosts || [],
      };

      const blob = new Blob([JSON.stringify(backupPayload, null, 2)], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `insight-dados-${myProfile.username}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExportingData(false);
    }
  }

  async function handleSelfDeleteAccount() {
    if (!myProfile) return;
    if (myProfile.id === FOUNDER_PROFILE_ID) {
      notify('A conta principal do fundador não pode ser autoexcluída.');
      return;
    }

    const confirmation = await askText({
      title: 'Excluir minha conta',
      message: `Isto apaga para sempre o perfil @${myProfile.username} e todas as suas publicações.\n\nPara confirmar, digite EXCLUIR MINHA CONTA:`,
      placeholder: 'EXCLUIR MINHA CONTA',
      confirmLabel: 'Continuar',
      danger: true,
    });
    if (confirmation === null) return;
    if (confirmation.trim().toUpperCase() !== 'EXCLUIR MINHA CONTA') {
      notify('Texto de confirmação diferente: a conta não foi excluída.', 'error');
      return;
    }
    const pw = await askText({
      title: 'Confirme sua senha',
      message: 'Por segurança, digite sua senha atual:',
      password: true,
      confirmLabel: 'Excluir conta',
      danger: true,
    });
    if (!pw) return;

    const res = await fetch('/api/account/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: pw, confirmation: 'EXCLUIR MINHA CONTA' }),
    });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) {
      notify(d.error || 'Erro ao excluir a conta.');
      return;
    }

    await supabase.auth.signOut();
    notify('Sua conta e seus dados foram removidos da plataforma.');
    router.push('/');
    router.refresh();
  }

  async function handleToggleWebPush() {
    if (!pushSupported || loadingPush) return;
    setLoadingPush(true);

    try {
      const reg = await navigator.serviceWorker.register('/sw.js');
      await navigator.serviceWorker.ready;
      const existingSub = await reg.pushManager.getSubscription();

      if (existingSub) {
        await fetch('/api/push', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'unsubscribe',
            endpoint: existingSub.endpoint,
          }),
        });
        await existingSub.unsubscribe();
        setPushSubscribed(false);
      } else {
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') {
          notify('Permita as notificações no cadeado da barra de endereços do navegador.');
          setLoadingPush(false);
          return;
        }

        const newSub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(
            DEFAULT_VAPID_PUBLIC_KEY
          ) as unknown as BufferSource,
        });

        await fetch('/api/push', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'subscribe',
            subscription: newSub.toJSON(),
            notifyMode: 'all',
            interestedTags: [],
          }),
        });

        setPushSubscribed(true);
      }
    } catch (err: any) {
      notify(err?.message || 'Erro ao configurar notificações no navegador.');
    } finally {
      setLoadingPush(false);
    }
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
      notify('Selecione pelo menos uma hashtag de seu interesse.');
      return;
    }

    setSavingSub(true);

    const { error } = await supabase.rpc('subscribe_newsletter', {
      p_email: cleanEmail,
      p_notify_mode: notifyMode,
      p_interested_tags: notifyMode === 'tags' ? subTags : [],
    });

    if (error) {
      setSavingSub(false);
      notify('Erro ao salvar preferências: ' + error.message);
      return;
    }

    localStorage.setItem('insight-subscriber-email', cleanEmail);
    setSavingSub(false);
    setSubSaved(true);
    setTimeout(() => setSubSaved(false), 2500);
  }

  async function handleGenerateInviteCode() {
    if (!isStaff || creatingInvite) return;
    setCreatingInvite(true);

    const code = generateRandomBetaCode();
    const { error } = await supabase.from('invite_codes').insert({
      code,
      max_uses: Math.max(1, Number(newCodeMaxUses) || 5),
      created_by: myProfile?.id || FOUNDER_PROFILE_ID,
    });

    setCreatingInvite(false);
    if (!error) loadStaffPanelData();
  }

  async function handleDeleteInviteCode(id: string) {
    await supabase.from('invite_codes').delete().eq('id', id);
    setInviteCodes((prev) => prev.filter((c) => c.id !== id));
  }

  async function handleResolveReport(reportId: string, status: 'resolved' | 'dismissed') {
    await supabase.from('reports').update({ status }).eq('id', reportId);
    setReports((prev) =>
      prev.map((r) => (r.id === reportId ? { ...r, status } : r))
    );
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    setUserEmail(null);
    setMyProfile(null);
    setIsStaff(false);
    router.push('/');
    router.refresh();
  }

  // Índice atual do tamanho da fonte na trilha de 5 pontos
  const currentFontStepIndex = Math.max(
    0,
    FONT_SIZE_STEPS.findIndex((s) => Math.abs(s - prefs.fontSize) < 0.8)
  );
  const fontProgressPct =
    (currentFontStepIndex / (FONT_SIZE_STEPS.length - 1)) * 100;

  return (
    <div className="w-full min-h-screen bg-background">
      {/* CABEÇALHO FIXO MINIMALISTA COM ABAS */}
      <header className="sticky top-0 z-30 bg-background/85 backdrop-blur-md border-b border-border">
        <div className="px-4 sm:px-6 pt-4 pb-3 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-lg sm:text-xl font-extrabold text-primary">
              Configurações
            </h1>
            <p className="text-xs text-muted">
              Personalize sua experiência de leitura, cores, plano de fundo e conta
            </p>
          </div>

          {myProfile && (
            <Link
              href={`/u/${encodeURIComponent(myProfile.username)}`}
              title={`@${myProfile.username}`}
              className="shrink-0 max-w-[45%] sm:max-w-none p-1 sm:px-3 sm:py-1.5 rounded-full bg-surface border border-border hover:border-accent text-xs font-bold text-primary flex items-center gap-2 transition-colors"
            >
              <img
                src={myProfile.avatar_url || '/assets/net/default-perfil'}
                alt={myProfile.full_name}
                className="w-7 h-7 sm:w-5 sm:h-5 rounded-full object-cover shrink-0"
              />
              <span className="hidden sm:inline truncate">@{myProfile.username}</span>
            </Link>
          )}
        </div>

        {/* Abas Horizontais Limpas */}
        <div className="px-6 flex items-center gap-6 overflow-x-auto no-scrollbar text-xs sm:text-sm font-bold">
          <button
            type="button"
            onClick={() => setActiveTab('appearance')}
            className={`py-2.5 relative flex items-center gap-1.5 whitespace-nowrap transition-colors ${
              activeTab === 'appearance'
                ? 'text-primary'
                : 'text-secondary hover:text-primary'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5 text-accent" />
            <span>Leitura & Visual</span>
            {activeTab === 'appearance' && (
              <span className="absolute bottom-0 left-0 right-0 h-[2.5px] rounded-full bg-accent" />
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('account')}
            className={`py-2.5 relative flex items-center gap-1.5 whitespace-nowrap transition-colors ${
              activeTab === 'account'
                ? 'text-primary'
                : 'text-secondary hover:text-primary'
            }`}
          >
            <UserCheck className="w-3.5 h-3.5 text-accent" />
            <span>Conta & Segurança</span>
            {activeTab === 'account' && (
              <span className="absolute bottom-0 left-0 right-0 h-[2.5px] rounded-full bg-accent" />
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('notifications')}
            className={`py-2.5 relative flex items-center gap-1.5 whitespace-nowrap transition-colors ${
              activeTab === 'notifications'
                ? 'text-primary'
                : 'text-secondary hover:text-primary'
            }`}
          >
            <Bell className="w-3.5 h-3.5 text-accent" />
            <span>Notificações</span>
            {activeTab === 'notifications' && (
              <span className="absolute bottom-0 left-0 right-0 h-[2.5px] rounded-full bg-accent" />
            )}
          </button>

          {hasNitroAccess && (
            <button
              type="button"
              onClick={() => setActiveTab('nitro')}
              className={`py-2.5 relative flex items-center gap-1.5 whitespace-nowrap transition-colors ${
                activeTab === 'nitro'
                  ? 'text-primary'
                  : 'text-secondary hover:text-primary'
              }`}
            >
              <NitroZap className="w-3.5 h-3.5 text-accent" />
              <span>Perfil & Nitro</span>
              {activeTab === 'nitro' && (
                <span className="absolute bottom-0 left-0 right-0 h-[2.5px] rounded-full bg-accent" />
              )}
            </button>
          )}

          {isStaff && (
            <button
              type="button"
              onClick={() => setActiveTab('staff')}
              className={`py-2.5 relative flex items-center gap-1.5 whitespace-nowrap transition-colors ${
                activeTab === 'staff'
                  ? 'text-primary'
                  : 'text-secondary hover:text-primary'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5 text-accent" />
              <span>Equipe Dev</span>
              {activeTab === 'staff' && (
                <span className="absolute bottom-0 left-0 right-0 h-[2.5px] rounded-full bg-accent" />
              )}
            </button>
          )}
        </div>
      </header>

      {/* ====================================================================
          ABA 1: LEITURA & VISUAL (SEPARAÇÃO FLUIDA SEM CARDS)
          ==================================================================== */}
      {activeTab === 'appearance' && (
        <div className="divide-y divide-border">
          {/* Prévia de Leitura Fluida no Topo */}
          <div className="px-6 py-5 bg-surface/20">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-mono uppercase tracking-wider text-muted">
                Prévia de leitura ao vivo
              </span>
              <button
                type="button"
                onClick={handleResetVisualPreferences}
                className="text-xs font-semibold text-secondary hover:text-primary inline-flex items-center gap-1 transition-colors"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Restaurar padrão</span>
              </button>
            </div>
            <p className="reading-preview-zone text-sm text-primary leading-relaxed">
              &ldquo;A simplicidade é o último grau de sofisticação. Ajuste abaixo o tamanho da fonte, a cor de destaque, o plano de fundo e o modo de leitura confortável.&rdquo;
            </p>
          </div>

          {/* 1. Tamanho da Fonte (Trilha de 5 pontos: Aa ---●--- Aa) */}
          <div className="px-6 py-6 space-y-5">
            <h2 className="text-base font-extrabold text-primary">
              Tamanho da fonte
            </h2>

            <div className="flex items-center gap-4 pt-1">
              <span className="text-xs font-medium text-secondary select-none">
                Aa
              </span>

              <div className="relative flex-1 flex items-center justify-between">
                {/* Linha de fundo */}
                <div className="absolute left-0 right-0 h-1 rounded-full bg-elevated" />

                {/* Linha preenchida até o ponto ativo */}
                <div
                  style={{ width: `${mounted ? fontProgressPct : 50}%` }}
                  className="absolute left-0 h-1 rounded-full bg-accent transition-all duration-200"
                />

                {/* 5 Nós clicáveis */}
                {FONT_SIZE_STEPS.map((stepSize, idx) => {
                  const isSelected = mounted && idx === currentFontStepIndex;
                  const isPassed = mounted && idx <= currentFontStepIndex;

                  return (
                    <button
                      key={stepSize}
                      type="button"
                      onClick={() => updatePreferences({ fontSize: stepSize })}
                      title={`Tamanho ${idx + 1}`}
                      className="relative z-10 flex items-center justify-center focus:outline-none group py-2"
                    >
                      <span
                        className={`rounded-full transition-all duration-150 ${
                          isSelected
                            ? 'w-5 h-5 bg-accent shadow-md scale-110 ring-4 ring-accent/20'
                            : isPassed
                            ? 'w-3.5 h-3.5 bg-accent'
                            : 'w-3.5 h-3.5 bg-border group-hover:bg-secondary'
                        }`}
                      />
                    </button>
                  );
                })}
              </div>

              <span className="text-xl font-semibold text-primary select-none">
                Aa
              </span>
            </div>
          </div>

          {/* 2. Cor de Destaque (Círculos grandes com Checkmark interno) */}
          <div className="px-6 py-6 space-y-4">
            <h2 className="text-base font-extrabold text-primary">Cor</h2>

            <div className="flex flex-wrap items-center justify-between sm:justify-start sm:gap-7 gap-3 pt-1">
              {ACCENT_PRESETS.map((preset) => {
                const active =
                  mounted &&
                  prefs.accentColor.toLowerCase() === preset.color.toLowerCase();

                return (
                  <button
                    key={preset.color}
                    type="button"
                    title={preset.label}
                    onClick={() => updatePreferences({ accentColor: preset.color })}
                    style={{ backgroundColor: preset.color }}
                    className="w-11 h-11 rounded-full flex items-center justify-center text-white shadow-sm transition-transform hover:scale-105 active:scale-95 focus:outline-none"
                  >
                    {active && <Check className="w-5 h-5 stroke-[2.8]" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 3. Plano de Fundo (Blocos Retangulares Limpos + Switches Fluídos) */}
          <div className="px-6 py-6 space-y-5">
            <h2 className="text-base font-extrabold text-primary">
              Plano de fundo
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              {[
                {
                  id: 'light' as ThemeOption,
                  label: 'Claro',
                  bg: '#ffffff',
                  textColor: '#0f172a',
                  borderIdle: '#cbd5e1',
                },
                {
                  id: 'dark' as ThemeOption,
                  label: 'Obsidian',
                  bg: '#121317',
                  textColor: '#f4f4f5',
                  borderIdle: '#27272a',
                },
                {
                  id: 'night' as ThemeOption,
                  label: 'Âmbar',
                  bg: '#191510',
                  textColor: '#ebe3d5',
                  borderIdle: '#3d3429',
                },
                {
                  id: 'oled' as ThemeOption,
                  label: 'Lights out',
                  bg: '#000000',
                  textColor: '#ffffff',
                  borderIdle: '#27272a',
                },
              ].map((t) => {
                const active = mounted && prefs.theme === t.id;

                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => {
                      const patch: Partial<UserPreferences> = { theme: t.id };
                      if (t.id === 'night') {
                        patch.readingMode = true;
                        patch.accentColor = '#e08b3e';
                      } else if (
                        prefs.theme === 'night' &&
                        prefs.accentColor === '#e08b3e'
                      ) {
                        patch.accentColor = '#2563eb';
                      }
                      updatePreferences(patch);
                    }}
                    style={{
                      backgroundColor: t.bg,
                      color: t.textColor,
                      borderColor: active ? prefs.accentColor : t.borderIdle,
                    }}
                    className={`h-16 px-4 rounded-xl border-2 flex items-center gap-3 transition-all focus:outline-none ${
                      active ? 'shadow-md' : 'opacity-90 hover:opacity-100'
                    }`}
                  >
                    <span
                      style={{
                        backgroundColor: active ? prefs.accentColor : 'transparent',
                        borderColor: active
                          ? prefs.accentColor
                          : 'rgba(148, 163, 184, 0.5)',
                      }}
                      className="w-5 h-5 rounded-full border flex items-center justify-center shrink-0 text-white"
                    >
                      {active && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                    </span>

                    <span className="text-xs sm:text-sm font-bold truncate">
                      {t.label}
                    </span>
                  </button>
                );
              })}

              {/* Insight Nitro: mais fundos (temas) — borda arco-íris */}
              <Link
                href={nitroActive ? '/nitro' : '/nitro/assinar'}
                className="nitro-rainbow-border group block h-16 rounded-xl p-[2px] transition-transform hover:scale-[1.02] focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                <span className="h-full w-full rounded-[10px] bg-surface flex items-center gap-2.5 px-3">
                  <NitroZap className="w-5 h-5 text-fuchsia-400 shrink-0" />
                  <span className="min-w-0 leading-tight">
                    <span className="block text-xs sm:text-sm font-extrabold bg-gradient-to-r from-sky-400 via-fuchsia-400 to-amber-300 bg-clip-text text-transparent truncate">
                      {nitroActive ? 'Acessar Nitro' : 'Assinar Nitro'}
                    </span>
                    <span className="block text-[10px] text-muted truncate">
                      {nitroActive ? 'Seus temas e fundos' : 'Para obter mais fundos'}
                    </span>
                  </span>
                </span>
              </Link>
            </div>

            {/* Opções de Leitura Confortável e Filtro Quente integradas sem cards */}
            <div className="pt-4 space-y-5">
              {/* Switch: Modo de Leitura Confortável */}
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-primary">
                    Modo de leitura confortável
                  </p>
                  <p className="text-xs text-muted mt-0.5">
                    Aumenta o entrelinhamento dos posts (1.85x) e suaviza o espaçamento para textos longos
                  </p>
                </div>
                <FluidSwitch
                  checked={Boolean(mounted && prefs.readingMode)}
                  onChange={() =>
                    updatePreferences({ readingMode: !prefs.readingMode })
                  }
                />
              </div>

              {/* Barra Deslizante: Filtro Noturno de Luz Azul */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-primary">
                      Filtro noturno de luz azul (Tom Âmbar)
                    </p>
                    <p className="text-xs text-muted">
                      Aplica uma camada quente suave para proteger a visão à noite
                    </p>
                  </div>
                  <span className="text-xs font-mono font-bold text-accent">
                    {mounted ? prefs.warmFilter : 0}%
                  </span>
                </div>

                <input
                  type="range"
                  min={0}
                  max={35}
                  step={5}
                  value={mounted ? prefs.warmFilter : 0}
                  onChange={(e) =>
                    updatePreferences({ warmFilter: Number(e.target.value) })
                  }
                  className="w-full accent-accent cursor-pointer h-1.5 bg-elevated rounded-lg"
                />
              </div>

              {/* Luz noturna laranja agendada */}
              <div className="space-y-3 rounded-xl border border-border bg-elevated/30 p-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-primary">Luz noturna automática</p>
                    <p className="text-xs text-muted">Liga o filtro laranja sozinho no horário escolhido</p>
                  </div>
                  <input
                    type="checkbox"
                    aria-label="Ativar luz noturna automática"
                    className="w-4 h-4 accent-accent cursor-pointer"
                    checked={Boolean(mounted && prefs.nightLight)}
                    onChange={() => updatePreferences({ nightLight: !prefs.nightLight })}
                  />
                </div>
                {mounted && prefs.nightLight && (
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center gap-3 text-xs text-secondary">
                      <label className="flex items-center gap-2">
                        Das
                        <input
                          type="time"
                          value={prefs.nightStart}
                          onChange={(e) => e.target.value && updatePreferences({ nightStart: e.target.value })}
                          className="bg-surface border border-border rounded-md px-2 py-1 text-primary"
                        />
                      </label>
                      <label className="flex items-center gap-2">
                        às
                        <input
                          type="time"
                          value={prefs.nightEnd}
                          onChange={(e) => e.target.value && updatePreferences({ nightEnd: e.target.value })}
                          className="bg-surface border border-border rounded-md px-2 py-1 text-primary"
                        />
                      </label>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-muted shrink-0">Intensidade</span>
                      <input
                        type="range"
                        min={10}
                        max={40}
                        step={5}
                        value={prefs.nightStrength}
                        onChange={(e) => updatePreferences({ nightStrength: Number(e.target.value) })}
                        className="flex-1 accent-accent cursor-pointer h-1.5 bg-elevated rounded-lg"
                      />
                      <span className="text-xs font-mono font-bold text-accent w-9 text-right">{prefs.nightStrength}%</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Tipografia das Publicações */}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-primary">
                    Tipografia das publicações
                  </p>
                  <p className="text-xs text-muted">
                    Escolha o estilo de fonte principal dos artigos e posts
                  </p>
                </div>

                <div className="inline-flex items-center gap-1.5">
                  {[
                    { id: 'sans' as ReadingFontOption, label: 'Sans' },
                    { id: 'serif' as ReadingFontOption, label: 'Editorial' },
                    { id: 'mono' as ReadingFontOption, label: 'Mono' },
                  ].map((f) => {
                    const active = mounted && prefs.readingFont === f.id;
                    return (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => updatePreferences({ readingFont: f.id })}
                        className={`px-3.5 py-1.5 rounded-full text-xs font-bold border transition-colors ${
                          active
                            ? 'bg-accent text-white border-accent'
                            : 'bg-transparent border-border text-secondary hover:text-primary'
                        }`}
                      >
                        {f.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* 4. Acessibilidade e Foco (Linhas Fluídas com Switch) */}
          <div className="px-6 py-6 space-y-5">
            <h2 className="text-base font-extrabold text-primary">
              Acessibilidade e foco
            </h2>

            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-primary">
                  Modo foco (Recolher barras laterais)
                </p>
                <p className="text-xs text-muted">
                  Expande a área central de leitura ocultando os menus laterais
                </p>
              </div>
              <FluidSwitch
                checked={focusSidebarsCollapsed}
                onChange={handleToggleFocusSidebars}
              />
            </div>

            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-primary">
                  Modo foco automático ao escrever
                </p>
                <p className="text-xs text-muted">
                  Recolhe as barras laterais quando você começa a escrever um Insight e as traz de volta ao terminar
                </p>
              </div>
              <FluidSwitch
                checked={autoFocusWriting}
                onChange={() => {
                  const next = !autoFocusWriting;
                  setAutoFocusWriting(next);
                  setAutoFocusModeEnabled(next);
                }}
              />
            </div>

            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-primary">
                  Alto contraste
                </p>
                <p className="text-xs text-muted">
                  Aumenta a nitidez das bordas e o contraste entre textos e fundo
                </p>
              </div>
              <FluidSwitch
                checked={Boolean(mounted && prefs.highContrast)}
                onChange={() =>
                  updatePreferences({ highContrast: !prefs.highContrast })
                }
              />
            </div>

            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-primary">
                  Reduzir animações
                </p>
                <p className="text-xs text-muted">
                  Minimiza efeitos de movimento e transições na interface
                </p>
              </div>
              <FluidSwitch
                checked={Boolean(mounted && prefs.reduceMotion)}
                onChange={() =>
                  updatePreferences({ reduceMotion: !prefs.reduceMotion })
                }
              />
            </div>
          </div>
        </div>
      )}

      {/* ====================================================================
          ABA 2: CONTA & SEGURANÇA (SEPARAÇÃO FLUIDA SEM CARDS)
          ==================================================================== */}
      {activeTab === 'account' && (
        <div className="divide-y divide-border">
          {userEmail && myProfile ? (
            <>
              {/* Sessão Atual */}
              <div className="px-6 py-6 flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3.5">
                  <img
                    src={myProfile.avatar_url || '/assets/net/default-perfil'}
                    alt={myProfile.full_name}
                    className="w-12 h-12 rounded-full object-cover border border-border"
                  />
                  <div>
                    <p className="text-sm font-extrabold text-primary">
                      {myProfile.display_name || myProfile.full_name}
                    </p>
                    <p className="text-xs text-muted">
                      @{myProfile.username} · {userEmail}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleLogout}
                  className="px-4 py-2 rounded-full border border-border hover:border-danger text-xs font-bold text-danger flex items-center gap-1.5 transition-colors"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Sair da conta</span>
                </button>
              </div>

              {/* Identificador Único (@username) */}
              <form
                onSubmit={handleUpdateUsername}
                className="px-6 py-6 space-y-3.5"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-base font-extrabold text-primary">
                      Identificador único (@username)
                    </h2>
                    <p className="text-xs text-muted">
                      Endereço público do seu perfil: /u/{newUsername || myProfile.username}
                    </p>
                  </div>

                  {usernameStatus === 'checking' && (
                    <span className="inline-flex items-center gap-1 text-xs text-sky-400">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Verificando...</span>
                    </span>
                  )}
                  {usernameStatus === 'available' && (
                    <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-400">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Disponível</span>
                    </span>
                  )}
                  {usernameStatus === 'taken' && (
                    <span className="inline-flex items-center gap-1 text-xs font-bold text-danger">
                      <XCircle className="w-3.5 h-3.5" />
                      <span>Já está em uso</span>
                    </span>
                  )}
                </div>

                {usernameMsg && (
                  <p
                    className={`text-xs font-semibold ${
                      usernameMsg.type === 'success'
                        ? 'text-emerald-400'
                        : 'text-danger'
                    }`}
                  >
                    {usernameMsg.text}
                  </p>
                )}

                <div className="flex flex-col sm:flex-row items-center gap-2.5 max-w-xl">
                  <div className="relative flex-1 w-full">
                    <AtSign className="w-4 h-4 text-muted absolute left-3.5 top-2.5" />
                    <input
                      type="text"
                      required
                      maxLength={24}
                      value={newUsername}
                      onChange={(e) =>
                        setNewUsername(
                          e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '')
                        )
                      }
                      className="w-full pl-9 pr-3.5 py-2 rounded-xl bg-surface border border-border text-xs sm:text-sm font-mono text-primary focus:outline-none focus:border-accent"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={
                      savingUsername ||
                      newUsername === myProfile.username ||
                      usernameStatus === 'taken' ||
                      usernameStatus === 'invalid' ||
                      usernameStatus === 'checking'
                    }
                    className="w-full sm:w-auto px-5 py-2 rounded-full bg-accent text-white text-xs font-bold hover:bg-accent-hover disabled:opacity-40 transition-colors shrink-0"
                  >
                    {savingUsername ? 'Salvando...' : 'Atualizar'}
                  </button>
                </div>
              </form>

              {/* Verificação de e-mail */}
              <div className="px-6 py-6 space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-3 max-w-xl">
                  <div>
                    <h2 className="text-base font-extrabold text-primary flex items-center gap-2">
                      Verificação da conta
                      {myProfile.email_verified_at ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                          <VerifiedBadge size={12} /> Verificada
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30">
                          Pendente
                        </span>
                      )}
                    </h2>
                    <p className="text-xs text-muted">
                      {myProfile.email_verified_at
                        ? `E-mail confirmado em ${new Date(myProfile.email_verified_at).toLocaleDateString('pt-BR')}. Seu perfil exibe o selo de verificado.`
                        : 'Confirme seu e-mail para ganhar o selo de verificado e poder recuperar a conta.'}
                    </p>
                  </div>
                  {!myProfile.email_verified_at && (
                    <button
                      type="button"
                      onClick={handleSendVerification}
                      disabled={sendingVerify}
                      className="px-4 py-2 rounded-full bg-accent text-white text-xs font-bold hover:bg-accent-hover disabled:opacity-50 shrink-0"
                    >
                      {sendingVerify ? 'Enviando...' : 'Enviar link de verificação'}
                    </button>
                  )}
                </div>
                {verifyMsg && <p className="text-xs text-secondary">{verifyMsg}</p>}
              </div>

              {/* Alterar Senha */}
              <form
                onSubmit={handleChangePassword}
                className="px-6 py-6 space-y-3.5"
              >
                <div className="flex items-center justify-between max-w-xl">
                  <div>
                    <h2 className="text-base font-extrabold text-primary">
                      Alterar senha
                    </h2>
                    <p className="text-xs text-muted">
                      Confirme a senha atual e escolha uma nova (mínimo de 8 caracteres)
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="text-xs text-secondary hover:text-primary flex items-center gap-1"
                  >
                    {showPassword ? (
                      <>
                        <EyeOff className="w-3.5 h-3.5" />
                        <span>Ocultar</span>
                      </>
                    ) : (
                      <>
                        <Eye className="w-3.5 h-3.5" />
                        <span>Mostrar</span>
                      </>
                    )}
                  </button>
                </div>

                {passwordMsg && (
                  <p
                    className={`text-xs font-semibold ${
                      passwordMsg.type === 'success'
                        ? 'text-emerald-400'
                        : 'text-danger'
                    }`}
                  >
                    {passwordMsg.text}
                  </p>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-xl">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    autoComplete="current-password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Senha atual"
                    className="sm:col-span-2 bg-surface border border-border rounded-xl px-3.5 py-2 text-xs text-primary placeholder:text-muted focus:outline-none focus:border-accent"
                  />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    minLength={8}
                    autoComplete="new-password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Nova senha"
                    className="bg-surface border border-border rounded-xl px-3.5 py-2 text-xs text-primary placeholder:text-muted focus:outline-none focus:border-accent"
                  />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    minLength={8}
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirme a nova senha"
                    className="bg-surface border border-border rounded-xl px-3.5 py-2 text-xs text-primary placeholder:text-muted focus:outline-none focus:border-accent"
                  />
                  <div className="sm:col-span-2">
                    <PasswordStrength value={newPassword} />
                  </div>
                </div>
                <p className="text-[11px] text-muted max-w-xl">
                  Esqueceu a senha atual?{' '}
                  <a href="/login?recuperar=1" className="text-accent font-semibold hover:underline">
                    Receber link de redefinição
                  </a>
                </p>

                <div>
                  <button
                    type="submit"
                    disabled={updatingPassword}
                    className="px-5 py-2 rounded-full bg-accent text-white text-xs font-bold hover:bg-accent-hover disabled:opacity-50 transition-colors"
                  >
                    {updatingPassword ? 'Atualizando...' : 'Salvar nova senha'}
                  </button>
                </div>
              </form>

              {myProfile && <BlockedAccounts viewerId={myProfile.id} />}

              {/* Dados, Backup e Documentos Legais */}
              <div className="px-6 py-6 space-y-5">
                <h2 className="text-base font-extrabold text-primary">
                  Seus dados e privacidade (LGPD)
                </h2>

                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-primary">
                      Exportar backup da conta (JSON)
                    </p>
                    <p className="text-xs text-muted">
                      Baixe uma cópia com seus dados de perfil e todas as suas publicações
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleExportUserData}
                    disabled={exportingData}
                    className="px-4 py-2 rounded-full border border-border hover:border-accent text-xs font-bold text-primary flex items-center gap-1.5 shrink-0 transition-colors"
                  >
                    <Download className="w-3.5 h-3.5 text-accent" />
                    <span>{exportingData ? 'Gerando...' : 'Baixar arquivo'}</span>
                  </button>
                </div>

                <div className="flex flex-wrap items-center gap-6 pt-1 text-xs font-semibold text-accent">
                  <Link
                    href="/privacidade"
                    className="hover:underline inline-flex items-center gap-1.5"
                  >
                    <Shield className="w-3.5 h-3.5" />
                    <span>Política de Privacidade</span>
                  </Link>
                  <Link
                    href="/termos"
                    className="hover:underline inline-flex items-center gap-1.5"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>Termos de Uso</span>
                  </Link>
                </div>

                {myProfile.id !== FOUNDER_PROFILE_ID && (
                  <div className="pt-3 flex items-center justify-between">
                    <span className="text-xs text-muted">
                      Encerrar conta e apagar publicações
                    </span>
                    <button
                      type="button"
                      onClick={handleSelfDeleteAccount}
                      className="text-xs font-bold text-danger hover:underline flex items-center gap-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Excluir minha conta</span>
                    </button>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="px-6 py-14 text-center space-y-3">
              <Lock className="w-6 h-6 text-accent mx-auto" />
              <h2 className="text-sm font-bold text-primary">
                Você não está autenticado
              </h2>
              <p className="text-xs text-secondary max-w-sm mx-auto">
                Entre ou crie sua conta para gerenciar seu @username, senha e dados pessoais.
              </p>
              <Link
                href="/login"
                className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-full bg-accent text-white text-xs font-bold hover:bg-accent-hover"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>Entrar / Criar Conta</span>
              </Link>
            </div>
          )}
        </div>
      )}

      {/* ====================================================================
          ABA 3: NOTIFICAÇÕES (SEPARAÇÃO FLUIDA SEM CARDS)
          ==================================================================== */}
      {activeTab === 'notifications' && (
        <div className="divide-y divide-border">
          {/* Web Push no Navegador */}
          <div className="px-6 py-6 flex items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-extrabold text-primary">
                Alertas instantâneos no navegador (Web Push)
              </h2>
              <p className="text-xs text-muted mt-0.5">
                Receba notificações nativas no seu dispositivo assim que novas atualizações saírem
              </p>
            </div>

            {pushSupported ? (
              <FluidSwitch
                checked={pushSubscribed}
                onChange={handleToggleWebPush}
              />
            ) : (
              <span className="text-xs font-mono text-muted">Indisponível</span>
            )}
          </div>

          {/* Newsletter por E-mail */}
          <form
            onSubmit={handleSaveNewsletterPrefs}
            className="px-6 py-6 space-y-5"
          >
            <div>
              <h2 className="text-base font-extrabold text-primary">
                Notificações por e-mail
              </h2>
              <p className="text-xs text-muted mt-0.5">
                Escolha quais publicações e notas oficiais deseja receber no seu e-mail
              </p>
            </div>

            <input
              type="email"
              required
              value={subEmail}
              onChange={(e) => setSubEmail(e.target.value)}
              onBlur={(e) => loadSubscriberPreferences(e.target.value)}
              placeholder="Seu melhor e-mail..."
              className="max-w-md w-full bg-surface border border-border rounded-xl px-3.5 py-2 text-xs sm:text-sm text-primary placeholder:text-muted focus:outline-none focus:border-accent"
            />

            <div className="space-y-3 max-w-xl">
              {[
                {
                  id: 'all' as NotifyMode,
                  title: 'Todas as publicações',
                  sub: 'Aviso a cada novo insight publicado',
                  icon: Sparkles,
                },
                {
                  id: 'pinned' as NotifyMode,
                  title: 'Apenas destaques fixados',
                  sub: 'Somente publicações marcadas como fixadas',
                  icon: Pin,
                },
                {
                  id: 'tags' as NotifyMode,
                  title: 'Filtrar por #hashtags',
                  sub: 'Apenas os temas selecionados abaixo',
                  icon: Hash,
                },
                {
                  id: 'official_only' as NotifyMode,
                  title: 'Somente notas oficiais',
                  sub: 'Apenas changelogs da plataforma',
                  icon: Lock,
                },
              ].map((opt) => {
                const active = notifyMode === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setNotifyMode(opt.id)}
                    className="w-full py-2 flex items-center justify-between text-left group focus:outline-none"
                  >
                    <div>
                      <p className="text-sm font-semibold text-primary group-hover:text-accent transition-colors">
                        {opt.title}
                      </p>
                      <p className="text-xs text-muted">{opt.sub}</p>
                    </div>

                    <span
                      className={`w-5 h-5 rounded-full border flex items-center justify-center transition-colors ${
                        active
                          ? 'bg-accent border-accent text-white'
                          : 'border-border'
                      }`}
                    >
                      {active && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                    </span>
                  </button>
                );
              })}
            </div>

            {notifyMode === 'tags' && (
              <div className="pt-2 space-y-2">
                <p className="text-xs font-semibold text-secondary">
                  Selecione as hashtags de interesse:
                </p>
                <div className="flex flex-wrap gap-1.5">
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
                            : 'bg-transparent text-secondary border-border hover:text-primary'
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

            <div>
              <button
                type="submit"
                disabled={savingSub}
                className="px-5 py-2 rounded-full bg-accent text-white text-xs font-bold hover:bg-accent-hover inline-flex items-center gap-1.5 disabled:opacity-50"
              >
                {subSaved ? (
                  <>
                    <Check className="w-4 h-4" />
                    <span>Preferências salvas!</span>
                  </>
                ) : (
                  <span>{savingSub ? 'Salvando...' : 'Salvar preferências'}</span>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ====================================================================
          ABA 4: PAINEL DA EQUIPE DEV (SEPARAÇÃO FLUIDA SEM CARDS)
          ==================================================================== */}
      {activeTab === 'nitro' && hasNitroAccess && <NitroConfigTab />}

      {activeTab === 'staff' && isStaff && (
        <div className="divide-y divide-border">
          <SignupSwitch />
          <div className="px-6 py-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-extrabold text-primary">
                  Chaves de convite do Beta Fechado ({inviteCodes.length})
                </h2>
                <p className="text-xs text-muted">
                  Gere e gerencie códigos no padrão XXXX-XXXX-XXXX para novos membros
                </p>
              </div>

              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5 border border-border rounded-full px-3 py-1.5 text-xs">
                  <span className="text-muted text-[11px]">Usos:</span>
                  <input
                    type="number"
                    min={1}
                    max={500}
                    value={newCodeMaxUses}
                    onChange={(e) => setNewCodeMaxUses(Number(e.target.value))}
                    className="w-10 bg-transparent font-mono font-bold text-primary focus:outline-none text-center"
                  />
                </div>

                <button
                  type="button"
                  disabled={creatingInvite}
                  onClick={handleGenerateInviteCode}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-accent text-white text-xs font-bold hover:bg-accent-hover disabled:opacity-50"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Gerar chave</span>
                </button>
              </div>
            </div>

            <div className="divide-y divide-border border-t border-border">
              {inviteCodes.map((item) => {
                const exhausted = item.uses_count >= item.max_uses;
                return (
                  <div
                    key={item.id}
                    className="py-3 flex items-center justify-between gap-2"
                  >
                    <div>
                      <p className="text-xs sm:text-sm font-mono font-extrabold text-primary tracking-wider">
                        {item.code}
                      </p>
                      <p
                        className={`text-[11px] font-mono ${
                          exhausted ? 'text-danger' : 'text-emerald-400'
                        }`}
                      >
                        {item.uses_count} / {item.max_uses} acessos utilizados
                      </p>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(item.code);
                          setCopiedCode(item.code);
                          setTimeout(() => setCopiedCode(null), 1800);
                        }}
                        className="p-2 rounded-full hover:bg-surface text-secondary hover:text-primary transition-colors"
                      >
                        {copiedCode === item.code ? (
                          <Check className="w-4 h-4 text-emerald-400" />
                        ) : (
                          <Copy className="w-4 h-4" />
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDeleteInviteCode(item.id)}
                        className="p-2 rounded-full hover:bg-surface text-muted hover:text-danger transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="px-6 py-6 space-y-3">
            <h2 className="text-base font-extrabold text-primary flex items-center gap-2">
              <Flag className="w-4 h-4 text-danger" />
              <span>
                Denúncias da comunidade ({reports.filter((r) => r.status === 'pending').length} pendentes)
              </span>
            </h2>

            {reports.length === 0 ? (
              <p className="text-xs text-muted py-2">
                Nenhuma denúncia registrada até o momento.
              </p>
            ) : (
              <div className="divide-y divide-border">
                {reports.map((rep) => (
                  <div
                    key={rep.id}
                    className="py-3 flex flex-wrap items-center justify-between gap-3 text-xs"
                  >
                    <div>
                      <p className="font-bold text-primary">{rep.reason}</p>
                      <p className="text-[11px] text-muted font-mono">
                        Status: {rep.status.toUpperCase()} ·{' '}
                        {new Date(rep.created_at).toLocaleDateString('pt-BR')}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      {rep.target_post_id && (
                        <Link
                          href={`/?post=${rep.target_post_id}`}
                          className="px-3 py-1 rounded-full border border-border text-[11px] font-semibold text-accent flex items-center gap-1"
                        >
                          <span>Ver post</span>
                          <ExternalLink className="w-3 h-3" />
                        </Link>
                      )}
                      {rep.status === 'pending' && (
                        <>
                          <button
                            type="button"
                            onClick={() => handleResolveReport(rep.id, 'resolved')}
                            className="px-3 py-1 rounded-full bg-emerald-500/15 text-emerald-400 text-[11px] font-bold"
                          >
                            Resolvido
                          </button>
                          <button
                            type="button"
                            onClick={() => handleResolveReport(rep.id, 'dismissed')}
                            className="px-3 py-1 rounded-full border border-border text-muted hover:text-primary text-[11px]"
                          >
                            Arquivar
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}