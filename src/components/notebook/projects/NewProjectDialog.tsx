'use client';

import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { PROJECT_TYPES, type ProjectType } from '@/lib/notebook/projects';
import { getTemplate } from '@/lib/notebook/templates';
import { Glyph } from '../icons/Glyph';

export interface NewProjectInput {
  name: string;
  type: ProjectType;
  description: string;
  starter: boolean;
}

/** Criação de projeto: nome, tipo e (opcional) estrutura inicial. */
export function NewProjectDialog({ onClose, onCreate }: { onClose: () => void; onCreate: (p: NewProjectInput) => void }) {
  const [name, setName] = useState('');
  const [type, setType] = useState<ProjectType>('livro');
  const [description, setDescription] = useState('');
  const [starter, setStarter] = useState(true);
  const def = PROJECT_TYPES.find((t) => t.id === type)!;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[70] grid place-items-center p-4 bg-black/55 backdrop-blur-sm" onMouseDown={onClose}>
      <form
        role="dialog"
        aria-label="Novo projeto"
        onMouseDown={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault();
          onCreate({ name: name.trim() || `Projeto de ${def.label.toLowerCase()}`, type, description: description.trim(), starter });
        }}
        className="w-full max-w-xl rounded-2xl border border-[var(--nb-line)] bg-[var(--nb-pane)] shadow-2xl nb-cs-in"
      >
        <div className="flex items-center justify-between px-5 pt-4">
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[var(--nb-hl)]">Novo projeto</p>
          <button type="button" aria-label="Fechar" onClick={onClose} className="p-1 rounded-md text-[var(--nb-ink-3)] hover:text-[var(--nb-ink)]">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="px-5 pb-5 space-y-4">
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value.slice(0, 120))}
            placeholder="Nome do projeto"
            aria-label="Nome do projeto"
            className="w-full bg-transparent text-2xl font-black tracking-tight outline-none placeholder:text-[var(--nb-ink-3)]"
          />
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2" role="radiogroup" aria-label="Tipo do projeto">
            {PROJECT_TYPES.map((t) => (
              <button
                key={t.id}
                type="button"
                role="radio"
                aria-checked={type === t.id}
                onClick={() => setType(t.id)}
                className={`flex items-center gap-2.5 p-2.5 rounded-xl border text-left transition-colors ${
                  type === t.id ? 'border-[var(--nb-hl)] bg-[var(--nb-hl-soft)]' : 'border-[var(--nb-line)] hover:border-[var(--nb-ink-3)]'
                }`}
              >
                <span className="w-8 h-8 shrink-0 grid place-items-center rounded-lg text-[17px]" style={{ color: t.color, background: `color-mix(in srgb, ${t.color} 14%, transparent)` }}>
                  <Glyph name={t.glyph} />
                </span>
                <span className="text-[13px] font-bold">{t.label}</span>
              </button>
            ))}
          </div>
          <p className="text-[12px] text-[var(--nb-ink-3)]">{def.pitch}</p>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value.slice(0, 600))}
            rows={2}
            placeholder="Descrição (opcional)"
            className="w-full resize-none rounded-xl bg-[var(--nb-bg)] border border-[var(--nb-line)] focus:border-[var(--nb-hl)] px-3 py-2 text-[13px] outline-none"
          />
          {def.starter.length > 0 && (
            <label className="flex items-start gap-2.5 text-[13px] cursor-pointer">
              <input type="checkbox" checked={starter} onChange={(e) => setStarter(e.target.checked)} className="mt-0.5 accent-[var(--nb-hl)]" />
              <span>
                <span className="font-semibold">Criar a estrutura inicial</span>
                <span className="block text-[12px] text-[var(--nb-ink-3)]">
                  {def.starter.map((s) => (s.template === 'folder' ? `seção ${s.title}` : s.title || getTemplate(s.template).name)).join(' · ')}
                </span>
              </span>
            </label>
          )}
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="h-9 px-4 rounded-lg text-[13px] font-bold text-[var(--nb-ink-2)] hover:bg-[var(--nb-pane-2)]">
              Cancelar
            </button>
            <button type="submit" className="h-9 px-4 rounded-lg bg-[var(--nb-hl)] text-white text-[13px] font-bold hover:opacity-90">
              Criar projeto
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
