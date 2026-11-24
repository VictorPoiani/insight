'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Zap } from '@/components/icons';
import { NitroCosmetics } from '@/lib/nitro/catalog';
import { useNitro } from './NitroProvider';
import { NitroSettingsPanel } from './NitroSettingsPanel';
import { CosmeticAvatar, CosmeticName, CosmeticTag } from './Cosmetics';

/** Aba "Perfil & Nitro" em /config: central de controle, salva na hora. */
export function NitroConfigTab() {
  const { viewer, saveCosmetics } = useNitro();
  const [value, setValue] = useState<NitroCosmetics>(viewer?.cosmetics || {});
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    setValue(viewer?.cosmetics || {});
  }, [viewer?.cosmetics]);

  if (!viewer) return null;

  async function handleChange(next: NitroCosmetics) {
    const previous = value;
    setValue(next);
    setStatus('Salvando...');
    const res = await saveCosmetics(next);
    if (res.ok) {
      setStatus('Salvo');
      setTimeout(() => setStatus(null), 1500);
    } else {
      setValue(previous);
      setStatus(`Não foi possível salvar: ${res.error}`);
    }
  }

  const name = viewer.display_name || viewer.full_name || viewer.username;

  return (
    <div className="px-6 py-6 space-y-6">
      <div className="flex items-center gap-4 p-4 rounded-2xl bg-surface border border-border">
        <CosmeticAvatar profile={viewer} size={64}>
          <img
            src={viewer.avatar_url || '/assets/net/default-perfil'}
            alt={name}
            className="w-16 h-16 rounded-full object-cover bg-elevated"
          />
        </CosmeticAvatar>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-extrabold text-primary truncate">
            <CosmeticName profile={viewer}>{name}</CosmeticName>
          </p>
          <p className="text-xs text-muted flex items-center gap-1.5 flex-wrap">
            @{viewer.username} <CosmeticTag profile={viewer} />
          </p>
        </div>
        <Link
          href="/nitro"
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-accent hover:bg-accent-hover text-white text-xs font-bold shrink-0"
        >
          <Zap className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Abrir galeria</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      <NitroSettingsPanel
        value={value}
        onChange={handleChange}
        level={viewer.contributor_level ?? 0}
        showEquipped
      />

      {status && <p className="text-[11px] text-secondary">{status}</p>}
    </div>
  );
}
