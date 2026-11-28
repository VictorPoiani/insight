'use client';

import { notify } from '@/lib/ui/feedback';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, ImagePlus, Loader2, NotebookPen, Plus, SkipForward, Trash2, X } from 'lucide-react';
import type { NotebookItem } from '@/lib/notebook/types';
import type { NotebookApi } from '@/lib/notebook/useNotebook';
import {
  CHARACTER_ROLES,
  INTERVIEW,
  characterToMarkdown,
  groupQuestions,
  isCharacterData,
  markdownToCharacter,
  newId,
  sectionProgress,
  type CharacterData,
  type InterviewGroup,
} from '@/lib/notebook/character';
import { uploadMediaToInsight } from '@/lib/mediaCompressor';
import { getUserUploadLimitBytes } from '@/lib/contributorLevels';
import { DiaryBook } from './DiaryBook';
import { RichField } from '../editor/RichField';
import { ArtArc, ArtBackstory, ArtEssence, ArtInterview, ArtMixed, ArtNotebooks, ArtPhysical, ArtPsych } from './Illustrations';

const SERIF = "var(--nb-literata), Georgia, 'Times New Roman', serif";

const SECTIONS = [
  { id: 'essencia', label: 'Essência' },
  { id: 'cadernos', label: 'Cadernos' },
  { id: 'perfis', label: 'Perfis' },
  { id: 'trajetoria', label: 'Trajetória' },
  { id: 'entrevista', label: 'Entrevista' },
] as const;

const PROFILES = [
  {
    id: 'physical' as const,
    label: 'Físico',
    Art: ArtPhysical,
    hint: 'Descreva a aparência de forma seca e exata, da cabeça aos pés, sem aprofundar na psicologia.',
  },
  {
    id: 'psychological' as const,
    label: 'Psicológico',
    Art: ArtPsych,
    hint: 'Os pequenos detalhes de quem ele é por dentro. Vale fazer a entrevista antes e voltar aqui depois.',
  },
  {
    id: 'mixed' as const,
    label: 'Físico-psicológico',
    Art: ArtMixed,
    hint: 'Traços físicos que revelam a psicologia. Funciona melhor dentro da narrativa, como forma de apresentar o personagem.',
  },
];

type Props = {
  item: NotebookItem;
  api: NotebookApi;
  role?: string | null;
  level?: number | null;
};

/** Textarea que cresce com o texto (Enter quebra linha, como no resto do site). */
function Grow({
  value,
  onChange,
  placeholder,
  className = '',
  serif = false,
  minRows = 2,
  autoFocus,
  onKeyDown,
  label,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
  serif?: boolean;
  minRows?: number;
  autoFocus?: boolean;
  onKeyDown?: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  label?: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);
  return (
    <textarea
      ref={ref}
      value={value}
      rows={minRows}
      autoFocus={autoFocus}
      aria-label={label || placeholder}
      placeholder={placeholder}
      onKeyDown={onKeyDown}
      onChange={(e) => onChange(e.target.value)}
      style={serif ? { fontFamily: SERIF } : undefined}
      className={`w-full resize-none overflow-hidden bg-transparent outline-none placeholder:text-[var(--nb-ink-3)] placeholder:opacity-70 leading-relaxed ${className}`}
    />
  );
}

function Ring({ value, size = 18 }: { value: number; size?: number }) {
  const r = size / 2 - 2;
  const c = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden className="shrink-0 -rotate-90">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--nb-line)" strokeWidth="2" />
      {value > 0 && (
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--nb-hl)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - value)}
          style={{ transition: 'stroke-dashoffset .4s ease' }}
        />
      )}
    </svg>
  );
}

