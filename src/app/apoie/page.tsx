'use client';

import { useState, useEffect, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import {
  Heart,
  Coffee,
  Server,
  Rocket,
  Sparkles,
  Copy,
  Check,
  SlidersHorizontal,
  KeyRound,
  ShieldCheck,
  X,
} from 'lucide-react';

type PixKeyType = 'email' | 'cpf' | 'phone' | 'evp';

interface PixConfig {
  keyType: PixKeyType;
  key: string;
  merchantName: string;
  merchantCity: string;
}

const DEFAULT_PIX_CONFIG: PixConfig = {
  keyType: 'evp',
  key: '18a7940c-945d-43d4-ac36-45af663c23ab',
  merchantName: 'VICTOR POIANI',
  merchantCity: 'RIO PARANAIBA',
};

const PRESET_AMOUNTS = [
  { value: 2, label: 'R$ 2', desc: 'Pague um café', icon: Coffee },
  { value: 10, label: 'R$ 10', desc: 'Apoie o servidor', icon: Server },
  { value: 20, label: 'R$ 20', desc: 'Impulsione o Insight', icon: Rocket },
  { value: 0, label: 'Livre', desc: 'Qualquer valor', icon: Sparkles },
];

function sanitizeBacenText(text: string, maxLength: number): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9 ]/g, '')
    .toUpperCase()
    .trim()
    .slice(0, maxLength);
}

function formatPixKeyForBacen(rawKey: string, type: PixKeyType): string {
  const trimmed = rawKey.trim();
  if (!trimmed) return '';

  if (type === 'email') {
    return trimmed.toLowerCase();
  }

  if (type === 'cpf') {
    return trimmed.replace(/\D/g, '');
  }

  if (type === 'phone') {
    const digits = trimmed.replace(/\D/g, '');
    if (digits.startsWith('55') && digits.length >= 12) {
      return `+${digits}`;
    }
    return `+55${digits}`;
  }

  return trimmed.toLowerCase();
}

function formatEmvField(id: string, value: string): string {
  const len = value.length.toString().padStart(2, '0');
  return `${id}${len}${value}`;
}

