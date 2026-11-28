'use client';

import { ask as confirmDialog } from '@/lib/ui/feedback';
import { notify } from '@/lib/ui/feedback';
import { useEffect, useState, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Profile } from '@/types/database';
import {
  CONTRIBUTOR_TIERS,
  ContributorTier,
  amountToPoints,
  getContributorTier,
  getNextContributorTier,
  formatBRL,
} from '@/lib/contributorLevels';
import { getPixQrImageUrl } from '@/lib/pix';
import {
  Heart,
  Coffee,
  Server,
  Rocket,
  SlidersHorizontal,
  Copy,
  Check,
  Crown,
  Plus,
  X,
  ShieldCheck,
  Trash2,
  Award,
  Clock,
  CheckCircle2,
  Link2,
  Eye,
  Zap,
  Layers,
  Compass,
  Hexagon,
  Sparkles,
  QrCode,
  Loader2,
  RefreshCw,
} from 'lucide-react';

const FOUNDER_PROFILE_ID = '96d271a9-9102-49b1-b593-9279c5dfe3f4';

interface DonationRow {
  id: string;
  profile_id: string | null;
  donor_name: string | null;
  amount: number;
  message: string | null;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
}

interface AggregatedSupporter {
  key: string;
  profile: Profile | null;
  displayName: string;
  username: string | null;
  avatarUrl: string | null;
  totalAmount: number;
  totalPoints: number;
  donationsCount: number;
  lastMessage: string | null;
  donationIds: string[];
}

interface GeneratedPixCharge {
  donationId: string;
  paymentId: string;
  amount: number;
  qrCode: string;
  qrCodeBase64: string | null;
  expiresAt: string | null;
}

type PresetId = 'coffee' | 'server' | 'boost' | 'custom';

const DONATION_PRESETS: {
  id: PresetId;
  amount: number | null;
  title: string;
  subtitle: string;
  icon: typeof Coffee;
}[] = [
    {
      id: 'coffee',
      amount: 2,
      title: 'R$ 2',
      subtitle: 'Pagar um café',
      icon: Coffee,
    },
    {
      id: 'server',
      amount: 10,
      title: 'R$ 10',
      subtitle: 'Manter os servidores',
      icon: Server,
    },
    {
      id: 'boost',
      amount: 20,
      title: 'R$ 20',
      subtitle: 'Impulsione o Insight',
      icon: Rocket,
    },
    {
      id: 'custom',
      amount: null,
      title: 'Valor livre',
      subtitle: 'Defina sua contribuição',
      icon: SlidersHorizontal,
    },
  ];

function getTierIcon(level: number) {
  switch (level) {
    case 1:
      return Zap;
    case 2:
      return Hexagon;
    case 3:
      return Award;
    case 4:
      return Compass;
    case 5:
      return Sparkles;
    default:
      return Eye;
  }
}

function TierBadge({
  tier,
  compact = false,
}: {
  tier: ContributorTier;
  compact?: boolean;
}) {
  const Icon = getTierIcon(tier.level);

  return (
    <span
      style={{
        color: tier.color,
        backgroundColor: tier.badgeBg,
        borderColor: tier.badgeBorder,
        ['--tier-glow' as string]: tier.glowRgba,
      }}
      className={`relative overflow-hidden inline-flex items-center gap-1.5 rounded-full border font-mono font-bold tracking-tight select-none tier-badge-${tier.effect} ${compact ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-0.5 text-[11px]'
        }`}
    >
      <Icon className={compact ? 'w-2.5 h-2.5 shrink-0' : 'w-3 h-3 shrink-0'} />
      <span>LVL {tier.level}</span>
      {!compact && (
        <>
          <span className="opacity-40">·</span>
          <span>{tier.name}</span>
        </>
      )}
    </span>
  );
}

