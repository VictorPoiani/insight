/** Miniatura do Insight num Tema de App (usa os mesmos tokens do tema, em escopo). */
export function ThemeMiniature({ themeId, name, large = false }: { themeId: string; name: string; large?: boolean }) {
  const w = large ? 'w-full max-w-[420px]' : 'w-[88%]';
  return (
    <div
      data-nt-scope={themeId}
      aria-hidden
      className={`${w} aspect-[16/10] rounded-xl border border-border overflow-hidden flex text-[0px] shadow-lg`}
    >
      {/* barra lateral */}
      <div className="w-[22%] h-full p-[6%] flex flex-col gap-[8%]" style={{ background: 'var(--background)' }}>
        <span className="block h-[9%] w-[70%] rounded-full" style={{ background: 'var(--primary)', opacity: 0.85 }} />
        {[0, 1, 2, 3].map((i) => (
          <span
            key={i}
            className="block h-[7%] rounded-full"
            style={{ width: `${80 - i * 12}%`, background: i === 0 ? 'var(--accent)' : 'var(--muted)', opacity: i === 0 ? 1 : 0.5 }}
          />
        ))}
      </div>
      {/* conteúdo */}
      <div className="flex-1 h-full p-[4%] flex flex-col gap-[5%]">
        <div className="rounded-lg p-[4%] flex items-center gap-[4%] border border-border" style={{ background: 'var(--surface)' }}>
          <span className="block aspect-square w-[14%] rounded-full" style={{ background: 'var(--accent)' }} />
          <span className="flex-1 flex flex-col gap-[6px]">
            <span className={`${large ? 'text-[11px]' : 'text-[8px]'} font-bold leading-none truncate`} style={{ color: 'var(--primary)' }}>
              {name}
            </span>
            <span className="block h-[4px] w-[60%] rounded-full" style={{ background: 'var(--secondary)', opacity: 0.6 }} />
          </span>
        </div>
        <div className="flex-1 rounded-lg p-[4%] flex flex-col gap-[8%] border border-border" style={{ background: 'var(--surface)' }}>
          {[90, 70, 82].map((v, i) => (
            <span key={i} className="block h-[8%] rounded-full" style={{ width: `${v}%`, background: 'var(--secondary)', opacity: 0.45 }} />
          ))}
          <span className="mt-auto self-end block h-[16%] w-[34%] rounded-full" style={{ background: 'var(--accent)' }} />
        </div>
      </div>
    </div>
  );
}
