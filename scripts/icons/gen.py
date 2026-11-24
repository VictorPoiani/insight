import sys, re, glob
sys.path.insert(0, sys.argv[1])
from defs import I, ALIASES
root = sys.argv[2]
used = set()
for f in glob.glob(root + '/src/**/*.ts*', recursive=True):
    s = open(f).read()
    for m in re.finditer(r"import\s*(type\s*)?\{([^}]*)\}\s*from\s*'@/components/icons'", s, re.S):
        for n in m.group(2).split(','):
            n = n.strip().split(' as ')[0].replace('type ', '').strip()
            if n: used.add(n)
missing = sorted(n for n in used if n not in I and n not in ALIASES)
if missing:
    print('FALTAM:', missing); sys.exit(1)
def jsx(m):
    return m.replace('stroke-dasharray', 'strokeDasharray')
out = ["""// Ícones do Insight* — desenhos próprios (viewBox 24, traço arredondado 1.75).
// Gerado a partir de scripts de desenho; mesmos nomes da antiga biblioteca para
// trocar o import sem mexer nos componentes.
import { forwardRef, type ForwardRefExoticComponent, type ReactNode, type RefAttributes, type SVGProps } from 'react';

export interface IconProps extends SVGProps<SVGSVGElement> {
  size?: number | string;
  strokeWidth?: number | string;
  /** compatibilidade: mantém a espessura do traço independente do tamanho */
  absoluteStrokeWidth?: boolean;
  color?: string;
}
export type InsightIcon = ForwardRefExoticComponent<IconProps & RefAttributes<SVGSVGElement>>;

function createIcon(name: string, body: ReactNode): InsightIcon {
  const Icon = forwardRef<SVGSVGElement, IconProps>(function Icon(
    { size = 24, strokeWidth = 1.75, absoluteStrokeWidth, color = 'currentColor', className, children, ...rest },
    ref
  ) {
    const sw = absoluteStrokeWidth ? (Number(strokeWidth) * 24) / Number(size) : strokeWidth;
    return (
      <svg
        ref={ref}
        xmlns="http://www.w3.org/2000/svg"
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke={color}
        strokeWidth={sw}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden={rest['aria-label'] ? undefined : true}
        className={className ? `ins-icon ins-icon-${name} ${className}` : `ins-icon ins-icon-${name}`}
        {...rest}
      >
        {body}
        {children}
      </svg>
    );
  });
  Icon.displayName = name;
  return Icon;
}
"""]
for n in sorted(I):
    out.append(f"export const {n} = createIcon('{n}', <>{jsx(I[n])}</>);")
for a, t in sorted(ALIASES.items()):
    out.append(f"export const {a} = {t};")
open(root + '/src/components/icons/index.tsx', 'w').write('\n'.join(out) + '\n')
print('ícones:', len(I), '+', len(ALIASES), 'apelidos; usados:', len(used))
