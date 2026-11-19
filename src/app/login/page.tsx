'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import {
  Lock,
  Mail,
  User,
  AtSign,
  KeyRound,
  ArrowRight,
  ArrowLeft,
  ShieldCheck,
  Sparkles,
  Eye,
  EyeOff,
  CheckCircle2,
  XCircle,
  Loader2,
} from 'lucide-react';

// ============================================================================
// CONTROLE DO BETA FECHADO: Mude para false quando sair do Closed Beta
// ============================================================================
const IS_CLOSED_BETA = true;

const FOUNDER_AUTH_EMAIL = 'victorhugopoiani12@gmail.com';
const FOUNDER_ALIASES = new Set([
  'victorhugopoiani12@gmail.com',
  'victorpoiani12@gmail.com',
  '@victorpoiani12@gmail.com',
  '@victorhugopoiani12@gmail.com',
  'victorpoiani',
  '@victorpoiani',
  'victor poiani',
  '@victor poiani',
]);

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

function formatInviteCode(value: string) {
  const clean = value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12);
  const parts = clean.match(/.{1,4}/g) || [];
  return parts.join('-');
}

function ExtrudedAsterisk3D({
  theme,
  size = 580,
  depthLayers = 28,
  layerSpacing = 1.7,
}: {
  theme: 'dark' | 'light';
  size?: number;
  depthLayers?: number;
  layerSpacing?: number;
}) {
  const layers = Array.from({ length: depthLayers }, (_, i) => i);
  const half = (depthLayers - 1) / 2;

  const frontFill = theme === 'dark' ? '#3898ec' : '#2b8ce6';
  const bevelStroke = theme === 'dark' ? '#7cc4fa' : '#7cc8ff';
  const sideColorMid = theme === 'dark' ? '#2166a6' : '#1d6cb8';
  const sideColorDark = theme === 'dark' ? '#174978' : '#124a85';

  const armAngles = [0, 45, 90, 135];

  return (
    <div
      style={{
        width: size,
        height: size,
        transformStyle: 'preserve-3d',
      }}
      className="relative select-none pointer-events-none"
    >
      {layers.map((idx) => {
        const zOffset = (idx - half) * layerSpacing;
        const isFrontCap = idx === depthLayers - 1;
        const isBackCap = idx === 0;
        const isCap = isFrontCap || isBackCap;

        const normalizedDepth = idx / Math.max(1, depthLayers - 1);
        const layerFill = isCap
          ? frontFill
          : normalizedDepth > 0.5
          ? sideColorMid
          : sideColorDark;

        return (
          <svg
            key={idx}
            viewBox="0 0 200 200"
            style={{
              transform: `translateZ(${zOffset.toFixed(2)}px)`,
              backfaceVisibility: 'visible',
            }}
            className="absolute inset-0 w-full h-full overflow-visible"
          >
            <g transform="translate(100, 100)">
              {armAngles.map((angle) => (
                <rect
                  key={angle}
                  x="-17"
                  y="-86"
                  width="34"
                  height="172"
                  rx="5.5"
                  ry="5.5"
                  transform={`rotate(${angle})`}
                  fill={layerFill}
                  stroke={isCap ? bevelStroke : layerFill}
                  strokeWidth={isCap ? 1.5 : 0.6}
                  strokeLinejoin="round"
                />
              ))}
              <circle r="26" fill={isCap ? frontFill : layerFill} />
            </g>
          </svg>
        );
      })}
    </div>
  );
}

