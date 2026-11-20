/** Selo de conta verificada (e-mail confirmado). Ícone próprio. */
export function VerifiedBadge({ size = 16, className = '' }: { size?: number; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className={`inline-block shrink-0 ${className}`}
      role="img"
      aria-label="Conta verificada"
    >
      <title>Conta verificada</title>
      <path
        d="M12 1.8l2.4 1.9 3-.3 1 2.9 2.7 1.4-.6 3 1.7 2.5-2.2 2.1.1 3-2.9.9-1.4 2.7-3-.6L12 22.2l-2.4-1.9-3 .6-1.4-2.7-2.9-.9.1-3L.2 12.2l1.7-2.5-.6-3L4 5.3l1-2.9 3 .3z"
        fill="#1d9bf0"
      />
      <path d="M7.4 12.3l3 3 6.2-6.4" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