function SectionHead({ id, kicker, title, text }: { id: string; kicker: string; title: string; text?: string }) {
  return (
    <header id={`cs-${id}`} className="scroll-mt-24 mb-4">
      <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[var(--nb-hl)]">{kicker}</p>
      <h2 className="mt-1 text-lg font-extrabold tracking-tight">{title}</h2>
      {text && <p className="mt-1 text-[13px] text-[var(--nb-ink-3)] max-w-xl">{text}</p>}
    </header>
  );
}

const card = 'rounded-2xl border border-[var(--nb-line)] bg-[var(--nb-pane)]';

export function CharacterSheet({ item, api, role, level }: Props) {
  const stored = item.data?.character;
  // ficha antiga em texto: converte na hora (nada se perde)
  const [ch, setCh] = useState<CharacterData>(() => (isCharacterData(stored) ? stored : markdownToCharacter(item.content || '')));
  const chRef = useRef(ch);
  const itemRef = useRef(item);
  itemRef.current = item;

  const save = useCallback(
    (patch: Partial<CharacterData>, debounce = 700) => {
      const next = { ...chRef.current, ...patch, v: 1 as const };
      chRef.current = next;
      setCh(next);
      api.update(
        itemRef.current.id,
        {
          data: { ...(itemRef.current.data || {}), character: next },
          content: characterToMarkdown(next),
        },
        { debounce }
      );
    },
    [api]
  );

  // grava a conversão (o texto original fica no histórico de versões)
  useEffect(() => {
    if (isCharacterData(stored)) return;
    void api.saveRevisionNow(item.id).then(() => save({}, 0));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.id]);

  const progress = useMemo(() => sectionProgress(ch), [ch]);

  return (
    <div className="pb-24 space-y-14">
      {/* índice fixo */}
      <nav
        aria-label="Seções da ficha"
        className="sticky top-0 z-10 -mx-1 px-1 py-2 bg-[color-mix(in_srgb,var(--nb-bg)_88%,transparent)] backdrop-blur flex items-center gap-1 overflow-x-auto nb-scroll"
      >
        <span className="mr-1 shrink-0 px-1.5 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider bg-[var(--nb-hl-soft)] text-[var(--nb-hl)]">
          Preview
        </span>
        {SECTIONS.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => document.getElementById(`cs-${s.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
            className="shrink-0 flex items-center gap-1.5 h-7 px-2.5 rounded-full text-[12px] font-semibold text-[var(--nb-ink-2)] hover:bg-[var(--nb-pane-2)] hover:text-[var(--nb-ink)]"
          >
            <Ring value={progress[s.id]} size={14} />
            {s.label}
          </button>
        ))}
      </nav>

      <Essence ch={ch} save={save} item={item} api={api} role={role} level={level} />
      <Notebooks ch={ch} save={save} name={item.title} />
      <Profiles ch={ch} save={save} />
      <Trajectory ch={ch} save={save} />
      <Interview ch={ch} save={save} />
    </div>
  );
}

type SecProps = {
  ch: CharacterData;
  save: (p: Partial<CharacterData>, debounce?: number) => void;
};

// ------------------------------------------------------------------ essência
function Essence({ ch, save, item, api, role, level }: SecProps & Props) {
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const initials =
    item.title
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase())
      .join('') || '?';

  async function upload(f: File) {
    setUploading(true);
    try {
      const res = await uploadMediaToInsight(f, {
        budgetBytes: getUserUploadLimitBytes(level ?? 0, role ?? undefined),
        asImage: true,
        scope: 'notebook',
      });
      await api.registerAsset(item.id, res.r2Key, res.publicUrl);
      save({ avatarUrl: res.publicUrl, avatarR2Key: res.r2Key }, 0);
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Falha no envio da imagem.');
    }
    setUploading(false);
  }

  return (
    <section>
      <SectionHead id="essencia" kicker="01" title="Essência" text="Quem é, em poucas linhas. O nome completo é o título da ficha." />
      <div className={`${card} p-5 sm:p-6`}>
        <div className="flex gap-5 items-start">
          <div className="shrink-0 flex flex-col items-center gap-1.5">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              title="Trocar imagem"
              className="group relative w-20 h-20 rounded-full overflow-hidden border border-[var(--nb-line)] bg-[var(--nb-pane-2)] grid place-items-center"
            >
              {ch.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={ch.avatarUrl} alt="" className="w-full h-full object-cover" />
              ) : (
                <span className="text-xl font-black text-[var(--nb-ink-3)]" style={{ fontFamily: SERIF }}>
                  {initials}
                </span>
              )}
              <span className="absolute inset-0 grid place-items-center bg-black/45 text-white opacity-0 group-hover:opacity-100 transition-opacity">
                {uploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <ImagePlus className="w-5 h-5" />}
              </span>
            </button>
            {ch.avatarUrl && (
              <button
                type="button"
                onClick={() => save({ avatarUrl: null, avatarR2Key: null }, 0)}
                className="text-[10px] text-[var(--nb-ink-3)] hover:text-[var(--nb-ink)]"
              >
                remover
              </button>
            )}
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void upload(f);
                e.target.value = '';
              }}
            />
          </div>

          <div className="min-w-0 flex-1 space-y-3">
            <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Papel na história">
              {CHARACTER_ROLES.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  role="radio"
                  aria-checked={ch.role === r.id}
                  onClick={() => save({ role: ch.role === r.id ? '' : r.id }, 0)}
                  className={`h-7 px-3 rounded-full text-[11px] font-bold border transition-colors ${
                    ch.role === r.id
                      ? 'bg-[var(--nb-hl)] border-[var(--nb-hl)] text-white'
                      : 'border-[var(--nb-line)] text-[var(--nb-ink-2)] hover:border-[var(--nb-hl)]'
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>
            <label className="flex items-center gap-2 text-[12px] text-[var(--nb-ink-3)]">
              Idade
              <input
                value={ch.age || ''}
                onChange={(e) => save({ age: e.target.value.slice(0, 40) })}
                placeholder="ex.: 27, ou séculos"
                className="w-40 h-7 px-2 rounded-lg bg-[var(--nb-pane-2)] border border-transparent focus:border-[var(--nb-hl)] outline-none text-[var(--nb-ink)]"
              />
            </label>
            <Grow
              value={ch.intro || ''}
              onChange={(v) => save({ intro: v })}
              placeholder="Introdução: quem é essa pessoa, em duas ou três frases."
              className="text-[14px]"
              label="Introdução"
            />
          </div>
          <ArtEssence className="hidden md:block w-36 shrink-0 text-[var(--nb-ink-3)]" />
        </div>

        <div className="mt-5 pt-5 border-t border-[var(--nb-line)] flex gap-3">
          <span aria-hidden className="text-4xl leading-none text-[var(--nb-hl)]" style={{ fontFamily: SERIF }}>
            “
          </span>
          <Grow
            value={ch.quote || ''}
            onChange={(v) => save({ quote: v })}
            serif
            minRows={1}
            label="Frase destaque"
            placeholder="A frase que define esse personagem: a mais marcante, ou a que ele mais repete."
            className="text-lg sm:text-xl italic"
          />
        </div>
      </div>
    </section>
  );
}

// ------------------------------------------------------------------ cadernos
function Notebooks({ ch, save, name }: SecProps & { name: string }) {
  const [tab, setTab] = useState<'escritor' | 'voz'>('escritor');
  const diary = ch.diary || [];
  return (
    <section>
      <SectionHead id="cadernos" kicker="02" title="Cadernos" text="Um bloco para as suas ideias e um diário escrito pelo próprio personagem." />
      <div className={`${card} overflow-hidden`}>
        <div className="flex items-end justify-between gap-4 px-5 pt-4 border-b border-[var(--nb-line)]">
          <div className="flex gap-4" role="tablist">
            {(
              [
                ['escritor', 'Notas do escritor'],
                ['voz', 'Diário, na voz dele'],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={tab === id}
                onClick={() => setTab(id)}
                className={`pb-2.5 text-[13px] font-bold border-b-2 -mb-px transition-colors ${
                  tab === id ? 'border-[var(--nb-hl)] text-[var(--nb-ink)]' : 'border-transparent text-[var(--nb-ink-3)] hover:text-[var(--nb-ink)]'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <ArtNotebooks className="hidden sm:block w-24 -mb-1 text-[var(--nb-ink-3)]" />
        </div>

        <div className="p-5">
          {tab === 'escritor' ? (
            <RichField
              value={ch.notes || ''}
              onChange={(v) => save({ notes: v })}
              label="Notas do escritor"
              placeholder="A ideia inicial, uma frase solta, algo para usar mais tarde. Fique à vontade: é o seu bloco de notas."
              className="text-[14px]"
            />
          ) : (
            <DiaryBook diary={diary} characterName={name} onChange={(next, debounce) => save({ diary: next }, debounce)} />
          )}
        </div>
      </div>
    </section>
  );
}

// ------------------------------------------------------------------ perfis
function Profiles({ ch, save }: SecProps) {
  const [tab, setTab] = useState<(typeof PROFILES)[number]['id']>('physical');
  const p = PROFILES.find((x) => x.id === tab)!;
  return (
    <section>
      <SectionHead id="perfis" kicker="03" title="Os três perfis" text="O corpo, a mente e o ponto em que um revela o outro." />
      <div className={`${card} overflow-hidden`}>
        <div className="grid grid-cols-3 border-b border-[var(--nb-line)]" role="tablist">
          {PROFILES.map(({ id, label, Art }) => {
            const done = !!ch.profiles?.[id]?.trim();
            return (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={tab === id}
                onClick={() => setTab(id)}
                className={`relative flex flex-col items-center gap-1 pt-3 pb-2.5 transition-colors ${
                  tab === id ? 'bg-[var(--nb-pane-2)] text-[var(--nb-ink)]' : 'text-[var(--nb-ink-3)] hover:text-[var(--nb-ink)]'
                }`}
              >
                <Art className="w-20 sm:w-24" />
                <span className="flex items-center gap-1 text-[11px] sm:text-[12px] font-bold">
                  {label}
                  {done && <Check className="w-3 h-3 text-[var(--nb-hl)]" />}
                </span>
                {tab === id && <span className="absolute bottom-0 inset-x-6 h-0.5 rounded-full bg-[var(--nb-hl)]" />}
              </button>
            );
          })}
        </div>
        <div className="p-5">
          <RichField
            key={p.id}
            value={ch.profiles?.[p.id] || ''}
            onChange={(v) => save({ profiles: { ...ch.profiles, [p.id]: v } })}
            serif
            label={`Perfil ${p.label}`}
            placeholder={p.hint}
            className="text-[15px]"
          />
        </div>
      </div>
    </section>
  );
}

// ------------------------------------------------------------------ trajetória
function Trajectory({ ch, save }: SecProps) {
  const arc = ch.arc || {};
  const steps = [
    {
      id: 'start' as const,
      label: 'Início',
      hint: 'Como ele é quando a história começa.',
    },
    {
      id: 'turn' as const,
      label: 'Virada',
      hint: 'O que acontece e o obriga a mudar.',
    },
    {
      id: 'end' as const,
      label: 'Fim',
      hint: 'Quem ele se torna: melhor, pior ou só diferente.',
    },
  ];
  return (
    <section>
      <SectionHead id="trajetoria" kicker="04" title="Passado, presente e futuro" text="O que o moldou e para onde a história o leva." />
      <div className="grid gap-4">
        <div className={`${card} p-5 flex gap-5`}>
          <div className="min-w-0 flex-1">
            <h3 className="text-[13px] font-extrabold">Backstory</h3>
            <p className="text-[12px] text-[var(--nb-ink-3)] mb-2">O passado define como ele age ao longo da narrativa.</p>
            <RichField
              value={ch.backstory || ''}
              onChange={(v) => save({ backstory: v })}
              serif
              label="Backstory"
              placeholder="De onde ele vem, o que viveu, o que ninguém sabe…"
              className="text-[15px]"
            />
          </div>
          <ArtBackstory className="hidden sm:block w-28 shrink-0 self-start text-[var(--nb-ink-3)]" />
        </div>

        <div className={`${card} p-5`}>
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="text-[13px] font-extrabold">Arco</h3>
              <p className="text-[12px] text-[var(--nb-ink-3)]">Como ele muda no decorrer da história.</p>
            </div>
            <ArtArc className="w-28 shrink-0 text-[var(--nb-ink-3)]" />
          </div>
          <ol className="mt-4 grid sm:grid-cols-3 gap-4 sm:gap-3 relative">
            {steps.map((s, i) => (
              <li key={s.id} className="relative pl-6 sm:pl-0 sm:pt-6">
                {/* linha que liga os marcos */}
                {i < steps.length - 1 && (
                  <span
                    aria-hidden
                    className="absolute left-[7px] top-4 bottom-[-16px] w-px bg-[var(--nb-line)] sm:left-4 sm:right-[-12px] sm:top-[7px] sm:bottom-auto sm:w-auto sm:h-px"
                  />
                )}
                <span
                  aria-hidden
                  className={`absolute left-0 top-0.5 sm:top-0 w-[15px] h-[15px] rounded-full border-2 ${
                    arc[s.id]?.trim() ? 'bg-[var(--nb-hl)] border-[var(--nb-hl)]' : 'border-[var(--nb-line)] bg-[var(--nb-pane)]'
                  }`}
                />
                <p className="text-[11px] font-black uppercase tracking-wider text-[var(--nb-ink-2)]">
                  {i + 1}. {s.label}
                </p>
                <Grow
                  value={arc[s.id] || ''}
                  onChange={(v) => save({ arc: { ...arc, [s.id]: v } })}
                  minRows={3}
                  serif
                  label={`Arco: ${s.label}`}
                  placeholder={s.hint}
                  className="text-[14px] mt-1"
                />
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}

// ------------------------------------------------------------------ entrevista
function Interview({ ch, save }: SecProps) {
  const [open, setOpen] = useState<string | null>(null);
  const answers = ch.answers || {};
  const group = INTERVIEW.find((g) => g.id === open);

  return (
    <section>
      <SectionHead
        id="entrevista"
        kicker="05"
        title="Entrevista"
        text="Imagine o personagem sentado à sua frente. Coloque uma música, pense com calma e responda como ele responderia."
      />
      {group ? (
        <InterviewRun group={group} ch={ch} save={save} onClose={() => setOpen(null)} />
      ) : (
        <div className="grid sm:grid-cols-2 gap-3">
          {INTERVIEW.map((g, i) => {
            const qs = groupQuestions(g, ch);
            const done = qs.filter((q) => answers[q.id]?.trim()).length;
            return (
              <button
                key={g.id}
                type="button"
                onClick={() => setOpen(g.id)}
                className={`${card} group text-left p-4 flex items-center gap-4 hover:border-[var(--nb-hl)] transition-colors`}
              >
                <div className="relative grid place-items-center">
                  <Ring value={qs.length ? done / qs.length : 0} size={44} />
                  <span className="absolute text-[11px] font-black">{i + 1}</span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[14px] font-extrabold">{g.title}</p>
                  <p className="text-[12px] text-[var(--nb-ink-3)] line-clamp-2">{g.hint}</p>
                  <p className="mt-1 text-[11px] font-bold text-[var(--nb-ink-2)]">
                    {done}/{qs.length} · {done === 0 ? 'Começar' : done === qs.length ? 'Revisar' : 'Continuar'}
                  </p>
                </div>
                <ArrowRight className="w-4 h-4 text-[var(--nb-ink-3)] group-hover:text-[var(--nb-hl)] group-hover:translate-x-0.5 transition-transform" />
              </button>
            );
          })}
          <div className="sm:col-span-2 flex justify-center pt-2 text-[var(--nb-ink-3)]">
            <ArtInterview className="w-36 opacity-80" />
          </div>
        </div>
      )}
    </section>
  );
}

function InterviewRun({ group, ch, save, onClose }: SecProps & { group: InterviewGroup; onClose: () => void }) {
  const qs = groupQuestions(group, ch);
  const answers = ch.answers || {};
  // começa na primeira sem resposta
  const [i, setI] = useState(() => {
    const k = qs.findIndex((q) => !answers[q.id]?.trim());
    return k < 0 ? qs.length : k;
  });
  const [custom, setCustom] = useState('');
  const atEnd = i >= qs.length;
  const q = qs[i];
  const done = qs.filter((x) => answers[x.id]?.trim()).length;

  const go = (n: number) => setI(Math.max(0, Math.min(qs.length, n)));

  return (
    <div className={`${card} overflow-hidden`}>
      <div className="flex items-center gap-3 px-5 py-3 border-b border-[var(--nb-line)]">
        <button
          type="button"
          onClick={onClose}
          aria-label="Voltar aos grupos"
          className="p-1 -ml-1 rounded-md text-[var(--nb-ink-3)] hover:text-[var(--nb-ink)] hover:bg-[var(--nb-pane-2)]"
        >
          <X className="w-4 h-4" />
        </button>
        <p className="text-[13px] font-extrabold flex-1 truncate">{group.title}</p>
        <p className="text-[11px] font-bold text-[var(--nb-ink-3)] tabular-nums">{atEnd ? `${done}/${qs.length} respondidas` : `${i + 1} de ${qs.length}`}</p>
      </div>
      <div className="h-0.5 bg-[var(--nb-line)]">
        <div className="h-full bg-[var(--nb-hl)] transition-all duration-300" style={{ width: `${(Math.min(i, qs.length) / qs.length) * 100}%` }} />
      </div>

      {!atEnd && q ? (
        <div key={q.id} className="px-5 sm:px-10 py-8 sm:py-10 nb-cs-in">
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[var(--nb-hl)]">Pergunta {i + 1}</p>
          <h3 className="mt-2 text-xl sm:text-2xl font-semibold leading-snug" style={{ fontFamily: SERIF }}>
            {q.text}
          </h3>
          <div className="mt-6 rounded-xl bg-[var(--nb-pane-2)] px-4 py-3 border border-transparent focus-within:border-[var(--nb-hl)]">
            <Grow
              value={answers[q.id] || ''}
              onChange={(v) => save({ answers: { ...answers, [q.id]: v } })}
              autoFocus
              minRows={3}
              serif
              label="Resposta"
              placeholder="Responda como ele responderia…"
              className="text-[15px]"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                  e.preventDefault();
                  go(i + 1);
                }
              }}
            />
          </div>
          <div className="mt-5 flex items-center gap-2">
            <button
              type="button"
              disabled={i === 0}
              onClick={() => go(i - 1)}
              className="flex items-center gap-1 h-9 px-3 rounded-lg text-[12px] font-bold text-[var(--nb-ink-2)] hover:bg-[var(--nb-pane-2)] disabled:opacity-30"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Voltar
            </button>
            <span className="flex-1" />
            <span className="hidden sm:inline text-[11px] text-[var(--nb-ink-3)] mr-1">Ctrl+Enter avança</span>
            {!answers[q.id]?.trim() && (
              <button
                type="button"
                onClick={() => go(i + 1)}
                className="flex items-center gap-1 h-9 px-3 rounded-lg text-[12px] font-bold text-[var(--nb-ink-3)] hover:bg-[var(--nb-pane-2)]"
              >
                <SkipForward className="w-3.5 h-3.5" /> Pular
              </button>
            )}
            <button
              type="button"
              onClick={() => go(i + 1)}
              className="flex items-center gap-1 h-9 px-4 rounded-lg bg-[var(--nb-hl)] text-white text-[12px] font-bold hover:opacity-90"
            >
              {i === qs.length - 1 ? 'Concluir' : 'Próxima'} <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      ) : (
        <div className="px-5 sm:px-8 py-6 nb-cs-in">
          <div className="flex items-center gap-3 mb-5">
            <ArtInterview className="w-24 text-[var(--nb-ink-3)]" />
            <div>
              <p className="text-[15px] font-extrabold">{done === qs.length ? 'Entrevista completa' : 'Resumo da entrevista'}</p>
              <p className="text-[12px] text-[var(--nb-ink-3)]">Toque numa pergunta para responder ou editar.</p>
            </div>
          </div>
          <ol className="divide-y divide-[var(--nb-line)]">
            {qs.map((x, k) => {
              const a = answers[x.id]?.trim();
              const isCustom = !group.questions.some((g) => g.id === x.id);
              return (
                <li key={x.id} className="group flex items-start gap-3 py-3">
                  <button type="button" onClick={() => go(k)} className="flex-1 min-w-0 text-left">
                    <p className="text-[13px] font-semibold flex items-center gap-1.5">
                      {a ? (
                        <Check className="w-3.5 h-3.5 shrink-0 text-[var(--nb-hl)]" />
                      ) : (
                        <span className="w-3.5 h-3.5 shrink-0 rounded-full border border-[var(--nb-line)]" />
                      )}
                      {x.text}
                    </p>
                    {a && (
                      <p className="mt-1 ml-5 text-[13px] text-[var(--nb-ink-2)] line-clamp-2" style={{ fontFamily: SERIF }}>
                        {a}
                      </p>
                    )}
                  </button>
                  {isCustom && (
                    <button
                      type="button"
                      aria-label="Apagar pergunta"
                      onClick={() => {
                        const rest = { ...answers };
                        delete rest[x.id];
                        save(
                          {
                            custom: (ch.custom || []).filter((c) => c.id !== x.id),
                            answers: rest,
                          },
                          0
                        );
                      }}
                      className="opacity-0 group-hover:opacity-100 focus:opacity-100 p-1 rounded text-[var(--nb-ink-3)] hover:text-red-400"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </li>
              );
            })}
          </ol>
          <form
            className="mt-4 flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              const t = custom.trim();
              if (!t) return;
              save(
                {
                  custom: [
                    ...(ch.custom || []),
                    {
                      id: `x-${newId()}`,
                      group: group.id,
                      text: t.slice(0, 300),
                    },
                  ],
                },
                0
              );
              setCustom('');
            }}
          >
            <input
              value={custom}
              onChange={(e) => setCustom(e.target.value)}
              placeholder="Sua própria pergunta…"
              className="flex-1 h-9 px-3 rounded-lg bg-[var(--nb-pane-2)] border border-transparent focus:border-[var(--nb-hl)] outline-none text-[13px]"
            />
            <button
              type="submit"
              disabled={!custom.trim()}
              className="flex items-center gap-1 h-9 px-3 rounded-lg bg-[var(--nb-pane-2)] text-[12px] font-bold disabled:opacity-40 hover:text-[var(--nb-hl)]"
            >
              <Plus className="w-3.5 h-3.5" /> Adicionar
            </button>
          </form>
          <div className="mt-5 flex justify-end">
            <button
              type="button"
              onClick={onClose}
              className="flex items-center gap-1.5 h-9 px-4 rounded-lg bg-[var(--nb-hl)] text-white text-[12px] font-bold"
            >
              <NotebookPen className="w-3.5 h-3.5" /> Voltar à ficha
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