export default function LoginPage() {
  const supabase = createClient();

  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [mouseTilt, setMouseTilt] = useState({ x: 0, y: 0 });

  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [signupStep, setSignupStep] = useState<1 | 2>(1);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [inviteCode, setInviteCode] = useState('');

  const [usernameStatus, setUsernameStatus] = useState<
    'idle' | 'checking' | 'available' | 'taken' | 'invalid'
  >('idle');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    function syncThemeFromApp() {
      try {
        const saved = localStorage.getItem('insight-preferences');
        if (saved) {
          const parsed = JSON.parse(saved);
          const activeTheme = parsed.theme === 'light' ? 'light' : 'dark';
          setTheme(activeTheme);
          return;
        }
      } catch {
        // Ignora erro local
      }
      const attr = document.documentElement.getAttribute('data-theme');
      setTheme(attr === 'light' ? 'light' : 'dark');
    }

    syncThemeFromApp();

    const observer = new MutationObserver(syncThemeFromApp);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    });

    return () => observer.disconnect();
  }, []);

  async function verifyUsernameUniqueness(cleanUser: string): Promise<boolean> {
    if (cleanUser.length < 3 || RESERVED_USERNAMES.has(cleanUser)) {
      return false;
    }

    const { data: rpcAvailable, error: rpcErr } = await supabase.rpc(
      'check_username_available',
      { target_username: cleanUser }
    );

    if (!rpcErr && typeof rpcAvailable === 'boolean') {
      return rpcAvailable;
    }

    const { data: existingRows } = await supabase
      .from('profiles')
      .select('id')
      .ilike('username', cleanUser)
      .limit(1);

    return !existingRows || existingRows.length === 0;
  }

  useEffect(() => {
    if (mode !== 'signup') return;

    const clean = username.trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
    if (!clean) {
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
      const isFree = await verifyUsernameUniqueness(clean);
      if (!cancelled) {
        setUsernameStatus(isFree ? 'available' : 'taken');
      }
    }, 320);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [username, mode]);

  function handleMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    const { innerWidth, innerHeight } = window;
    const x = (e.clientX / innerWidth - 0.5) * 16;
    const y = (e.clientY / innerHeight - 0.5) * -16;
    setMouseTilt({ x, y });
  }

  async function handleNextStep(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const cleanUsername = username.trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
    if (cleanUsername.length < 3) {
      setError('O @username deve ter pelo menos 3 caracteres (letras, números ou _).');
      return;
    }

    if (RESERVED_USERNAMES.has(cleanUsername)) {
      setError('Este @username é reservado pelo sistema. Escolha outro.');
      return;
    }

    if (password.length < 6) {
      setError('A senha deve ter no mínimo 6 caracteres.');
      return;
    }

    setLoading(true);
    const isFree = await verifyUsernameUniqueness(cleanUsername);
    setLoading(false);

    if (!isFree) {
      setUsernameStatus('taken');
      setError(`O identificador @${cleanUsername} já pertence a outra conta. Escolha outro.`);
      return;
    }

    setUsernameStatus('available');

    if (IS_CLOSED_BETA) {
      setSignupStep(2);
    } else {
      await executeSignUp();
    }
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      let targetEmail = email.trim().toLowerCase();

      // 1. Mapeia automaticamente qualquer variação do seu e-mail ou username de fundador
      if (
        FOUNDER_ALIASES.has(targetEmail) ||
        FOUNDER_ALIASES.has(targetEmail.replace(/^@+/, ''))
      ) {
        targetEmail = FOUNDER_AUTH_EMAIL;
      } else if (targetEmail.startsWith('@') && targetEmail.includes('@', 1)) {
        // Remove '@' extra caso o usuário tenha digitado @email@dominio.com
        targetEmail = targetEmail.replace(/^@+/, '');
      }

      // 2. Limpa eventual sessão travada anterior antes de autenticar
      await supabase.auth.signOut().catch(() => {});

      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email: targetEmail,
        password: password.trim(),
      });

      // Fallback caso a senha original tenha espaços nas pontas
      let finalData = data;
      let finalError = signInError;
      if (signInError && password !== password.trim()) {
        const retry = await supabase.auth.signInWithPassword({
          email: targetEmail,
          password,
        });
        finalData = retry.data;
        finalError = retry.error;
      }

      if (finalError) {
        if (finalError.message.toLowerCase().includes('email not confirmed')) {
          throw new Error('Conta ainda não confirmada no servidor.');
        }
        if (finalError.message.toLowerCase().includes('invalid login credentials')) {
          throw new Error(
            'E-mail ou senha incorretos. Confira a senha clicando no ícone de olho ao lado.'
          );
        }
        throw new Error(finalError.message);
      }

      if (finalData?.user) {
        const { data: rows } = await supabase
          .from('profiles')
          .select('id, username')
          .or(`user_id.eq.${finalData.user.id},id.eq.${finalData.user.id}`)
          .limit(1);

        const prof = rows?.[0];
        if (prof?.username) {
          window.location.href = `/u/${encodeURIComponent(prof.username)}`;
        } else {
          window.location.href = '/';
        }
        return;
      }
    } catch (err: any) {
      setError(err.message || 'Erro ao entrar na conta.');
    } finally {
      setLoading(false);
    }
  }

  async function executeSignUp(e?: React.FormEvent) {
    if (e) e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const cleanUsername = username.trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
      const cleanEmail = email.trim().toLowerCase().replace(/^@+/, '');
      const cleanCode = inviteCode.trim().toUpperCase();

      const stillAvailable = await verifyUsernameUniqueness(cleanUsername);
      if (!stillAvailable) {
        setSignupStep(1);
        setUsernameStatus('taken');
        throw new Error(
          `O identificador @${cleanUsername} acabou de ser registrado por outro usuário. Escolha outro.`
        );
      }

      if (IS_CLOSED_BETA) {
        if (cleanCode.length < 14) {
          throw new Error('Digite o código completo no formato XXXX-XXXX-XXXX.');
        }

        const { data: invite, error: inviteErr } = await supabase
          .from('invite_codes')
          .select('*')
          .eq('code', cleanCode)
          .maybeSingle();

        if (inviteErr || !invite) {
          throw new Error('Código de convite inválido ou não encontrado.');
        }

        if (invite.uses_count >= invite.max_uses) {
          throw new Error('Este código de convite já atingiu o limite máximo de acessos.');
        }
      }

      const { error: signUpError } = await supabase.auth.signUp({
        email: cleanEmail,
        password,
        options: {
          data: {
            full_name: fullName.trim(),
            username: cleanUsername,
          },
        },
      });

      if (signUpError) {
        if (
          signUpError.message.toLowerCase().includes('duplicate') ||
          signUpError.message.toLowerCase().includes('unique')
        ) {
          throw new Error('Este @username ou e-mail já está vinculado a uma conta.');
        }
        throw signUpError;
      }

      if (IS_CLOSED_BETA && cleanCode) {
        const { data: invite } = await supabase
          .from('invite_codes')
          .select('id, uses_count')
          .eq('code', cleanCode)
          .maybeSingle();

        if (invite) {
          await supabase
            .from('invite_codes')
            .update({ uses_count: (invite.uses_count || 0) + 1 })
            .eq('id', invite.id);
        }
      }

      window.location.href = `/u/${encodeURIComponent(cleanUsername)}`;
    } catch (err: any) {
      setError(err.message || 'Não foi possível criar sua conta.');
    } finally {
      setLoading(false);
    }
  }

  const isDark = theme === 'dark';

  const labelClass = isDark
    ? 'block text-xs font-semibold text-zinc-300 mb-1'
    : 'block text-xs font-bold text-slate-700 mb-1';

  const inputClass = isDark
    ? 'w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-zinc-900/90 border border-zinc-800 text-xs sm:text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-[#3898ec]'
    : 'w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-300 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:bg-white focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/15 transition-all';

  return (
    <div
      onMouseMove={handleMouseMove}
      className={`relative min-h-screen w-full flex items-center justify-center p-4 sm:p-6 overflow-hidden transition-colors duration-300 ${
        isDark
          ? 'bg-[#07090e] text-zinc-100'
          : 'bg-gradient-to-br from-[#eef4fb] via-[#f8fafc] to-[#e2ecf8] text-slate-900'
      }`}
    >
      <style jsx global>{`
        @keyframes insightAsteriskOrbit3D {
          0% {
            transform: rotateX(22deg) rotateY(-28deg) rotateZ(0deg);
          }
          50% {
            transform: rotateX(-18deg) rotateY(32deg) rotateZ(180deg);
          }
          100% {
            transform: rotateX(22deg) rotateY(-28deg) rotateZ(360deg);
          }
        }
        @keyframes insightAsteriskFloatSlow {
          0%,
          100% {
            transform: translateY(0px) rotateX(28deg) rotateY(25deg) rotateZ(0deg);
          }
          50% {
            transform: translateY(-18px) rotateX(-20deg) rotateY(-30deg) rotateZ(180deg);
          }
        }
      `}</style>

      {/* PLANO DE FUNDO ARQUITETÔNICO + ESCULTURA 3D DO ASTERISCO (*) */}
      <div
        className="absolute inset-0 pointer-events-none overflow-hidden"
        style={{ perspective: '1200px' }}
      >
        <div
          style={{
            backgroundImage: isDark
              ? 'radial-gradient(rgba(56, 152, 236, 0.14) 1px, transparent 1px)'
              : 'radial-gradient(rgba(30, 64, 175, 0.14) 1.25px, transparent 1.25px)',
            backgroundSize: '28px 28px',
          }}
          className="absolute inset-0"
        />

        <div
          className={`absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[540px] h-[540px] rounded-full blur-[130px] ${
            isDark ? 'bg-[#2563eb]/20 opacity-90' : 'bg-[#3898ec]/20 opacity-70'
          }`}
        />

        <div
          style={{
            transform: `translate3d(calc(-50% + ${mouseTilt.x}px), calc(-50% + ${mouseTilt.y}px), 0) rotateX(${mouseTilt.y * 0.6}deg) rotateY(${mouseTilt.x * 0.6}deg)`,
            transformStyle: 'preserve-3d',
            transition: 'transform 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
            filter: isDark
              ? 'none'
              : 'drop-shadow(0 28px 45px rgba(18, 74, 133, 0.22))',
          }}
          className={`absolute left-1/2 top-1/2 ${
            isDark ? 'opacity-[0.22]' : 'opacity-[0.62]'
          }`}
        >
          <div
            style={{
              transformStyle: 'preserve-3d',
              animation: 'insightAsteriskOrbit3D 28s linear infinite',
            }}
          >
            <ExtrudedAsterisk3D
              theme={theme}
              size={600}
              depthLayers={28}
              layerSpacing={1.7}
            />
          </div>
        </div>

        <div
          style={{
            transformStyle: 'preserve-3d',
            animation: 'insightAsteriskFloatSlow 34s ease-in-out infinite',
            filter: isDark
              ? 'none'
              : 'drop-shadow(0 18px 28px rgba(18, 74, 133, 0.16))',
          }}
          className={`hidden lg:block absolute -top-10 -left-10 ${
            isDark ? 'opacity-[0.12] blur-[1px]' : 'opacity-[0.38]'
          }`}
        >
          <ExtrudedAsterisk3D
            theme={theme}
            size={250}
            depthLayers={18}
            layerSpacing={1.4}
          />
        </div>

        <div
          style={{
            transformStyle: 'preserve-3d',
            animation: 'insightAsteriskFloatSlow 40s ease-in-out infinite reverse',
            filter: isDark
              ? 'none'
              : 'drop-shadow(0 18px 28px rgba(18, 74, 133, 0.16))',
          }}
          className={`hidden lg:block absolute -bottom-14 -right-10 ${
            isDark ? 'opacity-[0.12] blur-[1.5px]' : 'opacity-[0.38]'
          }`}
        >
          <ExtrudedAsterisk3D
            theme={theme}
            size={290}
            depthLayers={18}
            layerSpacing={1.5}
          />
        </div>
      </div>

      {/* CARD CENTRAL */}
      <div
        className={`relative z-20 w-full max-w-md rounded-3xl p-6 sm:p-8 border backdrop-blur-xl transition-all duration-300 ${
          isDark
            ? 'bg-[#111318]/80 border-zinc-800/90 shadow-[0_24px_80px_rgba(0,0,0,0.65)]'
            : 'bg-white/95 border-slate-200/95 shadow-[0_28px_70px_-12px_rgba(15,23,42,0.18),0_0_0_1px_rgba(15,23,42,0.04)]'
        }`}
      >
        {mode === 'signup' && signupStep === 2 ? (
          <form onSubmit={executeSignUp} className="space-y-5">
            <button
              type="button"
              onClick={() => {
                setSignupStep(1);
                setError(null);
              }}
              className={`inline-flex items-center gap-1.5 text-xs font-bold transition-colors ${
                isDark
                  ? 'text-zinc-400 hover:text-white'
                  : 'text-slate-600 hover:text-slate-950'
              }`}
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Voltar aos dados da conta</span>
            </button>

            <div
              className={`p-4 rounded-2xl border space-y-2 ${
                isDark
                  ? 'bg-accent/10 border-accent/30'
                  : 'bg-blue-50/90 border-blue-200'
              }`}
            >
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-accent/15 text-accent text-[11px] font-bold">
                <Sparkles className="w-3 h-3" />
                <span>Acesso Antecipado · Beta Fechado</span>
              </div>
              <h2
                className={`text-lg font-extrabold ${
                  isDark ? 'text-white' : 'text-slate-900'
                }`}
              >
                Insira seu Código de Convite
              </h2>
              <p
                className={`text-xs leading-relaxed ${
                  isDark ? 'text-zinc-400' : 'text-slate-600'
                }`}
              >
                O Insight está em fase de abertura gradual para um grupo fechado de membros.
                Digite abaixo a sua chave de acesso para liberar seu perfil.
              </p>
            </div>

            {error && (
              <div className="p-3 rounded-xl bg-danger/10 border border-danger/30 text-danger text-xs font-semibold">
                {error}
              </div>
            )}

            <div>
              <label className={labelClass}>
                Chave de Convite (Padrão XXXX-XXXX-XXXX)
              </label>
              <div className="relative">
                <KeyRound className="w-4 h-4 text-accent absolute left-3.5 top-3" />
                <input
                  type="text"
                  required
                  value={inviteCode}
                  onChange={(e) => setInviteCode(formatInviteCode(e.target.value))}
                  placeholder="INSG-2026-BETA"
                  maxLength={14}
                  className={`${inputClass} font-mono font-bold tracking-widest uppercase`}
                />
              </div>
            </div>

            <div
              className={`p-3 rounded-xl border text-[11px] space-y-1 ${
                isDark
                  ? 'bg-zinc-900/70 border-zinc-800 text-zinc-400'
                  : 'bg-slate-100/90 border-slate-200 text-slate-600'
              }`}
            >
              <p className={`font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                Resumo da sua conta:
              </p>
              <p>
                Nome:{' '}
                <b className={isDark ? 'text-white' : 'text-slate-900'}>{fullName}</b> (@
                {username})
              </p>
              <p>
                E-mail vinculado:{' '}
                <b className={isDark ? 'text-white' : 'text-slate-900'}>{email}</b>
              </p>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 rounded-xl bg-[#2563eb] hover:bg-[#1d4ed8] disabled:opacity-50 text-white font-bold text-xs sm:text-sm transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-600/20"
            >
              <ShieldCheck className="w-4 h-4" />
              <span>
                {loading ? 'Liberando seu perfil...' : 'Confirmar Código e Criar Perfil'}
              </span>
            </button>
          </form>
        ) : (
          /* TELA 1: LOGIN E CADASTRO PADRÃO */
          <>
            <div className="text-center mb-6">
              <Link href="/" className="inline-flex items-center gap-0.5 mb-2 group">
                <span
                  className={`text-3xl font-extrabold tracking-tight ${
                    isDark ? 'text-white' : 'text-slate-900'
                  }`}
                >
                  Insight
                </span>
                <span className="text-3xl font-black text-[#2b8ce6] inline-block group-hover:rotate-90 transition-transform duration-500">
                  *
                </span>
              </Link>
              <h1
                className={`text-lg font-extrabold ${
                  isDark ? 'text-white' : 'text-slate-900'
                }`}
              >
                {mode === 'login'
                  ? 'Acesse sua conta'
                  : 'Crie seu perfil no Insight'}
              </h1>
              <p
                className={`text-xs mt-1 ${
                  isDark ? 'text-zinc-400' : 'text-slate-600'
                }`}
              >
                {mode === 'login'
                  ? 'Entre com seu e-mail e senha para publicar e interagir.'
                  : 'Personalize seu mural, crie tópicos e compartilhe ideias.'}
              </p>
            </div>

            <div
              className={`grid grid-cols-2 gap-1.5 p-1 rounded-xl border mb-6 ${
                isDark
                  ? 'bg-zinc-900/90 border-zinc-800'
                  : 'bg-slate-100 border-slate-200/90'
              }`}
            >
              <button
                type="button"
                onClick={() => {
                  setMode('login');
                  setSignupStep(1);
                  setError(null);
                }}
                className={`py-2 text-xs font-bold rounded-lg transition-all ${
                  mode === 'login'
                    ? 'bg-[#2563eb] text-white shadow-sm'
                    : isDark
                    ? 'text-zinc-400 hover:text-white'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Entrar
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode('signup');
                  setSignupStep(1);
                  setError(null);
                }}
                className={`py-2 text-xs font-bold rounded-lg transition-all ${
                  mode === 'signup'
                    ? 'bg-[#2563eb] text-white shadow-sm'
                    : isDark
                    ? 'text-zinc-400 hover:text-white'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Criar Conta
              </button>
            </div>

            {error && (
              <div className="mb-4 p-3 rounded-xl bg-danger/10 border border-danger/30 text-danger text-xs font-semibold">
                {error}
              </div>
            )}

            <form
              onSubmit={mode === 'login' ? handleLogin : handleNextStep}
              className="space-y-4"
            >
              {mode === 'signup' && (
                <>
                  <div>
                    <label className={labelClass}>Nome de Exibição</label>
                    <div className="relative">
                      <User
                        className={`w-4 h-4 absolute left-3.5 top-3 ${
                          isDark ? 'text-zinc-500' : 'text-slate-400'
                        }`}
                      />
                      <input
                        type="text"
                        required
                        placeholder="Como quer ser chamado"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        className={inputClass}
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className={labelClass.replace('mb-1', '')}>
                        Identificador Único (@username)
                      </label>

                      {usernameStatus === 'checking' && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-sky-400">
                          <Loader2 className="w-3 h-3 animate-spin" />
                          <span>Verificando...</span>
                        </span>
                      )}
                      {usernameStatus === 'available' && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-500">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Disponível</span>
                        </span>
                      )}
                      {usernameStatus === 'taken' && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-danger">
                          <XCircle className="w-3.5 h-3.5" />
                          <span>Já está em uso</span>
                        </span>
                      )}
                      {usernameStatus === 'invalid' && username.length > 0 && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-500">
                          <span>Mín. 3 caracteres válidos</span>
                        </span>
                      )}
                    </div>

                    <div className="relative">
                      <AtSign
                        className={`w-4 h-4 absolute left-3.5 top-3 ${
                          isDark ? 'text-zinc-500' : 'text-slate-400'
                        }`}
                      />
                      <input
                        type="text"
                        required
                        maxLength={24}
                        placeholder="seu_usuario"
                        value={username}
                        onChange={(e) =>
                          setUsername(
                            e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '')
                          )
                        }
                        className={`${inputClass} ${
                          usernameStatus === 'taken'
                            ? '!border-danger focus:!border-danger'
                            : usernameStatus === 'available'
                            ? '!border-emerald-500/70'
                            : ''
                        }`}
                      />
                    </div>
                  </div>
                </>
              )}

              <div>
                <label className={labelClass}>E-mail</label>
                <div className="relative">
                  <Mail
                    className={`w-4 h-4 absolute left-3.5 top-3 ${
                      isDark ? 'text-zinc-500' : 'text-slate-400'
                    }`}
                  />
                  <input
                    type={mode === 'login' ? 'text' : 'email'}
                    required
                    placeholder="voce@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className={inputClass}
                  />
                </div>
              </div>

              <div>
                <label className={labelClass}>Senha</label>
                <div className="relative">
                  <Lock
                    className={`w-4 h-4 absolute left-3.5 top-3 ${
                      isDark ? 'text-zinc-500' : 'text-slate-400'
                    }`}
                  />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    minLength={6}
                    placeholder="Mínimo de 6 caracteres"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className={`${inputClass} !pr-10`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    title={showPassword ? 'Ocultar senha' : 'Ver senha'}
                    aria-label={showPassword ? 'Ocultar senha' : 'Ver senha'}
                    className={`absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-lg transition-colors ${
                      isDark
                        ? 'text-zinc-400 hover:text-zinc-200'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    {showPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={
                  loading ||
                  (mode === 'signup' &&
                    (usernameStatus === 'taken' ||
                      usernameStatus === 'invalid' ||
                      usernameStatus === 'checking'))
                }
                className="w-full py-2.5 px-4 rounded-xl bg-[#2563eb] hover:bg-[#1d4ed8] disabled:opacity-50 text-white font-bold text-xs sm:text-sm transition-all flex items-center justify-center gap-2 shadow-md shadow-blue-600/20"
              >
                <span>
                  {loading
                    ? 'Verificando...'
                    : mode === 'login'
                    ? 'Entrar no Insight'
                    : IS_CLOSED_BETA
                    ? 'Continuar para Código Beta'
                    : 'Criar Conta e Ir ao Perfil'}
                </span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>

            <div
              className={`mt-6 pt-4 border-t text-center text-xs flex items-center justify-center gap-3 ${
                isDark
                  ? 'border-zinc-800 text-zinc-500'
                  : 'border-slate-200 text-slate-500 font-medium'
              }`}
            >
              <Link
                href="/"
                className={
                  isDark
                    ? 'hover:text-white transition-colors'
                    : 'hover:text-slate-900 transition-colors'
                }
              >
                Explorar Comunidade
              </Link>
              <span>•</span>
              <Link
                href="/termos"
                className={
                  isDark
                    ? 'hover:text-white transition-colors'
                    : 'hover:text-slate-900 transition-colors'
                }
              >
                Termos
              </Link>
              <span>•</span>
              <Link
                href="/privacidade"
                className={
                  isDark
                    ? 'hover:text-white transition-colors'
                    : 'hover:text-slate-900 transition-colors'
                }
              >
                Privacidade
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}