export default function ApoiePage() {
  const supabase = createClient();

  const [donations, setDonations] = useState<DonationRow[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loggedProfile, setLoggedProfile] = useState<Profile | null>(null);
  const [loggedEmail, setLoggedEmail] = useState<string>('');
  const [loading, setLoading] = useState(true);

  // Estado do seletor de valor e cobrança PIX dinâmica
  const [activePreset, setActivePreset] = useState<PresetId>('server');
  const [customAmountInput, setCustomAmountInput] = useState<string>('50');
  const [donorNameInput, setDonorNameInput] = useState<string>('');
  const [donorMessageInput, setDonorMessageInput] = useState<string>('');

  const [generatingPix, setGeneratingPix] = useState(false);
  const [pixError, setPixError] = useState<string | null>(null);
  const [activeCharge, setActiveCharge] = useState<GeneratedPixCharge | null>(null);
  const [chargeConfirmed, setChargeConfirmed] = useState(false);
  const [copiedPayload, setCopiedPayload] = useState(false);

  // Painel Admin para registrar doações retroativas/manuais
  const [showAdminForm, setShowAdminForm] = useState(false);
  const [selectedProfileId, setSelectedProfileId] = useState<string>('');
  const [externalDonorName, setExternalDonorName] = useState('');
  const [adminAmount, setAdminAmount] = useState('');
  const [adminMessage, setAdminMessage] = useState('');
  const [adminDate, setAdminDate] = useState('');
  const [savingDonation, setSavingDonation] = useState(false);

  // Vincular apoiador externo antigo a uma conta nova
  const [linkingSupporterKey, setLinkingSupporterKey] = useState<string | null>(null);
  const [linkTargetProfileId, setLinkTargetProfileId] = useState<string>('');

  const isAdmin =
    loggedProfile?.role === 'admin' ||
    loggedProfile?.id === FOUNDER_PROFILE_ID;

  const loadData = useCallback(async () => {
    setLoading(true);

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (session?.user) {
      setLoggedEmail(session.user.email || '');
      const { data: myProf } = await supabase
        .from('profiles')
        .select('*')
        .or(`user_id.eq.${session.user.id},id.eq.${session.user.id}`)
        .maybeSingle();

      setLoggedProfile((myProf as Profile) || null);
    } else {
      setLoggedEmail('');
      setLoggedProfile(null);
    }

    const [{ data: profilesData }, { data: donationsData }] = await Promise.all([
      supabase
        .from('profiles')
        .select('*')
        .order('username', { ascending: true }),
      supabase
        .from('donations')
        .select('*')
        .order('created_at', { ascending: false }),
    ]);

    if (profilesData) setProfiles(profilesData as Profile[]);
    if (donationsData) setDonations(donationsData as DonationRow[]);

    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Escuta em tempo real (Realtime + polling leve) quando existe um QR Code ativo aguardando pagamento
  useEffect(() => {
    if (!activeCharge || chargeConfirmed) return;

    const targetId = activeCharge.donationId;

    const handleApproved = () => {
      setChargeConfirmed(true);
      loadData();
    };

    const channel = supabase
      .channel(`donation-watch-${targetId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'donations',
          filter: `id=eq.${targetId}`,
        },
        (payload) => {
          if ((payload.new as any)?.status === 'approved') {
            handleApproved();
          }
        }
      )
      .subscribe();

 const interval = setInterval(async () => {
      try {
        const res = await fetch(
          `/api/donations/status?donationId=${encodeURIComponent(targetId)}`,
          { cache: 'no-store' }
        );
        const data = await res.json();
        if (data?.status === 'approved') {
          handleApproved();
        }
      } catch {
        // Ignora falha momentânea de rede
      }
    }, 3500);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, [activeCharge, chargeConfirmed, supabase, loadData]);

  const effectiveAmount = useMemo<number | null>(() => {
    if (activePreset !== 'custom') {
      const found = DONATION_PRESETS.find((p) => p.id === activePreset);
      return found?.amount ?? null;
    }
    const parsed = Number(customAmountInput.replace(',', '.'));
    return Number.isFinite(parsed) && parsed >= 1 ? parsed : null;
  }, [activePreset, customAmountInput]);

  const profilesById = useMemo(() => {
    const map: Record<string, Profile> = {};
    profiles.forEach((p) => {
      map[p.id] = p;
    });
    return map;
  }, [profiles]);

  const pendingDonations = useMemo(
    () => donations.filter((d) => d.status === 'pending'),
    [donations]
  );

  const supporters = useMemo<AggregatedSupporter[]>(() => {
    const approved = donations.filter((d) => d.status === 'approved');
    const map = new Map<string, AggregatedSupporter>();

    for (const d of approved) {
      const numericAmount = Number(d.amount) || 0;
      const prof = d.profile_id ? profilesById[d.profile_id] || null : null;
      const key = prof
        ? `profile:${prof.id}`
        : `ext:${(d.donor_name || 'Apoiador').trim().toLowerCase()}`;

      const existing = map.get(key);
      if (existing) {
        existing.totalAmount += numericAmount;
        existing.totalPoints = amountToPoints(existing.totalAmount);
        existing.donationsCount += 1;
        existing.donationIds.push(d.id);
        if (!existing.lastMessage && d.message) {
          existing.lastMessage = d.message;
        }
      } else {
        map.set(key, {
          key,
          profile: prof,
          displayName:
            prof?.display_name ||
            prof?.full_name ||
            d.donor_name?.trim() ||
            'Apoiador da Comunidade',
          username: prof?.username || null,
          avatarUrl: prof?.avatar_url || null,
          totalAmount: numericAmount,
          totalPoints: amountToPoints(numericAmount),
          donationsCount: 1,
          lastMessage: d.message || null,
          donationIds: [d.id],
        });
      }
    }

    return Array.from(map.values()).sort(
      (a, b) => b.totalAmount - a.totalAmount
    );
  }, [donations, profilesById]);

  const topSupporter = supporters[0] || null;
  const otherSupporters = supporters.slice(1);

  const myTotalAmount = useMemo(() => {
    if (!loggedProfile) return 0;
    const found = supporters.find((s) => s.profile?.id === loggedProfile.id);
    return found ? found.totalAmount : 0;
  }, [loggedProfile, supporters]);

  const myPoints = amountToPoints(myTotalAmount);
  const myTier = getContributorTier(myPoints);
  const myNextTier = getNextContributorTier(myPoints);

  const progressPercent = useMemo(() => {
    if (!myNextTier) return 100;
    const base = myTier.minPoints;
    const span = myNextTier.minPoints - base;
    if (span <= 0) return 100;
    return Math.min(100, Math.max(0, Math.round(((myPoints - base) / span) * 100)));
  }, [myPoints, myTier, myNextTier]);

  const pointsForSelected = effectiveAmount ? amountToPoints(effectiveAmount) : 0;
  const previewTierAfterDonation = getContributorTier(myPoints + pointsForSelected);

  async function handleGeneratePixCharge() {
    setPixError(null);

    if (!effectiveAmount || effectiveAmount < 1) {
      setPixError('Informe um valor mínimo de R$ 1,00.');
      return;
    }

    setGeneratingPix(true);
    setChargeConfirmed(false);

    try {
      const res = await fetch('/api/donations/pix', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: effectiveAmount,
          profileId: loggedProfile?.id || null,
          donorName: loggedProfile ? null : donorNameInput.trim() || null,
          message: donorMessageInput.trim() || null,
          email: loggedEmail || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error || 'Não foi possível gerar o QR Code PIX.');
      }

      setActiveCharge({
        donationId: data.donationId,
        paymentId: data.paymentId,
        amount: Number(data.amount),
        qrCode: data.qrCode,
        qrCodeBase64: data.qrCodeBase64,
        expiresAt: data.expiresAt,
      });
    } catch (err: any) {
      setPixError(err?.message || 'Erro ao conectar com o servidor PIX.');
    } finally {
      setGeneratingPix(false);
    }
  }

  async function handleCopyPayload() {
    if (!activeCharge?.qrCode) return;
    try {
      await navigator.clipboard.writeText(activeCharge.qrCode);
      setCopiedPayload(true);
      setTimeout(() => setCopiedPayload(false), 2200);
    } catch {
      notify(activeCharge.qrCode);
    }
  }

  async function handleModeratePending(
    donationId: string,
    nextStatus: 'approved' | 'rejected'
  ) {
    if (!isAdmin) return;
    if (nextStatus === 'rejected') {
      const { error } = await supabase
        .from('donations')
        .delete()
        .eq('id', donationId);
      if (!error) loadData();
      return;
    }

    const { error } = await supabase
      .from('donations')
      .update({ status: 'approved' })
      .eq('id', donationId);

    if (!error) loadData();
  }

  async function handleAddAdminDonation(e: React.FormEvent) {
    e.preventDefault();
    if (!isAdmin || savingDonation) return;

    const numeric = Number(adminAmount.replace(',', '.'));
    if (!numeric || numeric <= 0) {
      notify('Informe um valor válido maior que zero.');
      return;
    }

    if (!selectedProfileId && !externalDonorName.trim()) {
      notify('Selecione um membro cadastrado ou informe o nome do apoiador.');
      return;
    }

    setSavingDonation(true);
    const payload: Record<string, any> = {
      profile_id: selectedProfileId || null,
      donor_name: selectedProfileId ? null : externalDonorName.trim(),
      amount: numeric,
      message: adminMessage.trim() || null,
      status: 'approved',
      provider: 'manual',
    };

    if (adminDate) {
      payload.created_at = new Date(`${adminDate}T12:00:00`).toISOString();
    }

    const { error } = await supabase.from('donations').insert(payload);
    setSavingDonation(false);

    if (error) {
      notify('Erro ao registrar apoio: ' + error.message);
      return;
    }

    setSelectedProfileId('');
    setExternalDonorName('');
    setAdminAmount('');
    setAdminMessage('');
    setAdminDate('');
    setShowAdminForm(false);
    loadData();
  }

  async function handleLinkExternalDonations(donationIds: string[]) {
    if (!isAdmin || !linkTargetProfileId) return;
    const { error } = await supabase
      .from('donations')
      .update({ profile_id: linkTargetProfileId, donor_name: null })
      .in('id', donationIds);

    if (error) {
      notify('Erro ao vincular conta: ' + error.message);
      return;
    }

    setLinkingSupporterKey(null);
    setLinkTargetProfileId('');
    loadData();
  }

  async function handleDeleteSingleDonation(donationId: string) {
    if (!isAdmin) return;
    if (!(await confirmDialog({ message: 'Remover este registro de apoio? Os pontos e o nível serão recalculados.', danger: true }))) {
      return;
    }
    const { error } = await supabase.from('donations').delete().eq('id', donationId);
    if (!error) loadData();
  }

  function renderSupporterAvatar(
    supporter: AggregatedSupporter,
    tier: ContributorTier,
    isTop: boolean,
    sizeClass = 'w-10 h-10'
  ) {
    const ringColor = isTop ? '#dfb349' : tier.color;
    return (
      <div
        className={`relative shrink-0 rounded-full p-[2px] tier-avatar-${tier.effect}`}
        style={{
          background:
            tier.effect === 'singularity'
              ? 'conic-gradient(from 0deg, #b794f4, #38bdf8, #818cf8, #b794f4)'
              : isTop
                ? 'linear-gradient(135deg, #f3d27a, #b78628)'
                : tier.level > 0
                  ? `linear-gradient(135deg, ${ringColor}, ${tier.secondaryColor})`
                  : 'var(--border)',
        }}
      >
        {supporter.avatarUrl ? (
          <img
            src={supporter.avatarUrl}
            alt={supporter.displayName}
            className={`${sizeClass} rounded-full object-cover bg-background block`}
          />
        ) : (
          <div
            style={{ color: ringColor }}
            className={`${sizeClass} rounded-full bg-background flex items-center justify-center text-xs font-extrabold`}
          >
            {supporter.displayName.charAt(0).toUpperCase()}
          </div>
        )}
      </div>
    );
  }

  const qrImageSrc = activeCharge
    ? activeCharge.qrCodeBase64
      ? `data:image/png;base64,${activeCharge.qrCodeBase64}`
      : getPixQrImageUrl(activeCharge.qrCode, 220)
    : null;

  return (
    <div className="w-full min-h-screen bg-background">
      {/* EFEITOS SÓBRIOS POR NÍVEL */}
      <style jsx global>{`
        @keyframes insightTierSheen {
          0% {
            transform: translateX(-160%) skewX(-24deg);
          }
          50%,
          100% {
            transform: translateX(260%) skewX(-24deg);
          }
        }

        @keyframes insightTierPulse {
          0%,
          100% {
            box-shadow: 0 0 0 0 var(--tier-glow, rgba(56, 189, 248, 0.2));
          }
          50% {
            box-shadow: 0 0 18px 2px var(--tier-glow, rgba(56, 189, 248, 0.32));
          }
        }

        @keyframes insightRainbowShift {
          0% {
            background-position: 0% 50%;
          }
          50% {
            background-position: 100% 50%;
          }
          100% {
            background-position: 0% 50%;
          }
        }

        @keyframes insightPrismSpin {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }

        /* LVL 1 - CENTELHA: pulso cobre quente */
        .tier-badge-ember {
          animation: insightTierPulse 3.6s ease-in-out infinite;
        }
        .tier-badge-ember::after {
          content: '';
          position: absolute;
          inset: 0;
          width: 45%;
          background: linear-gradient(
            90deg,
            transparent,
            rgba(251, 146, 60, 0.35),
            transparent
          );
          animation: insightTierSheen 4.4s ease-in-out infinite;
          pointer-events: none;
        }

        /* LVL 2 - PRISMA: varredura metálica + refração prismática sutil */
        .tier-badge-prism {
          box-shadow: 0 0 12px rgba(125, 211, 252, 0.22);
        }
        .tier-badge-prism::after {
          content: '';
          position: absolute;
          inset: 0;
          width: 55%;
          background: linear-gradient(
            90deg,
            transparent,
            rgba(56, 189, 248, 0.25),
            rgba(255, 255, 255, 0.48),
            rgba(167, 139, 250, 0.25),
            transparent
          );
          animation: insightTierSheen 3.4s ease-in-out infinite;
          pointer-events: none;
        }

        /* LVL 3 - MECENAS: ouro escovado + brilho pulsante */
        .tier-badge-gold {
          animation: insightTierPulse 3s ease-in-out infinite;
        }
        .tier-badge-gold::after {
          content: '';
          position: absolute;
          inset: 0;
          width: 55%;
          background: linear-gradient(
            90deg,
            transparent,
            rgba(254, 240, 138, 0.5),
            transparent
          );
          animation: insightTierSheen 2.9s ease-in-out infinite;
          pointer-events: none;
        }

        /* LVL 4 - ARQUITETO: safira técnico com brilho azul */
        .tier-badge-sapphire {
          animation: insightTierPulse 2.6s ease-in-out infinite;
        }
        .tier-badge-sapphire::after {
          content: '';
          position: absolute;
          inset: 0;
          width: 55%;
          background: linear-gradient(
            90deg,
            transparent,
            rgba(125, 211, 252, 0.55),
            transparent
          );
          animation: insightTierSheen 2.5s ease-in-out infinite;
          pointer-events: none;
        }

        /* LVL 5 - SINGULARIDADE: espectro rainbow estilo Google */
        .tier-badge-singularity {
          color: #1e293b !important;
          border-color: transparent !important;
          background: linear-gradient(
            90deg,
            rgba(66, 133, 244, 0.24),
            rgba(234, 67, 53, 0.22),
            rgba(251, 188, 5, 0.26),
            rgba(52, 168, 83, 0.24),
            rgba(66, 133, 244, 0.24)
          );
          background-size: 260% 260%;
          animation: insightRainbowShift 4.5s ease infinite,
            insightTierPulse 2.8s ease-in-out infinite;
        }

        html[data-theme='dark'] .tier-badge-singularity {
          color: #f8fafc !important;
        }

        .tier-card-prism-sheen::after {
          content: '';
          position: absolute;
          inset: 0;
          width: 38%;
          background: linear-gradient(
            90deg,
            transparent,
            rgba(125, 211, 252, 0.14),
            rgba(255, 255, 255, 0.22),
            rgba(196, 181, 253, 0.14),
            transparent
          );
          animation: insightTierSheen 5.2s ease-in-out infinite;
          pointer-events: none;
        }

        .tier-card-gold-sheen::after {
          content: '';
          position: absolute;
          inset: 0;
          width: 42%;
          background: linear-gradient(
            90deg,
            transparent,
            rgba(250, 204, 21, 0.18),
            rgba(254, 249, 195, 0.26),
            transparent
          );
          animation: insightTierSheen 4.2s ease-in-out infinite;
          pointer-events: none;
        }

        .tier-card-sapphire {
          background-image: radial-gradient(
            rgba(14, 165, 233, 0.18) 1px,
            transparent 1px
          );
          background-size: 16px 16px;
        }
        .tier-card-sapphire::after {
          content: '';
          position: absolute;
          inset: 0;
          width: 45%;
          background: linear-gradient(
            90deg,
            transparent,
            rgba(56, 189, 248, 0.20),
            transparent
          );
          animation: insightTierSheen 3.6s ease-in-out infinite;
          pointer-events: none;
        }

        /* Borda rainbow animada do LVL 5 */
        .tier-card-rainbow-border::before {
          content: '';
          position: absolute;
          inset: -90%;
          background: conic-gradient(
            from 0deg,
            #4285f4,
            #ea4335,
            #fbbc05,
            #34a853,
            #9b72cb,
            #4285f4
          );
          animation: insightPrismSpin 7s linear infinite;
          pointer-events: none;
        }

        .tier-rainbow-text {
          background: linear-gradient(
            90deg,
            #4285f4,
            #ea4335,
            #d99b00,
            #2e9e4c,
            #8b5cf6,
            #4285f4
          );
          background-size: 220% auto;
          -webkit-background-clip: text;
          background-clip: text;
          color: transparent !important;
          animation: insightRainbowShift 5s linear infinite;
        }

        @media (prefers-reduced-motion: reduce) {
          .tier-badge-ember,
          .tier-badge-ember::after,
          .tier-badge-prism::after,
          .tier-badge-gold,
          .tier-badge-gold::after,
          .tier-badge-sapphire,
          .tier-badge-sapphire::after,
          .tier-badge-singularity,
          .tier-card-prism-sheen::after,
          .tier-card-gold-sheen::after,
          .tier-card-sapphire::after,
          .tier-card-rainbow-border::before,
          .tier-rainbow-text {
            animation: none !important;
          }
        }
      `}</style>

      {/* CABEÇALHO FIXO MINIMALISTA */}
      <header className="sticky top-0 z-30 bg-background/85 backdrop-blur-md border-b border-border px-4 sm:px-6 py-4 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-lg sm:text-xl font-extrabold tracking-tight text-primary flex items-center gap-2">
            <Heart className="w-4 h-4 text-accent" />
            <span>Apoie o Insight*</span>
          </h1>
          <p className="text-xs text-muted mt-0.5">
            Confirmação automática via PIX · R$ 1,00 = 1 ponto permanente
          </p>
        </div>

        {isAdmin && (
          <button
            type="button"
            onClick={() => setShowAdminForm((prev) => !prev)}
            className="px-3.5 py-1.5 rounded-full bg-surface border border-border hover:border-accent text-xs font-bold text-primary inline-flex items-center gap-1.5 transition-colors shrink-0"
          >
            {showAdminForm ? (
              <>
                <X className="w-3.5 h-3.5" />
                <span>Fechar</span>
              </>
            ) : (
              <>
                <Plus className="w-3.5 h-3.5 text-accent" />
                <span>Registrar apoio</span>
              </>
            )}
          </button>
        )}
      </header>

      {/* FAIXA ADMIN: COBRANÇAS PENDENTES */}
      {isAdmin && pendingDonations.length > 0 && (
        <section className="px-4 sm:px-6 py-4 border-b border-border bg-amber-500/[0.05] space-y-2.5">
          <div className="flex items-center gap-2 text-xs font-bold text-amber-400">
            <Clock className="w-4 h-4 shrink-0" />
            <span>
              {pendingDonations.length}{' '}
              {pendingDonations.length === 1
                ? 'PIX aguardando pagamento'
                : 'PIX aguardando pagamento'}
            </span>
          </div>

          <div className="divide-y divide-border/70 border border-border rounded-xl bg-surface overflow-hidden">
            {pendingDonations.map((pd) => {
              const prof = pd.profile_id ? profilesById[pd.profile_id] : null;
              const name =
                prof?.display_name ||
                prof?.full_name ||
                pd.donor_name ||
                'Visitante';

              return (
                <div
                  key={pd.id}
                  className="px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs"
                >
                  <div className="min-w-0">
                    <span className="font-bold text-primary">{name}</span>
                    {prof?.username && (
                      <span className="text-muted ml-1">@{prof.username}</span>
                    )}
                    <span className="mx-1.5 text-muted">·</span>
                    <span className="font-mono font-bold text-accent">
                      {formatBRL(Number(pd.amount))} (+{amountToPoints(Number(pd.amount))} pts)
                    </span>
                    {pd.message && (
                      <p className="text-[11px] text-secondary mt-0.5 truncate">
                        &ldquo;{pd.message}&rdquo;
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleModeratePending(pd.id, 'approved')}
                      className="px-2.5 py-1 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/25 font-bold text-[11px] transition-colors"
                    >
                      Aprovar manual
                    </button>
                    <button
                      type="button"
                      onClick={() => handleModeratePending(pd.id, 'rejected')}
                      className="px-2.5 py-1 rounded-lg bg-elevated border border-border text-muted hover:text-danger font-semibold text-[11px] transition-colors"
                    >
                      Descartar
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* FORMULÁRIO ADMIN: REGISTRAR APOIO ANTERIOR / MANUAL */}
      {isAdmin && showAdminForm && (
        <section className="px-4 sm:px-6 py-5 border-b border-border bg-surface/40">
          <form onSubmit={handleAddAdminDonation} className="space-y-3 max-w-xl">
            <div>
              <p className="text-xs font-bold text-primary uppercase tracking-wider">
                Registrar apoio anterior ou manual
              </p>
              <p className="text-[11px] text-muted mt-0.5">
                Credita automaticamente os pontos (R$ 1 = 1 pt) e eleva a patente do apoiador.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-secondary mb-1">
                  Membro cadastrado
                </label>
                <select
                  value={selectedProfileId}
                  onChange={(e) => {
                    setSelectedProfileId(e.target.value);
                    if (e.target.value) setExternalDonorName('');
                  }}
                  className="w-full h-9 px-3 rounded-xl bg-background border border-border text-xs text-primary focus:outline-none focus:border-accent"
                >
                  <option value="">Sem conta vinculada (externo)</option>
                  {profiles.map((p) => (
                    <option key={p.id} value={p.id}>
                      @{p.username} ({p.display_name || p.full_name})
                    </option>
                  ))}
                </select>
              </div>

              {!selectedProfileId && (
                <div>
                  <label className="block text-[11px] font-semibold text-secondary mb-1">
                    Nome do apoiador
                  </label>
                  <input
                    type="text"
                    value={externalDonorName}
                    onChange={(e) => setExternalDonorName(e.target.value)}
                    placeholder="Ex: Nome do apoiador"
                    className="w-full h-9 px-3 rounded-xl bg-background border border-border text-xs text-primary focus:outline-none focus:border-accent"
                  />
                </div>
              )}

              <div>
                <label className="block text-[11px] font-semibold text-secondary mb-1">
                  Valor (R$)
                </label>
                <input
                  type="text"
                  required
                  value={adminAmount}
                  onChange={(e) => setAdminAmount(e.target.value)}
                  placeholder="Ex: 50"
                  className="w-full h-9 px-3 rounded-xl bg-background border border-border text-xs text-primary focus:outline-none focus:border-accent"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-secondary mb-1">
                  Data do apoio (opcional)
                </label>
                <input
                  type="date"
                  value={adminDate}
                  onChange={(e) => setAdminDate(e.target.value)}
                  className="w-full h-9 px-3 rounded-xl bg-background border border-border text-xs text-primary focus:outline-none focus:border-accent"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-[11px] font-semibold text-secondary mb-1">
                  Nota de agradecimento (opcional)
                </label>
                <input
                  type="text"
                  value={adminMessage}
                  onChange={(e) => setAdminMessage(e.target.value)}
                  placeholder="Ex: Obrigado por impulsionar o projeto desde o início."
                  className="w-full h-9 px-3 rounded-xl bg-background border border-border text-xs text-primary focus:outline-none focus:border-accent"
                />
              </div>
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={savingDonation}
                className="px-4 py-2 rounded-full bg-accent hover:bg-accent-hover text-white text-xs font-bold disabled:opacity-50 transition-colors"
              >
                {savingDonation ? 'Salvando...' : 'Confirmar e creditar pontos'}
              </button>
            </div>
          </form>
        </section>
      )}

      {/* ====================================================================
          1. SEÇÃO SUPERIOR: DOAÇÃO COM PIX AUTOMÁTICO + WEBHOOK TEMPO REAL
          ==================================================================== */}
      <section className="relative px-4 sm:px-6 py-7 border-b border-border overflow-hidden">
        <div
          aria-hidden="true"
          style={{
            background:
              'radial-gradient(600px circle at 15% 0%, rgba(37, 99, 235, 0.08), transparent 65%)',
          }}
          className="pointer-events-none absolute inset-0"
        />

        <div className="relative space-y-6">
          <div className="space-y-2 max-w-2xl">
            <span className="inline-flex items-center gap-1.5 text-[10px] font-mono font-bold uppercase tracking-[0.16em] text-accent">
              <Layers className="w-3 h-3" />
              <span>Apoio Direto à Infraestrutura</span>
            </span>
            <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight text-primary leading-snug">
              Sustente um espaço independente de ideias.
            </h2>
            <p className="text-xs sm:text-sm text-secondary leading-relaxed">
              Sem anúncios invasivos nem algoritmos pagos. Cada contribuição custeia
              domínio, servidores e armazenamento — e credita{' '}
              <strong className="text-primary">1 ponto por real</strong>{' '}
              automaticamente assim que o PIX é compensado.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
            {/* Coluna Esquerda: Presets + Mensagem + Gerador */}
            <div className="lg:col-span-7 flex flex-col justify-between gap-4">
              <div className="space-y-3.5">
                <div className="grid grid-cols-2 gap-2.5">
                  {DONATION_PRESETS.map((preset) => {
                    const Icon = preset.icon;
                    const isSelected = activePreset === preset.id;

                    return (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => {
                          setActivePreset(preset.id);
                          setActiveCharge(null);
                          setChargeConfirmed(false);
                          setPixError(null);
                        }}
                        className={`relative p-4 rounded-2xl border text-left transition-all duration-150 group ${isSelected
                          ? 'bg-surface border-accent shadow-[0_0_0_1px_var(--accent)]'
                          : 'bg-surface/40 border-border hover:bg-surface hover:border-muted/60'
                          }`}
                      >
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <span className="text-base font-extrabold font-mono tracking-tight text-primary">
                            {preset.title}
                          </span>
                          <div
                            className={`w-7 h-7 rounded-lg border flex items-center justify-center transition-colors ${isSelected
                              ? 'bg-accent/15 border-accent/40 text-accent'
                              : 'bg-background/60 border-border text-muted group-hover:text-primary'
                              }`}
                          >
                            <Icon className="w-3.5 h-3.5" />
                          </div>
                        </div>

                        <p className="text-xs font-medium text-secondary">
                          {preset.subtitle}
                        </p>

                        <p className="text-[10px] font-mono text-muted mt-1">
                          {preset.amount !== null
                            ? `+${preset.amount} pontos`
                            : '1 ponto por real'}
                        </p>
                      </button>
                    );
                  })}
                </div>

                {/* Input de Valor Livre */}
                {activePreset === 'custom' && (
                  <div className="p-3.5 rounded-2xl bg-surface border border-border flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                    <label className="text-xs font-semibold text-secondary">
                      Valor em reais (mínimo R$ 1,00)
                    </label>
                    <div className="relative w-full sm:w-44">
                      <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-mono font-bold text-muted">
                        R$
                      </span>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={customAmountInput}
                        onChange={(e) => {
                          setCustomAmountInput(e.target.value.replace(/[^0-9.,]/g, ''));
                          setActiveCharge(null);
                          setChargeConfirmed(false);
                        }}
                        placeholder="50,00"
                        className="w-full h-9 pl-10 pr-3 rounded-xl bg-background border border-border text-sm font-mono font-bold text-primary focus:outline-none focus:border-accent"
                      />
                    </div>
                  </div>
                )}

                {/* Nome (se visitante) + Mensagem opcional para o Mural */}
                <div className="space-y-2.5">
                  {!loggedProfile && (
                    <input
                      type="text"
                      value={donorNameInput}
                      onChange={(e) => setDonorNameInput(e.target.value)}
                      maxLength={60}
                      placeholder="Seu nome para o mural (ou entre na conta para somar pontos)"
                      className="w-full h-9 px-3.5 rounded-xl bg-surface border border-border text-xs text-primary placeholder:text-muted focus:outline-none focus:border-accent"
                    />
                  )}

                  <input
                    type="text"
                    value={donorMessageInput}
                    onChange={(e) => setDonorMessageInput(e.target.value)}
                    maxLength={140}
                    placeholder="Mensagem opcional para exibir junto ao seu agradecimento..."
                    className="w-full h-9 px-3.5 rounded-xl bg-surface border border-border text-xs text-primary placeholder:text-muted focus:outline-none focus:border-accent"
                  />
                </div>

                {/* Prévia de Pontos & Patente Resultante */}
                <div className="px-4 py-3 rounded-2xl bg-surface/50 border border-border flex flex-wrap items-center justify-between gap-2.5">
                  <div className="text-xs text-secondary">
                    {effectiveAmount ? (
                      <span>
                        Soma{' '}
                        <strong className="font-mono text-primary">
                          +{pointsForSelected}{' '}
                          {pointsForSelected === 1 ? 'ponto' : 'pontos'}
                        </strong>
                        {loggedProfile ? ` em @${loggedProfile.username}` : ' ao mural'}
                      </span>
                    ) : (
                      <span>Informe um valor a partir de R$ 1,00</span>
                    )}
                  </div>

                  {effectiveAmount && (
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-muted">Patente:</span>
                      <TierBadge tier={previewTierAfterDonation} />
                    </div>
                  )}
                </div>
              </div>

              {pixError && (
                <div className="p-3 rounded-xl bg-danger/10 border border-danger/30 text-danger text-xs font-semibold">
                  {pixError}
                </div>
              )}

              {/* Botão Principal */}
              <div className="flex flex-wrap items-center gap-2.5 pt-1">
                <button
                  type="button"
                  disabled={generatingPix || !effectiveAmount}
                  onClick={handleGeneratePixCharge}
                  className="px-5 py-2.5 rounded-full bg-accent hover:bg-accent-hover disabled:opacity-50 text-white text-xs font-bold inline-flex items-center gap-2 transition-all shadow-sm"
                >
                  {generatingPix ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Gerando QR Code PIX...</span>
                    </>
                  ) : activeCharge ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>Atualizar QR Code ({formatBRL(effectiveAmount || 0)})</span>
                    </>
                  ) : (
                    <>
                      <QrCode className="w-3.5 h-3.5" />
                      <span>
                        Gerar QR Code PIX{' '}
                        {effectiveAmount ? `(${formatBRL(effectiveAmount)})` : ''}
                      </span>
                    </>
                  )}
                </button>

                {!loggedProfile && (
                  <Link
                    href="/login"
                    className="text-xs font-semibold text-secondary hover:text-primary transition-colors"
                  >
                    Entrar para acumular pontos na sua conta →
                  </Link>
                )}
              </div>
            </div>

            {/* Coluna Direita: Cartão QR Code Dinâmico & Status ao Vivo */}
            <div className="lg:col-span-5 rounded-2xl bg-surface/70 border border-border p-5 flex flex-col items-center justify-between text-center gap-4">
              {chargeConfirmed && activeCharge ? (
                <div className="my-auto py-4 space-y-3">
                  <div className="w-12 h-12 rounded-full bg-emerald-500/15 border border-emerald-500/35 text-emerald-400 flex items-center justify-center mx-auto">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-extrabold text-primary">
                      Apoio confirmado
                    </p>
                    <p className="text-xs text-secondary leading-relaxed">
                      Recebemos{' '}
                      <strong className="font-mono text-primary">
                        {formatBRL(activeCharge.amount)}
                      </strong>
                      . +{amountToPoints(activeCharge.amount)} pontos já foram
                      creditados no mural.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveCharge(null);
                      setChargeConfirmed(false);
                    }}
                    className="px-4 py-1.5 rounded-full bg-surface border border-border hover:border-accent text-xs font-bold text-primary transition-colors"
                  >
                    Fazer outro apoio
                  </button>
                </div>
              ) : activeCharge && qrImageSrc ? (
                <>
                  <div className="w-full flex items-center justify-between text-[10px] font-mono uppercase tracking-widest text-muted">
                    <span className="inline-flex items-center gap-1.5 text-amber-400">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                      <span>Aguardando pagamento</span>
                    </span>
                    <span>+{amountToPoints(activeCharge.amount)} pts</span>
                  </div>

                  <div className="relative p-3">
                    <span className="w-3 h-3 border-t-2 border-l-2 border-accent/70 absolute top-0 left-0 rounded-tl-sm" />
                    <span className="w-3 h-3 border-t-2 border-r-2 border-accent/70 absolute top-0 right-0 rounded-tr-sm" />
                    <span className="w-3 h-3 border-b-2 border-l-2 border-accent/70 absolute bottom-0 left-0 rounded-bl-sm" />
                    <span className="w-3 h-3 border-b-2 border-r-2 border-accent/70 absolute bottom-0 right-0 rounded-br-sm" />

                    <div className="p-2 rounded-xl bg-white shadow-sm">
                      <img
                        src={qrImageSrc}
                        alt="QR Code PIX oficial"
                        width={176}
                        height={176}
                        className="w-[176px] h-[176px] block"
                      />
                    </div>
                  </div>

                  <div className="w-full space-y-2 pt-2 border-t border-border/70">
                    <p className="text-base font-extrabold font-mono text-primary">
                      {formatBRL(activeCharge.amount)}
                    </p>

                    <button
                      type="button"
                      onClick={handleCopyPayload}
                      className={`w-full py-2 px-3 rounded-xl text-xs font-bold inline-flex items-center justify-center gap-1.5 transition-colors ${copiedPayload
                        ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                        : 'bg-primary text-background hover:opacity-90'
                        }`}
                    >
                      {copiedPayload ? (
                        <>
                          <Check className="w-3.5 h-3.5" />
                          <span>PIX Copia e Cola copiado</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>Copiar PIX Copia e Cola</span>
                        </>
                      )}
                    </button>

                    <p className="text-[10px] text-muted">
                      Esta tela atualiza automaticamente assim que o PIX for pago.
                    </p>
                  </div>
                </>
              ) : (
                <div className="my-auto py-6 px-3 space-y-3">
                  <div className="w-12 h-12 rounded-2xl bg-background border border-border flex items-center justify-center mx-auto text-muted">
                    <QrCode className="w-6 h-6" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs font-bold text-primary">
                      QR Code PIX instantâneo
                    </p>
                    <p className="text-[11px] text-muted leading-relaxed max-w-[230px] mx-auto">
                      Selecione um valor ao lado e clique em{' '}
                      <strong className="text-secondary">Gerar QR Code PIX</strong>{' '}
                      para criar sua cobrança com baixa automática.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Painel Pessoal de Patente do Usuário Logado */}
          {loggedProfile && (
            <div className="p-4 rounded-2xl bg-surface/60 border border-border flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-semibold text-secondary">
                    Sua patente atual
                  </span>
                  <TierBadge tier={myTier} />
                  <span className="text-xs font-mono font-bold text-primary">
                    {myPoints} {myPoints === 1 ? 'pt' : 'pts'}
                  </span>
                </div>
                <p className="text-xs text-muted">
                  {myNextTier
                    ? `Faltam ${Math.max(
                      0,
                      myNextTier.minPoints - myPoints
                    )} pontos (${formatBRL(
                      Math.max(0, myNextTier.minPoints - myPoints)
                    )}) para alcançar ${myNextTier.name} (LVL ${myNextTier.level}).`
                    : 'Você alcançou Singularidade, a patente máxima de contribuinte.'}
                </p>
              </div>

              <div className="w-full sm:w-52 space-y-1.5 shrink-0">
                <div className="w-full h-1.5 rounded-full bg-elevated overflow-hidden">
                  <div
                    style={{
                      width: `${progressPercent}%`,
                      background:
                        myTier.level === 5
                          ? 'linear-gradient(90deg, #b794f4, #38bdf8)'
                          : myTier.level > 0
                            ? myTier.color
                            : 'var(--accent)',
                    }}
                    className="h-full transition-all duration-500"
                  />
                </div>
                <div className="flex justify-between text-[10px] font-mono text-muted">
                  <span>{myTier.name}</span>
                  <span>{myNextTier ? myNextTier.name : 'Patente Máxima'}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ====================================================================
          2. MURAL DE AGRADECIMENTOS & MAIORES DOADORES
          ==================================================================== */}
      <section className="border-b border-border">
        <div className="px-4 sm:px-6 py-5 flex items-end justify-between gap-3 border-b border-border/60">
          <div>
            <span className="text-[10px] font-mono font-bold uppercase tracking-[0.16em] text-muted block mb-1">
              Reconhecimento
            </span>
            <h2 className="text-base sm:text-lg font-extrabold tracking-tight text-primary">
              Mural de Agradecimentos
            </h2>
            <p className="text-xs text-muted mt-0.5">
              Pessoas que tornam o Insight* possível, ordenadas por contribuição acumulada
            </p>
          </div>
          <span className="text-[11px] font-mono text-muted shrink-0">
            {supporters.length}{' '}
            {supporters.length === 1 ? 'apoiador' : 'apoiadores'}
          </span>
        </div>

        {loading ? (
          <div className="py-14 text-center text-xs text-muted font-mono">
            Carregando mural...
          </div>
        ) : !topSupporter ? (
          <div className="py-16 px-6 text-center space-y-2">
            <Award className="w-6 h-6 text-muted mx-auto" />
            <p className="text-sm font-bold text-primary">
              O mural aguarda o primeiro apoiador
            </p>
            <p className="text-xs text-muted max-w-sm mx-auto">
              Qualquer contribuição a partir de R$ 1,00 registra seu nome aqui e
              desbloqueia a patente Centelha (LVL 1).
            </p>
          </div>
        ) : (
          <div>
            {/* DESTAQUE #1: MAIOR APOIADOR */}
            {(() => {
              const topTier = getContributorTier(topSupporter.totalPoints);
              const topGold = '#dfb349';
              const profileHref = topSupporter.username
                ? `/u/${encodeURIComponent(topSupporter.username)}`
                : null;
              const isLinkingTop = linkingSupporterKey === topSupporter.key;

              const TopCardBody = (
                <div className="relative p-5 sm:p-6 overflow-hidden">
                  <div
                    aria-hidden="true"
                    style={{
                      background:
                        'radial-gradient(480px circle at 0% 50%, rgba(223, 179, 73, 0.11), transparent 70%)',
                    }}
                    className="pointer-events-none absolute inset-0"
                  />

                  <div className="relative space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span
                        style={{
                          color: topGold,
                          backgroundColor: 'rgba(223, 179, 73, 0.12)',
                          borderColor: 'rgba(223, 179, 73, 0.35)',
                        }}
                        className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border text-[10px] font-mono font-bold uppercase tracking-wider"
                      >
                        <Crown className="w-3 h-3" />
                        <span>Maior Apoiador · #1</span>
                      </span>

                      <div className="flex items-center gap-2">
                        <span
                          style={{ color: topGold }}
                          className="text-sm font-mono font-extrabold"
                        >
                          {formatBRL(topSupporter.totalAmount)}
                        </span>
                        <span className="text-[11px] font-mono text-muted">
                          ({topSupporter.totalPoints} pts)
                        </span>

                        {isAdmin && !topSupporter.profile && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setLinkingSupporterKey(
                                isLinkingTop ? null : topSupporter.key
                              );
                              setLinkTargetProfileId('');
                            }}
                            title="Vincular a uma conta cadastrada"
                            className="p-1 rounded-lg text-muted hover:text-accent hover:bg-elevated transition-colors"
                          >
                            <Link2 className="w-3.5 h-3.5" />
                          </button>
                        )}

                        {isAdmin && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              handleDeleteSingleDonation(topSupporter.donationIds[0]);
                            }}
                            title="Remover último registro"
                            className="p-1 rounded-lg text-muted hover:text-danger hover:bg-elevated transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="flex items-start gap-3.5">
                      {renderSupporterAvatar(topSupporter, topTier, true, 'w-12 h-12')}

                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            style={{ color: topGold }}
                            className="text-base font-extrabold truncate"
                          >
                            {topSupporter.displayName}
                          </span>
                          {topSupporter.username && (
                            <ShieldCheck className="w-3.5 h-3.5 text-[#00ccff] shrink-0" />
                          )}
                          <TierBadge tier={topTier} />
                        </div>

                        {topSupporter.username && (
                          <p className="text-xs text-muted">
                            @{topSupporter.username}
                          </p>
                        )}

                        <p className="text-xs sm:text-sm text-secondary leading-relaxed pt-1">
                          {topSupporter.lastMessage ||
                            'Obrigado por liderar o apoio e manter o Insight* em evolução constante.'}
                        </p>
                      </div>
                    </div>

                    {isAdmin && isLinkingTop && (
                      <div
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                        }}
                        className="p-2.5 rounded-xl bg-surface border border-border flex flex-wrap items-center gap-2"
                      >
                        <select
                          value={linkTargetProfileId}
                          onChange={(e) => setLinkTargetProfileId(e.target.value)}
                          className="flex-1 min-w-[180px] h-8 px-2.5 rounded-lg bg-background border border-border text-xs text-primary"
                        >
                          <option value="">Selecionar conta para vincular...</option>
                          {profiles.map((p) => (
                            <option key={p.id} value={p.id}>
                              @{p.username} ({p.display_name || p.full_name})
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          disabled={!linkTargetProfileId}
                          onClick={() =>
                            handleLinkExternalDonations(topSupporter.donationIds)
                          }
                          className="px-3 py-1.5 rounded-lg bg-accent text-white text-[11px] font-bold disabled:opacity-50"
                        >
                          Vincular pontos
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );

              return (
                <div
                  style={{ borderLeft: `3px solid ${topGold}` }}
                  className="border-b border-border bg-surface/25 hover:bg-surface/45 transition-colors"
                >
                  {profileHref ? (
                    <Link href={profileHref} className="block">
                      {TopCardBody}
                    </Link>
                  ) : (
                    TopCardBody
                  )}
                </div>
              );
            })()}

            {/* DEMAIS APOIADORES */}
            {otherSupporters.length > 0 && (
              <div className="divide-y divide-border">
                {otherSupporters.map((supporter, idx) => {
                  const rank = idx + 2;
                  const tier = getContributorTier(supporter.totalPoints);
                  const profileHref = supporter.username
                    ? `/u/${encodeURIComponent(supporter.username)}`
                    : null;
                  const isLinkingThis = linkingSupporterKey === supporter.key;

                  const RowBody = (
                    <div className="space-y-2.5 w-full">
                      <div className="flex items-start justify-between gap-3 w-full">
                        <div className="flex items-start gap-3 min-w-0">
                          <span className="w-5 pt-2.5 text-center text-[11px] font-mono text-muted shrink-0">
                            {String(rank).padStart(2, '0')}
                          </span>

                          {renderSupporterAvatar(supporter, tier, false)}

                          <div className="min-w-0 space-y-1">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span
                                style={
                                  tier.level >= 3 ? { color: tier.color } : undefined
                                }
                                className="text-sm font-extrabold text-primary truncate"
                              >
                                {supporter.displayName}
                              </span>

                              {supporter.username && (
                                <ShieldCheck className="w-3.5 h-3.5 text-[#00ccff] shrink-0" />
                              )}

                              <TierBadge tier={tier} />
                            </div>

                            <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted">
                              {supporter.username && (
                                <>
                                  <span>@{supporter.username}</span>
                                  <span>·</span>
                                </>
                              )}
                              <span className="font-mono text-secondary">
                                {supporter.totalPoints}{' '}
                                {supporter.totalPoints === 1 ? 'pt' : 'pts'}
                              </span>
                              {supporter.donationsCount > 1 && (
                                <>
                                  <span>·</span>
                                  <span>{supporter.donationsCount} apoios</span>
                                </>
                              )}
                            </div>

                            <p className="text-xs text-secondary leading-relaxed">
                              {supporter.lastMessage ||
                                'Obrigado por fortalecer a comunidade do Insight*.'}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0 pt-1">
                          <span className="text-xs font-mono font-bold text-primary">
                            {formatBRL(supporter.totalAmount)}
                          </span>

                          {isAdmin && !supporter.profile && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setLinkingSupporterKey(
                                  isLinkingThis ? null : supporter.key
                                );
                                setLinkTargetProfileId('');
                              }}
                              title="Vincular a uma conta cadastrada"
                              className="p-1 rounded-lg text-muted hover:text-accent hover:bg-elevated transition-colors"
                            >
                              <Link2 className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {isAdmin && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                handleDeleteSingleDonation(supporter.donationIds[0]);
                              }}
                              title="Remover último registro"
                              className="p-1 rounded-lg text-muted hover:text-danger hover:bg-elevated transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>

                      {isAdmin && isLinkingThis && (
                        <div
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                          }}
                          className="ml-8 p-2.5 rounded-xl bg-surface border border-border flex flex-wrap items-center gap-2"
                        >
                          <select
                            value={linkTargetProfileId}
                            onChange={(e) => setLinkTargetProfileId(e.target.value)}
                            className="flex-1 min-w-[180px] h-8 px-2.5 rounded-lg bg-background border border-border text-xs text-primary"
                          >
                            <option value="">Selecionar conta para vincular...</option>
                            {profiles.map((p) => (
                              <option key={p.id} value={p.id}>
                                @{p.username} ({p.display_name || p.full_name})
                              </option>
                            ))}
                          </select>
                          <button
                            type="button"
                            disabled={!linkTargetProfileId}
                            onClick={() =>
                              handleLinkExternalDonations(supporter.donationIds)
                            }
                            className="px-3 py-1.5 rounded-lg bg-accent text-white text-[11px] font-bold disabled:opacity-50"
                          >
                            Vincular pontos
                          </button>
                        </div>
                      )}
                    </div>
                  );

                  const rowClass =
                    'px-4 sm:px-6 py-4 block hover:bg-surface/40 transition-colors';

                  return profileHref ? (
                    <Link
                      key={supporter.key}
                      href={profileHref}
                      style={{
                        borderLeft: `2px solid ${tier.level >= 2 ? tier.badgeBorder : 'transparent'
                          }`,
                      }}
                      className={rowClass}
                    >
                      {RowBody}
                    </Link>
                  ) : (
                    <div
                      key={supporter.key}
                      style={{
                        borderLeft: `2px solid ${tier.level >= 2 ? tier.badgeBorder : 'transparent'
                          }`,
                      }}
                      className={rowClass}
                    >
                      {RowBody}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </section>

      {/* ====================================================================
   {/* ====================================================================
          3. PROGRESSÃO DE PATENTES DE CONTRIBUINTE (ESCALA DE EFEITOS)
          ==================================================================== */}
      <section className="px-4 sm:px-6 py-7 space-y-5">
        <div>
          <span className="text-[10px] font-mono font-bold uppercase tracking-[0.16em] text-muted block mb-1">
            Sistema Cumulativo
          </span>
          <h2 className="text-base sm:text-lg font-extrabold tracking-tight text-primary">
            Progressão de Patentes
          </h2>
          <p className="text-xs text-muted mt-0.5">
            Cada nível adiciona mais presença visual e acabamento. Cada R$ 1,00 soma 1 ponto permanente.
          </p>
        </div>

        <div className="space-y-3">
          {CONTRIBUTOR_TIERS.map((tier) => {
            const isCurrent = loggedProfile ? myTier.level === tier.level : false;
            const isUnlocked = loggedProfile ? myTier.level >= tier.level : false;
            const isRainbow = tier.effect === 'singularity';

            const extraCardClass =
              tier.level === 1
                ? 'bg-surface/50'
                : tier.level === 2
                  ? 'bg-surface/60 tier-card-prism-sheen'
                  : tier.level === 3
                    ? 'bg-surface/60 tier-card-gold-sheen'
                    : tier.level === 4
                      ? 'bg-surface/50 tier-card-sapphire'
                      : tier.level === 5
                        ? 'bg-background border-transparent'
                        : 'bg-surface/35';

            const innerCard = (
              <div
                style={{
                  borderColor: isRainbow
                    ? 'transparent'
                    : isCurrent
                      ? tier.color
                      : tier.level > 0
                        ? tier.badgeBorder
                        : undefined,
                  ['--tier-glow' as string]: tier.glowRgba,
                }}
                className={`relative rounded-2xl border px-4 sm:px-5 py-4 transition-all overflow-hidden ${extraCardClass}`}
              >
                {/* Camada rainbow suave de fundo no LVL 5 */}
                {isRainbow && (
                  <div
                    aria-hidden="true"
                    style={{
                      background:
                        'linear-gradient(115deg, rgba(66,133,244,0.12), rgba(234,67,53,0.10), rgba(251,188,5,0.13), rgba(52,168,83,0.11))',
                      backgroundSize: '240% 240%',
                      animation: 'insightRainbowShift 6s ease infinite',
                    }}
                    className="pointer-events-none absolute inset-0"
                  />
                )}

                {/* Brilho lateral para níveis 1 a 4 */}
                {tier.level >= 1 && !isRainbow && (
                  <div
                    aria-hidden="true"
                    style={{
                      background: `radial-gradient(320px circle at 0% 50%, ${tier.glowRgba}, transparent 75%)`,
                    }}
                    className="pointer-events-none absolute inset-0"
                  />
                )}

                <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-1.5 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <TierBadge tier={tier} />

                      {isCurrent && (
                        <span className="px-2 py-0.5 rounded-full bg-accent/15 text-accent text-[10px] font-mono font-bold">
                          Atual
                        </span>
                      )}

                      {!isCurrent && isUnlocked && tier.level > 0 && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-mono font-semibold text-emerald-500">
                          <Check className="w-3 h-3" />
                          <span>Alcançada</span>
                        </span>
                      )}
                    </div>

                    <p
                      className={`text-xs sm:text-sm font-bold ${isRainbow ? 'tier-rainbow-text' : 'text-primary'
                        }`}
                    >
                      {tier.tagline}
                    </p>

                    <ul className="text-xs text-muted space-y-0.5">
                      {tier.level > 1 && (
                        <li className="text-[11px] font-semibold text-muted/80">
                          Tudo do nível anterior, mais:
                        </li>
                      )}
                      {tier.perks.map((perk) => (
                        <li key={perk.label} className="flex items-center gap-1.5">
                          <span aria-hidden>·</span>
                          <span>{perk.label}</span>
                          {perk.soon && (
                            <span className="rounded-full border border-border px-1.5 text-[9px] font-bold uppercase tracking-wide">
                              Em breve
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="sm:text-right shrink-0 flex sm:flex-col items-baseline sm:items-end justify-between sm:justify-center gap-1 pt-2 sm:pt-0 border-t sm:border-t-0 border-border/60">
                    <span
                      style={
                        !isRainbow && tier.level >= 2
                          ? { color: tier.color }
                          : undefined
                      }
                      className={`text-xs sm:text-sm font-mono font-extrabold ${isRainbow ? 'tier-rainbow-text' : 'text-primary'
                        }`}
                    >
                      {tier.minPoints === 0
                        ? '0 pts'
                        : `${tier.minPoints} ${tier.minPoints === 1 ? 'pt' : 'pts'}`}
                    </span>
                    <span className="text-[10px] font-mono text-muted">
                      {tier.minPoints === 0
                        ? 'Padrão'
                        : `R$ ${tier.minPoints},00 acumulados`}
                    </span>
                  </div>
                </div>
              </div>
            );

            if (isRainbow) {
              return (
                <div
                  key={tier.level}
                  className="relative p-[2px] rounded-[18px] overflow-hidden tier-card-rainbow-border shadow-sm"
                >
                  {innerCard}
                </div>
              );
            }

            return <div key={tier.level}>{innerCard}</div>;
          })}
        </div>
      </section>
    </div>
  );
}