'use client';

import { NitroCosmetics, getNitroItem, KIND_LABELS } from '@/lib/nitro/catalog';
import { useNitro } from './NitroProvider';

interface ToggleRowProps {
  label: string;
  hint: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (next: boolean) => void;
}

function ToggleRow({ label, hint, checked, disabled, onChange }: ToggleRowProps) {
  return (
    <label
      className={`flex items-start justify-between gap-3 py-2.5 ${
        disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
      }`}
    >
      <span className="min-w-0">
        <span className="block text-xs font-semibold text-primary">{label}</span>
        <span className="block text-[11px] text-muted leading-snug">{hint}</span>
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative mt-0.5 w-9 h-5 rounded-full shrink-0 transition-colors ${
          checked ? 'bg-accent' : 'bg-elevated border border-border'
        }`}
      >
        <span
          className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${
            checked ? 'left-[18px]' : 'left-0.5'
          }`}
        />
      </button>
    </label>
  );
}

interface NitroSettingsPanelProps {
  value: NitroCosmetics;
  onChange: (next: NitroCosmetics) => void;
  level: number;
  /** Mostra os itens equipados com botão de remover. */
  showEquipped?: boolean;
  disabled?: boolean;
}

/**
 * Chaves de animação do perfil (gravadas no Supabase) + preferências locais
 * do visitante. Usado na galeria /nitro e na aba Configurações.
 */
export function NitroSettingsPanel({ value, onChange, level, showEquipped, disabled }: NitroSettingsPanelProps) {
  const { prefs, setPrefs } = useNitro();
  const set = (patch: Partial<NitroCosmetics>) => onChange({ ...value, ...patch });

  const equipped: { key: 'frame' | 'title' | 'tag' | 'intro'; name: string | null }[] = [
    { key: 'frame', name: getNitroItem(value.frame, 'frame')?.name ?? null },
    { key: 'title', name: getNitroItem(value.title, 'title')?.name ?? null },
    { key: 'tag', name: getNitroItem(value.tag, 'tag')?.name ?? null },
    { key: 'intro', name: getNitroItem(value.intro, 'intro')?.name ?? null },
  ];

  return (
    <div className="space-y-4">
      {showEquipped && (
        <section>
          <h3 className="text-[11px] font-bold uppercase tracking-wider text-muted mb-1">Equipado</h3>
          <div className="divide-y divide-border">
            {equipped.map((row) => (
              <div key={row.key} className="flex items-center justify-between gap-2 py-2 text-xs">
                <span className="text-secondary">{KIND_LABELS[row.key].singular}</span>
                <span className="flex items-center gap-2 min-w-0">
                  <span className={`truncate ${row.name ? 'font-semibold text-primary' : 'text-muted'}`}>
                    {row.name || 'Nenhum'}
                  </span>
                  {row.name && (
                    <button
                      type="button"
                      disabled={disabled}
                      onClick={() => set({ [row.key]: null })}
                      className="text-[11px] text-muted hover:text-danger shrink-0"
                    >
                      Remover
                    </button>
                  )}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      <section>
        <h3 className="text-[11px] font-bold uppercase tracking-wider text-muted">Animações do meu perfil</h3>
        <p className="text-[11px] text-muted mb-1">Valem para quem visita seu perfil.</p>
        <div className="divide-y divide-border">
          <ToggleRow
            label="Exibir moldura"
            hint="Desligado, o avatar volta ao normal sem perder a moldura escolhida."
            checked={value.frameEnabled !== false}
            disabled={disabled}
            onChange={(v) => set({ frameEnabled: v })}
          />
          <ToggleRow
            label="Animar moldura"
            hint="Desligado, a moldura fica estática."
            checked={value.frameAnimated !== false}
            disabled={disabled || value.frameEnabled === false}
            onChange={(v) => set({ frameAnimated: v })}
          />
          <ToggleRow
            label="Animação de abertura"
            hint="Efeito ao abrir a página do seu perfil."
            checked={value.introEnabled !== false}
            disabled={disabled}
            onChange={(v) => set({ introEnabled: v })}
          />
          <ToggleRow
            label="Animação de patente"
            hint={
              level >= 4
                ? 'Moldura animada e abertura exclusivas dos níveis 4 e 5.'
                : 'Disponível a partir do nível 4 · Imperador.'
            }
            checked={level >= 4 && value.levelAnimation !== false}
            disabled={disabled || level < 4}
            onChange={(v) => set({ levelAnimation: v })}
          />
        </div>
      </section>

      <section>
        <h3 className="text-[11px] font-bold uppercase tracking-wider text-muted">Benefícios Nitro</h3>
        <p className="text-[11px] text-muted mb-1">Só para você.</p>
        <div className="divide-y divide-border">
          <ToggleRow
            label="Rainbow na logo e nos carregamentos"
            hint="Logo Insight* e asteriscos de carregamento com espectro animado."
            checked={value.rainbow !== false}
            disabled={disabled}
            onChange={(v) => set({ rainbow: v })}
          />
        </div>
      </section>

      <section>
        <h3 className="text-[11px] font-bold uppercase tracking-wider text-muted">Ao visitar outros perfis</h3>
        <p className="text-[11px] text-muted mb-1">Só neste dispositivo.</p>
        <div className="divide-y divide-border">
          <ToggleRow
            label="Reproduzir aberturas"
            hint="Toca a animação de abertura de outros perfis (uma vez por sessão)."
            checked={prefs.playIntros}
            onChange={(v) => setPrefs({ ...prefs, playIntros: v })}
          />
          <ToggleRow
            label="Animar molduras em listas"
            hint="No feed e nas respostas, molduras animam ao passar o mouse."
            checked={prefs.animateLists}
            onChange={(v) => setPrefs({ ...prefs, animateLists: v })}
          />
        </div>
        <p className="text-[11px] text-muted mt-1">
          “Reduzir movimento” (aba Aparência) desliga todas as animações do Nitro.
        </p>
      </section>
    </div>
  );
}