function computeCRC16(payload: string): string {
  let crc = 0xffff;
  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      if ((crc & 0x8000) !== 0) {
        crc = ((crc << 1) ^ 0x1021) & 0xffff;
      } else {
        crc = (crc << 1) & 0xffff;
      }
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

function buildValidPixPayload({
  key,
  keyType,
  merchantName,
  merchantCity,
  amount,
}: {
  key: string;
  keyType: PixKeyType;
  merchantName: string;
  merchantCity: string;
  amount: number;
}): string {
  const formattedKey = formatPixKeyForBacen(key, keyType);
  const cleanName =
    sanitizeBacenText(merchantName || 'VICTOR POIANI', 25) || 'VICTOR POIANI';
  const cleanCity =
    sanitizeBacenText(merchantCity || 'RIO PARANAIBA', 15) || 'RIO PARANAIBA';

  const guiField = formatEmvField('00', 'br.gov.bcb.pix');
  const keyField = formatEmvField('01', formattedKey);
  const merchantAccountInfo = formatEmvField('26', `${guiField}${keyField}`);

  const amountField =
    amount > 0 ? formatEmvField('54', amount.toFixed(2)) : '';

  const nameField = formatEmvField('59', cleanName);
  const cityField = formatEmvField('60', cleanCity);
  const additionalDataField = formatEmvField('62', formatEmvField('05', '***'));

  const basePayload =
    '000201' +
    merchantAccountInfo +
    '52040000' +
    '5303986' +
    amountField +
    '5802BR' +
    nameField +
    cityField +
    additionalDataField +
    '6304';

  const crc = computeCRC16(basePayload);
  return `${basePayload}${crc}`;
}

export default function ApoiePage() {
  const [pixConfig, setPixConfig] = useState<PixConfig>(DEFAULT_PIX_CONFIG);
  const [selectedPreset, setSelectedPreset] = useState<number>(10);
  const [customAmount, setCustomAmount] = useState<string>('15');

  const [isAdmin, setIsAdmin] = useState(false);
  const [profileId, setProfileId] = useState<string | null>(null);
  const [currentSocialLinks, setCurrentSocialLinks] = useState<
    Record<string, string>
  >({});

  const [expandConfig, setExpandConfig] = useState(false);
  const [editKeyType, setEditKeyType] = useState<PixKeyType>('evp');
  const [editKey, setEditKey] = useState('');
  const [editName, setEditName] = useState('Victor Poiani');
  const [editCity, setEditCity] = useState('Rio Paranaiba');
  const [savingConfig, setSavingConfig] = useState(false);

  const [copiedPayload, setCopiedPayload] = useState(false);
  const [copiedRawKey, setCopiedRawKey] = useState(false);

  const supabase = createClient();

  useEffect(() => {
    async function loadPixSettings() {
      try {
        const localSaved = localStorage.getItem('insight-pix-config');
        if (localSaved) {
          const parsed = JSON.parse(localSaved) as PixConfig;
          if (parsed.key) {
            setPixConfig(parsed);
            setEditKeyType(parsed.keyType || 'evp');
            setEditKey(parsed.key);
            setEditName(parsed.merchantName || 'Victor Poiani');
            setEditCity(parsed.merchantCity || 'Rio Paranaiba');
          }
        }
      } catch {
        // Ignora erro de leitura local
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();
      setIsAdmin(Boolean(session?.user));

      const { data: profile } = await supabase
        .from('profiles')
        .select('id, social_links')
        .limit(1)
        .maybeSingle();

      if (profile) {
        setProfileId(profile.id);
        const links = (profile.social_links as Record<string, string>) || {};
        setCurrentSocialLinks(links);

        if (links.pix_key) {
          const dbConfig: PixConfig = {
            keyType: (links.pix_type as PixKeyType) || 'evp',
            key: links.pix_key,
            merchantName: links.pix_name || 'VICTOR POIANI',
            merchantCity: links.pix_city || 'RIO PARANAIBA',
          };
          setPixConfig(dbConfig);
          setEditKeyType(dbConfig.keyType);
          setEditKey(dbConfig.key);
          setEditName(dbConfig.merchantName);
          setEditCity(dbConfig.merchantCity);
          localStorage.setItem('insight-pix-config', JSON.stringify(dbConfig));
        }
      }
    }

    loadPixSettings();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      const loggedIn = Boolean(session?.user);
      setIsAdmin(loggedIn);
      if (!loggedIn) {
        setExpandConfig(false);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [supabase]);

  const effectiveAmount = useMemo(() => {
    if (selectedPreset > 0) return selectedPreset;
    const parsed = parseFloat(customAmount.replace(',', '.'));
    return !isNaN(parsed) && parsed > 0 ? parsed : 0;
  }, [selectedPreset, customAmount]);

  const formattedBacenKey = useMemo(
    () => formatPixKeyForBacen(pixConfig.key, pixConfig.keyType),
    [pixConfig.key, pixConfig.keyType]
  );

  const pixPayload = useMemo(
    () =>
      buildValidPixPayload({
        key: pixConfig.key,
        keyType: pixConfig.keyType,
        merchantName: pixConfig.merchantName,
        merchantCity: pixConfig.merchantCity,
        amount: effectiveAmount,
      }),
    [pixConfig, effectiveAmount]
  );

  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&margin=10&data=${encodeURIComponent(
    pixPayload
  )}`;

  async function handleSavePixConfig(e: React.FormEvent) {
    e.preventDefault();
    if (!isAdmin) return;

    const cleanKey = editKey.trim();
    if (!cleanKey) return;

    setSavingConfig(true);

    const nextConfig: PixConfig = {
      keyType: editKeyType,
      key: cleanKey,
      merchantName: editName.trim() || 'VICTOR POIANI',
      merchantCity: editCity.trim() || 'RIO PARANAIBA',
    };

    setPixConfig(nextConfig);
    localStorage.setItem('insight-pix-config', JSON.stringify(nextConfig));

    if (profileId) {
      const updatedLinks = {
        ...currentSocialLinks,
        pix_key: nextConfig.key,
        pix_type: nextConfig.keyType,
        pix_name: nextConfig.merchantName,
        pix_city: nextConfig.merchantCity,
      };
      await supabase
        .from('profiles')
        .update({ social_links: updatedLinks })
        .eq('id', profileId);
      setCurrentSocialLinks(updatedLinks);
    }

    setSavingConfig(false);
    setExpandConfig(false);
  }

  function handleCopyPayload() {
    navigator.clipboard.writeText(pixPayload);
    setCopiedPayload(true);
    setTimeout(() => setCopiedPayload(false), 2500);
  }

  function handleCopyRawKey() {
    navigator.clipboard.writeText(formattedBacenKey);
    setCopiedRawKey(true);
    setTimeout(() => setCopiedRawKey(false), 2500);
  }

  return (
    <div className="w-full max-w-full min-w-0 overflow-x-hidden p-4 sm:p-7 space-y-6 box-border">
      {/* Cabeçalho */}
      <header className="w-full min-w-0 space-y-3 border-b border-border pb-5">
        <div className="inline-flex items-center gap-1.5 text-xs font-extrabold text-accent uppercase tracking-wider">
          <Heart className="w-4 h-4 shrink-0" />
          <span className="truncate">Financiamento Independente</span>
        </div>

        <h1 className="text-2xl sm:text-3xl font-black text-primary break-words">
          Apoie o Insight<span className="text-accent">*</span>
        </h1>

        <p className="text-xs sm:text-sm text-secondary max-w-xl leading-relaxed break-words">
          Contribua diretamente para manter o servidor, o domínio e o
          desenvolvimento de novos recursos da plataforma.
        </p>

        {/* Botão visível SOMENTE para o Admin autenticado */}
        {isAdmin && (
          <div className="pt-1">
            <button
              type="button"
              onClick={() => setExpandConfig(!expandConfig)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-surface border border-border hover:border-accent text-xs font-bold text-primary transition-colors max-w-full"
            >
              <SlidersHorizontal className="w-3.5 h-3.5 text-accent shrink-0" />
              <span className="truncate">Configurar Chave PIX</span>
            </button>
          </div>
        )}

        {/* Painel Expansível de Configuração da Chave PIX (Exclusivo Admin) */}
        {isAdmin && expandConfig && (
          <form
            onSubmit={handleSavePixConfig}
            className="mt-4 p-4 sm:p-5 rounded-2xl bg-surface border border-border space-y-4 w-full min-w-0 overflow-hidden"
          >
            <div className="flex items-center justify-between gap-2 min-w-0">
              <span className="text-xs font-extrabold text-accent uppercase tracking-wider truncate">
                Configurar Recebimento PIX (Padrão Banco Central)
              </span>
              <button
                type="button"
                onClick={() => setExpandConfig(false)}
                className="text-muted hover:text-primary shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 w-full min-w-0">
              {(
                [
                  { id: 'cpf', label: 'CPF / CNPJ' },
                  { id: 'phone', label: 'Celular' },
                  { id: 'email', label: 'E-mail' },
                  { id: 'evp', label: 'Chave Aleatória' },
                ] as { id: PixKeyType; label: string }[]
              ).map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setEditKeyType(t.id)}
                  className={`py-2 px-2.5 rounded-xl border text-xs font-bold transition-colors truncate min-w-0 ${
                    editKeyType === t.id
                      ? 'bg-accent text-white border-accent'
                      : 'bg-elevated border-border text-secondary hover:text-primary'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full min-w-0">
              <div className="sm:col-span-1 min-w-0">
                <label className="text-[11px] text-muted block mb-1 truncate">
                  {editKeyType === 'cpf'
                    ? 'Seu CPF (apenas números ou com pontos)'
                    : editKeyType === 'phone'
                    ? 'Celular com DDD (ex: 34999999999)'
                    : editKeyType === 'email'
                    ? 'Seu E-mail cadastrado no PIX'
                    : 'Sua Chave Aleatória do banco'}
                </label>
                <input
                  type="text"
                  required
                  value={editKey}
                  onChange={(e) => setEditKey(e.target.value)}
                  placeholder="Digite sua chave PIX real..."
                  className="w-full min-w-0 bg-elevated border border-border rounded-xl px-3 py-2 text-xs text-primary focus:outline-none focus:border-accent"
                />
              </div>

              <div className="min-w-0">
                <label className="text-[11px] text-muted block mb-1 truncate">
                  Nome do Beneficiário (sem acentos)
                </label>
                <input
                  type="text"
                  required
                  maxLength={25}
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full min-w-0 bg-elevated border border-border rounded-xl px-3 py-2 text-xs text-primary focus:outline-none focus:border-accent"
                />
              </div>

              <div className="min-w-0">
                <label className="text-[11px] text-muted block mb-1 truncate">
                  Cidade (sem acentos, máx. 15 letras)
                </label>
                <input
                  type="text"
                  required
                  maxLength={15}
                  value={editCity}
                  onChange={(e) => setEditCity(e.target.value)}
                  className="w-full min-w-0 bg-elevated border border-border rounded-xl px-3 py-2 text-xs text-primary focus:outline-none focus:border-accent"
                />
              </div>
            </div>

            <div className="flex flex-wrap justify-end gap-2 pt-2 border-t border-border">
              <button
                type="button"
                onClick={() => setExpandConfig(false)}
                className="px-3.5 py-1.5 rounded-xl bg-elevated text-xs text-secondary"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={savingConfig}
                className="px-4 py-1.5 rounded-xl bg-accent text-white text-xs font-bold hover:bg-accent-hover"
              >
                {savingConfig ? 'Salvando...' : 'Salvar Chave Oficial'}
              </button>
            </div>
          </form>
        )}
      </header>

      {/* Card Principal de Doação (Público para Visitantes) */}
      <section className="w-full max-w-full min-w-0 p-4 sm:p-6 rounded-3xl bg-surface border border-border space-y-6 overflow-hidden box-border">
        <div className="space-y-3 w-full min-w-0">
          <h2 className="text-sm font-extrabold text-primary">
            1. Escolha um valor de apoio
          </h2>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3 w-full min-w-0">
            {PRESET_AMOUNTS.map((item) => {
              const Icon = item.icon;
              const isSelected = selectedPreset === item.value;
              return (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => setSelectedPreset(item.value)}
                  className={`min-w-0 p-3.5 sm:p-4 rounded-2xl border text-left transition-all space-y-1.5 overflow-hidden ${
                    isSelected
                      ? 'bg-accent/15 border-accent text-primary shadow-md'
                      : 'bg-elevated border-border text-secondary hover:text-primary hover:border-muted'
                  }`}
                >
                  <Icon
                    className={`w-4 h-4 shrink-0 ${
                      isSelected ? 'text-accent' : 'text-muted'
                    }`}
                  />
                  <p className="text-base sm:text-lg font-black text-primary truncate">
                    {item.label}
                  </p>
                  <p className="text-[11px] text-muted leading-tight break-words">
                    {item.desc}
                  </p>
                </button>
              );
            })}
          </div>

          {selectedPreset === 0 && (
            <div className="pt-2 flex flex-wrap items-center gap-3 w-full min-w-0">
              <label className="text-xs font-bold text-secondary">
                Digite o valor desejado (R$) ou deixe 0 para definir no app do
                banco:
              </label>
              <input
                type="number"
                min="0"
                step="1"
                value={customAmount}
                onChange={(e) => setCustomAmount(e.target.value)}
                placeholder="Ex: 15,00"
                className="w-36 max-w-full bg-elevated border border-border rounded-xl px-3.5 py-2 text-xs font-bold text-primary focus:outline-none focus:border-accent"
              />
            </div>
          )}
        </div>

        <hr className="border-border" />

        <div className="flex flex-col md:flex-row items-center md:items-start gap-5 sm:gap-6 w-full min-w-0">
          <div className="p-3 sm:p-3.5 rounded-2xl bg-white shrink-0 shadow-md">
            <img
              src={qrCodeUrl}
              alt="QR Code PIX"
              width={190}
              height={190}
              className="w-40 h-40 sm:w-44 sm:h-44 object-contain block"
            />
          </div>

          <div className="flex-1 min-w-0 w-full space-y-3.5 overflow-hidden">
            <div className="min-w-0">
              <p className="text-[11px] font-extrabold text-accent uppercase tracking-wider">
                2. Escaneie ou copie o código
              </p>
              <h3 className="text-lg sm:text-xl font-black text-primary mt-0.5 break-words">
                {effectiveAmount > 0
                  ? `Doação de R$ ${effectiveAmount.toFixed(2).replace('.', ',')}`
                  : 'Doação de Valor Livre'}
              </h3>
              <p className="text-xs text-secondary mt-0.5 truncate">
                Destinatário:{' '}
                <strong className="text-primary">
                  {pixConfig.merchantName}
                </strong>
              </p>
            </div>

            {/* w-0 min-w-full impede que a string longa do PIX estique o cálculo intrínseco do Flexbox */}
            <div className="w-full min-w-0 p-3 rounded-xl bg-elevated border border-border overflow-hidden">
              <p className="w-0 min-w-full font-mono text-[11px] text-secondary truncate select-all">
                {pixPayload}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5 pt-1 w-full min-w-0">
              <button
                type="button"
                onClick={handleCopyPayload}
                className="px-4 py-2.5 rounded-xl bg-accent text-white text-xs font-bold hover:bg-accent-hover flex items-center gap-2 shadow-md transition-colors max-w-full min-w-0"
              >
                {copiedPayload ? (
                  <>
                    <Check className="w-4 h-4 shrink-0" />
                    <span className="truncate">Código PIX Copiado!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4 shrink-0" />
                    <span className="truncate">Copiar PIX Copia e Cola</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={handleCopyRawKey}
                className="px-3.5 py-2.5 rounded-xl bg-elevated border border-border hover:border-accent text-xs font-semibold text-primary flex items-center gap-2 max-w-full min-w-0 transition-colors"
              >
                {copiedRawKey ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-[#1DB954] shrink-0" />
                    <span className="text-[#1DB954] truncate">
                      Chave Copiada!
                    </span>
                  </>
                ) : (
                  <>
                    <KeyRound className="w-3.5 h-3.5 text-accent shrink-0" />
                    <span className="truncate max-w-[180px] sm:max-w-[210px]">
                      Copiar Chave ({formattedBacenKey})
                    </span>
                  </>
                )}
              </button>
            </div>

            <div className="flex items-start sm:items-center gap-1.5 text-[11px] text-muted pt-1 min-w-0">
              <ShieldCheck className="w-3.5 h-3.5 text-[#1DB954] shrink-0 mt-0.5 sm:mt-0" />
              <span className="break-words leading-relaxed">
                Código gerado no padrão oficial EMVCo / Banco Central do Brasil
                (sem taxas intermediárias).
              </span>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}