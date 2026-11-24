// Ícones do Insight* — desenhos próprios (viewBox 24, traço arredondado 1.75).
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

export const Activity = createIcon('Activity', <><path d="M3 12h3.5l2.5-7 5 14 2.5-7H21"/></>);
export const AlertTriangle = createIcon('AlertTriangle', <><path d="M10.3 4.3a2 2 0 0 1 3.4 0l7.5 13a2 2 0 0 1-1.7 3H4.5a2 2 0 0 1-1.7-3Z"/><path d="M12 9.5v4"/><circle cx="12" cy="16.8" r="1.15" fill="currentColor" stroke="none"/></>);
export const AlignCenter = createIcon('AlignCenter', <><path d="M4 6h16"/><path d="M7 12h10"/><path d="M5.5 18h13"/></>);
export const AlignLeft = createIcon('AlignLeft', <><path d="M4 6h16"/><path d="M4 12h10"/><path d="M4 18h13"/></>);
export const AlignRight = createIcon('AlignRight', <><path d="M4 6h16"/><path d="M10 12h10"/><path d="M7 18h13"/></>);
export const Apple = createIcon('Apple', <><path d="M12 7.5c-1.5-1-3-1.2-4.5-.7C5 7.6 4 10 4.5 13c.6 3.8 3 7.5 5.5 7.5.8 0 1.2-.5 2-.5s1.2.5 2 .5c2.5 0 4.9-3.7 5.5-7.5.5-3-.5-5.4-3-6.2-1.5-.5-3-.3-4.5.7Z"/><path d="M12 7.5c0-2 1-3.8 3-4.5"/></>);
export const ArrowDown = createIcon('ArrowDown', <><path d="M12 4.5V19"/><path d="M6.5 13.5 12 19l5.5-5.5"/></>);
export const ArrowDownAZ = createIcon('ArrowDownAZ', <><path d="M7 4v15.5"/><path d="M3.8 16.3 7 19.5l3.2-3.2"/><path d="M13.8 10.5l2.7-6.5 2.7 6.5"/><path d="M14.8 8.3h3.4"/><path d="M14 13.5h5.2L14 19.8h5.2"/></>);
export const ArrowLeft = createIcon('ArrowLeft', <><path d="M19.5 12H5"/><path d="M10.5 6.5 5 12l5.5 5.5"/></>);
export const ArrowRight = createIcon('ArrowRight', <><path d="M4.5 12H19"/><path d="M13.5 6.5 19 12l-5.5 5.5"/></>);
export const ArrowUp = createIcon('ArrowUp', <><path d="M12 19.5V5"/><path d="M6.5 10.5 12 5l5.5 5.5"/></>);
export const ArrowUpRight = createIcon('ArrowUpRight', <><path d="M6.5 17.5 17 7"/><path d="M8.5 6.5H17.5V15.5"/></>);
export const AtSign = createIcon('AtSign', <><circle cx="12" cy="12" r="3.6"/><path d="M15.6 8.5v4.7a2.6 2.6 0 0 0 5.2 0V12a8.8 8.8 0 1 0-3.5 7"/></>);
export const Atom = createIcon('Atom', <><circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none"/><ellipse cx="12" cy="12" rx="9.5" ry="3.8"/><ellipse cx="12" cy="12" rx="9.5" ry="3.8" transform="rotate(60 12 12)"/><ellipse cx="12" cy="12" rx="9.5" ry="3.8" transform="rotate(-60 12 12)"/></>);
export const Award = createIcon('Award', <><circle cx="12" cy="9" r="5.5"/><path d="M8.6 13.4 7 21l5-2.5 5 2.5-1.6-7.6"/></>);
export const BarChart3 = createIcon('BarChart3', <><path d="M4 4v14.5A1.5 1.5 0 0 0 5.5 20H20"/><path d="M8.5 16v-4"/><path d="M12.5 16V8"/><path d="M16.5 16v-6"/></>);
export const Beef = createIcon('Beef', <><circle cx="14.5" cy="9.5" r="6"/><path d="M10.3 13.7 6.6 17.4"/><path d="M12.3 7.6a3 3 0 0 1 4.2 0"/><circle cx="5.4" cy="16.2" r="1.6"/><circle cx="7.8" cy="18.6" r="1.6"/></>);
export const Bell = createIcon('Bell', <><path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.6 2.2H4.4Z"/><path d="M10.2 21.2a2 2 0 0 0 3.6 0"/></>);
export const BellPlus = createIcon('BellPlus', <><path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.6 2.2H4.4Z"/><path d="M10.2 21.2a2 2 0 0 0 3.6 0"/><path d="M19 2.5v4.5"/><path d="M16.8 4.8h4.5"/></>);
export const BellRing = createIcon('BellRing', <><path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.6 2.2H4.4Z"/><path d="M10.2 21.2a2 2 0 0 0 3.6 0"/><path d="M2.8 8a8 8 0 0 1 2.4-4"/><path d="M21.2 8a8 8 0 0 0-2.4-4"/></>);
export const Binary = createIcon('Binary', <><path d="M5.5 5.5 7 4.5v6"/><path d="M5.5 10.5h3"/><path d="M15 14.5l1.5-1v6"/><path d="M15 19.5h3"/><rect x="14.5" y="4.5" width="4" height="6" rx="2"/><rect x="5" y="13.5" width="4" height="6" rx="2"/></>);
export const Bold = createIcon('Bold', <><path d="M7 4.5h5.5a3.75 3.75 0 0 1 0 7.5H7Z"/><path d="M7 12h6.5a4 4 0 0 1 0 8H7Z"/></>);
export const Bolt = createIcon('Bolt', <><path d="M12 2.8l8 4.6v9.2l-8 4.6-8-4.6V7.4Z"/><circle cx="12" cy="12" r="3.2"/></>);
export const BookOpen = createIcon('BookOpen', <><path d="M12 6.5C10.2 4.9 7.7 4 3.5 4v13.5c4.2 0 6.7.9 8.5 2.5 1.8-1.6 4.3-2.5 8.5-2.5V4c-4.2 0-6.7.9-8.5 2.5Z"/><path d="M12 6.5V20"/></>);
export const BookOpenText = createIcon('BookOpenText', <><path d="M12 6.5C10.2 4.9 7.7 4 3.5 4v13.5c4.2 0 6.7.9 8.5 2.5 1.8-1.6 4.3-2.5 8.5-2.5V4c-4.2 0-6.7.9-8.5 2.5Z"/><path d="M12 6.5V20"/><path d="M6.5 8.5H9"/><path d="M6.5 12H9"/><path d="M15 8.5h2.5"/><path d="M15 12h2.5"/></>);
export const BookPlus = createIcon('BookPlus', <><path d="M4.5 19V5.5a2 2 0 0 1 2-2h13v14h-13a2 2 0 0 0 0 4h13"/><path d="M12 7.5v6"/><path d="M9 10.5h6"/></>);
export const BoxSelect = createIcon('BoxSelect', <><rect x="4" y="4" width="16" height="16" rx="3.5" strokeDasharray="3.2 3"/></>);
export const Boxes = createIcon('Boxes', <><rect x="3.5" y="12.5" width="7.5" height="7.5" rx="2"/><rect x="13" y="12.5" width="7.5" height="7.5" rx="2"/><rect x="8.25" y="3.5" width="7.5" height="7.5" rx="2"/></>);
export const Brackets = createIcon('Brackets', <><path d="M8 4H6a1.5 1.5 0 0 0-1.5 1.5v13A1.5 1.5 0 0 0 6 20h2"/><path d="M16 4h2a1.5 1.5 0 0 1 1.5 1.5v13A1.5 1.5 0 0 1 18 20h-2"/></>);
export const Brain = createIcon('Brain', <><path d="M12 5a3 3 0 0 0-5.6-1.4A3 3 0 0 0 4 7.5a3.2 3.2 0 0 0-.8 5.5A3.5 3.5 0 0 0 7 18.5a3 3 0 0 0 5 1.5Z"/><path d="M12 5a3 3 0 0 1 5.6-1.4A3 3 0 0 1 20 7.5a3.2 3.2 0 0 1 .8 5.5 3.5 3.5 0 0 1-3.8 5.5 3 3 0 0 1-5 1.5Z"/><path d="M12 5v15"/><path d="M8 9.5a2 2 0 0 0 2 1.5"/><path d="M16 9.5a2 2 0 0 1-2 1.5"/><path d="M7.5 14.5h2"/><path d="M16.5 14.5h-2"/></>);
export const Briefcase = createIcon('Briefcase', <><rect x="3" y="7" width="18" height="13" rx="3"/><path d="M8.5 7V5.5a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2V7"/><path d="M3 12.5h18"/></>);
export const Building2 = createIcon('Building2', <><path d="M5 21V5a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2v16"/><path d="M16 9h3a2 2 0 0 1 2 2v10"/><path d="M3 21h18"/><path d="M8.5 7.5h4"/><path d="M8.5 11.5h4"/><path d="M8.5 15.5h4"/></>);
export const Cake = createIcon('Cake', <><path d="M4 20.5h16"/><path d="M5 20.5v-6A2.5 2.5 0 0 1 7.5 12h9a2.5 2.5 0 0 1 2.5 2.5v6"/><path d="M5 16c1.2 1 2.6 1 3.5 0s2.3-1 3.5 0 2.3 1 3.5 0 2.3-1 3.5 0"/><path d="M12 12V8.5"/><path d="M12 6.5c-.9-.8-1-2.2 0-3.5 1 1.3.9 2.7 0 3.5Z"/></>);
export const Calendar = createIcon('Calendar', <><rect x="3.5" y="5" width="17" height="15.5" rx="3.5"/><path d="M3.5 10h17"/><path d="M8 3v4"/><path d="M16 3v4"/></>);
export const CalendarDays = createIcon('CalendarDays', <><rect x="3.5" y="5" width="17" height="15.5" rx="3.5"/><path d="M3.5 10h17"/><path d="M8 3v4"/><path d="M16 3v4"/><circle cx="8" cy="14" r="1" fill="currentColor" stroke="none"/><circle cx="12" cy="14" r="1" fill="currentColor" stroke="none"/><circle cx="16" cy="14" r="1" fill="currentColor" stroke="none"/><circle cx="8" cy="17.3" r="1" fill="currentColor" stroke="none"/><circle cx="12" cy="17.3" r="1" fill="currentColor" stroke="none"/></>);
export const Check = createIcon('Check', <><path d="M5 12.5 9.5 17 19 7.5"/></>);
export const CheckCheck = createIcon('CheckCheck', <><path d="M2.5 12.5 6.5 16.5 15 8"/><path d="M11.2 15.2l1.3 1.3L21.5 7.5"/></>);
export const CheckCircle2 = createIcon('CheckCircle2', <><circle cx="12" cy="12" r="9"/><path d="M8.3 12.3l2.6 2.6 5-5.2"/></>);
export const CheckSquare = createIcon('CheckSquare', <><rect x="3.5" y="3.5" width="17" height="17" rx="4"/><path d="M8 12.2l2.8 2.8L16.3 9.2"/></>);
export const ChevronDown = createIcon('ChevronDown', <><path d="M6.5 9.5 12 15l5.5-5.5"/></>);
export const ChevronLeft = createIcon('ChevronLeft', <><path d="M14.5 6.5 9 12l5.5 5.5"/></>);
export const ChevronRight = createIcon('ChevronRight', <><path d="M9.5 6.5 15 12l-5.5 5.5"/></>);
export const ChevronUp = createIcon('ChevronUp', <><path d="M6.5 14.5 12 9l5.5 5.5"/></>);
export const Clapperboard = createIcon('Clapperboard', <><path d="M3.5 10.2h17V18a2.5 2.5 0 0 1-2.5 2.5H6A2.5 2.5 0 0 1 3.5 18Z"/><path d="M3.6 10.2 3 7.4a2 2 0 0 1 1.5-2.4l12.2-2.6a2 2 0 0 1 2.4 1.5l.6 2.6Z"/><path d="M7.9 4.8l2.3 3.3"/><path d="M12.7 3.8 15 7.1"/></>);
export const Clock = createIcon('Clock', <><circle cx="12" cy="12" r="9"/><path d="M12 7.5V12l3 2"/></>);
export const Clock3 = createIcon('Clock3', <><circle cx="12" cy="12" r="9"/><path d="M12 7v5h4"/></>);
export const CloudOff = createIcon('CloudOff', <><path d="M17.5 18H7a4.5 4.5 0 0 1-1.3-8.8"/><path d="M9 6.4A6 6 0 0 1 18.4 10H18a3.5 3.5 0 0 1 3 5.3"/><path d="M3 3l18 18"/></>);
export const Code = createIcon('Code', <><path d="M8.5 7 3.5 12l5 5"/><path d="M15.5 7l5 5-5 5"/></>);
export const Code2 = createIcon('Code2', <><path d="M8.5 7 3.5 12l5 5"/><path d="M15.5 7l5 5-5 5"/><path d="M13.5 4.5l-3 15"/></>);
export const Coffee = createIcon('Coffee', <><path d="M4.5 9.5h12v5a5 5 0 0 1-5 5h-2a5 5 0 0 1-5-5Z"/><path d="M16.5 10.5H18a2.5 2.5 0 0 1 0 5h-1.6"/><path d="M8 2.5v3"/><path d="M11.5 2.5v3"/></>);
export const Columns2 = createIcon('Columns2', <><rect x="3.5" y="3.5" width="17" height="17" rx="4"/><path d="M12 3.5v17"/></>);
export const Command = createIcon('Command', <><rect x="9" y="9" width="6" height="6" rx="0.8"/><path d="M9 9H6.5A2.5 2.5 0 1 1 9 6.5Z"/><path d="M15 9V6.5A2.5 2.5 0 1 1 17.5 9Z"/><path d="M15 15h2.5a2.5 2.5 0 1 1-2.5 2.5Z"/><path d="M9 15v2.5A2.5 2.5 0 1 1 6.5 15Z"/></>);
export const Compass = createIcon('Compass', <><circle cx="12" cy="12" r="9"/><path d="M15.8 8.2l-2 5.6-5.6 2 2-5.6Z"/></>);
export const Cookie = createIcon('Cookie', <><path d="M20.5 12A8.5 8.5 0 1 1 12 3.5a3 3 0 0 0 4 4 3 3 0 0 0 4.5 4.5Z"/><circle cx="8.5" cy="10" r="1" fill="currentColor" stroke="none"/><circle cx="9.5" cy="15" r="1" fill="currentColor" stroke="none"/><circle cx="14.5" cy="15.5" r="1" fill="currentColor" stroke="none"/><circle cx="12.5" cy="11.5" r="1" fill="currentColor" stroke="none"/></>);
export const Copy = createIcon('Copy', <><rect x="8.5" y="8.5" width="12" height="12" rx="3"/><path d="M15.5 8.5V6A2.5 2.5 0 0 0 13 3.5H6A2.5 2.5 0 0 0 3.5 6v7A2.5 2.5 0 0 0 6 15.5h2.5"/></>);
export const CornerDownLeft = createIcon('CornerDownLeft', <><path d="M19.5 4.5v6a4.5 4.5 0 0 1-4.5 4.5H5"/><path d="M9 11 5 15l4 4"/></>);
export const CornerLeftUp = createIcon('CornerLeftUp', <><path d="M19.5 19.5H14A4.5 4.5 0 0 1 9.5 15V5"/><path d="M5.5 9l4-4 4 4"/></>);
export const Cpu = createIcon('Cpu', <><rect x="6" y="6" width="12" height="12" rx="3"/><rect x="9.5" y="9.5" width="5" height="5" rx="1"/><path d="M9.5 2.5v3"/><path d="M14.5 2.5v3"/><path d="M9.5 18.5v3"/><path d="M14.5 18.5v3"/><path d="M2.5 9.5h3"/><path d="M2.5 14.5h3"/><path d="M18.5 9.5h3"/><path d="M18.5 14.5h3"/></>);
export const Crosshair = createIcon('Crosshair', <><circle cx="12" cy="12" r="8.5"/><path d="M12 2.5v4"/><path d="M12 17.5v4"/><path d="M2.5 12h4"/><path d="M17.5 12h4"/><circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="none"/></>);
export const Crown = createIcon('Crown', <><path d="M3.5 8 7.5 12 12 5l4.5 7 4-4-1.8 10.5H5.3Z"/><path d="M5.5 21h13"/></>);
export const Database = createIcon('Database', <><ellipse cx="12" cy="6" rx="7.5" ry="2.8"/><path d="M4.5 6v12c0 1.5 3.4 2.8 7.5 2.8s7.5-1.3 7.5-2.8V6"/><path d="M4.5 12c0 1.5 3.4 2.8 7.5 2.8s7.5-1.3 7.5-2.8"/></>);
export const Download = createIcon('Download', <><path d="M12 3.5v11.5"/><path d="M7.5 10.5 12 15l4.5-4.5"/><path d="M4 16v1.5A2.5 2.5 0 0 0 6.5 20h11a2.5 2.5 0 0 0 2.5-2.5V16"/></>);
export const Droplets = createIcon('Droplets', <><path d="M16 21a4.5 4.5 0 0 1-4.5-4.5c0-2.6 2.4-4.9 4.5-8 2.1 3.1 4.5 5.4 4.5 8A4.5 4.5 0 0 1 16 21Z"/><path d="M7 13.5a3 3 0 0 1-3-3c0-1.7 1.5-3.1 3-5.5 1.5 2.4 3 3.8 3 5.5a3 3 0 0 1-3 3Z"/></>);
export const Eraser = createIcon('Eraser', <><path d="M7.5 20.5h12"/><path d="M4.8 15.4a2 2 0 0 1 0-2.8l8.4-8.4a2 2 0 0 1 2.8 0l3.8 3.8a2 2 0 0 1 0 2.8L11.5 19a2 2 0 0 1-1.4.6H8.6a2 2 0 0 1-1.4-.6Z"/><path d="M9.5 9l5.5 5.5"/></>);
export const ExternalLink = createIcon('ExternalLink', <><path d="M14 3.8h6.2V10"/><path d="M20 4l-8.5 8.5"/><path d="M18 14v3.5A2.5 2.5 0 0 1 15.5 20h-9A2.5 2.5 0 0 1 4 17.5v-9A2.5 2.5 0 0 1 6.5 6H10"/></>);
export const Eye = createIcon('Eye', <><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z"/><circle cx="12" cy="12" r="3"/></>);
export const EyeOff = createIcon('EyeOff', <><path d="M10 5.7a9.8 9.8 0 0 1 2-.2c6 0 9.5 6.5 9.5 6.5a17 17 0 0 1-2.3 3.2"/><path d="M6.6 6.7C4 8.4 2.5 12 2.5 12S6 18.5 12 18.5a9.3 9.3 0 0 0 5.3-1.7"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/><path d="M3 3l18 18"/></>);
export const Feather = createIcon('Feather', <><path d="M20.2 3.8C13 4 8 8 7.2 14.8L6 20.5"/><path d="M20.2 3.8c-.3 7-4.3 11.7-11.3 12.2"/><path d="M9.2 12.5h5.5"/></>);
export const FileCheck = createIcon('FileCheck', <><path d="M14 3.5H7.5A2.5 2.5 0 0 0 5 6v12a2.5 2.5 0 0 0 2.5 2.5h9A2.5 2.5 0 0 0 19 18V8.5Z"/><path d="M14 3.5v3.3A1.7 1.7 0 0 0 15.7 8.5H19"/><path d="M9 14.5l2 2 4-4"/></>);
export const FilePlus2 = createIcon('FilePlus2', <><path d="M14 3.5H7.5A2.5 2.5 0 0 0 5 6v12a2.5 2.5 0 0 0 2.5 2.5h9A2.5 2.5 0 0 0 19 18V8.5Z"/><path d="M14 3.5v3.3A1.7 1.7 0 0 0 15.7 8.5H19"/><path d="M12 11.5v6"/><path d="M9 14.5h6"/></>);
export const FileText = createIcon('FileText', <><path d="M14 3.5H7.5A2.5 2.5 0 0 0 5 6v12a2.5 2.5 0 0 0 2.5 2.5h9A2.5 2.5 0 0 0 19 18V8.5Z"/><path d="M14 3.5v3.3A1.7 1.7 0 0 0 15.7 8.5H19"/><path d="M9 13h6"/><path d="M9 16.5h4"/></>);
export const Files = createIcon('Files', <><path d="M8 6.5V5a2 2 0 0 1 2-2h5.5L20 7.5V16a2 2 0 0 1-2 2h-1.5"/><path d="M4 9a2 2 0 0 1 2-2h5.5l4.5 4.5V19a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2Z"/></>);
export const Film = createIcon('Film', <><rect x="3.5" y="3.5" width="17" height="17" rx="4"/><path d="M8 3.5v17"/><path d="M16 3.5v17"/><path d="M3.5 12h17"/><path d="M3.5 7.8H8"/><path d="M3.5 16.2H8"/><path d="M16 7.8h4.5"/><path d="M16 16.2h4.5"/></>);
export const Flag = createIcon('Flag', <><path d="M5 21V4"/><path d="M5 4.5c4.5-2.5 7.5 2.5 14 0v9c-6.5 2.5-9.5-2.5-14 0"/></>);
export const Flame = createIcon('Flame', <><path d="M12 21.5a7 7 0 0 1-7-7c0-3.3 2-5.4 3.5-7 .3 2 1.2 3 2.5 3.5C11 7 12.5 4.5 14.5 2.5c.6 3 2.2 4.6 3.6 6.4A7 7 0 0 1 12 21.5Z"/><path d="M12 21.5a3 3 0 0 1-3-3c0-1.8 1.6-2.8 3-4.5 1.4 1.7 3 2.7 3 4.5a3 3 0 0 1-3 3Z"/></>);
export const Focus = createIcon('Focus', <><path d="M4 9V6.5A2.5 2.5 0 0 1 6.5 4H9"/><path d="M15 4h2.5A2.5 2.5 0 0 1 20 6.5V9"/><path d="M20 15v2.5a2.5 2.5 0 0 1-2.5 2.5H15"/><path d="M9 20H6.5A2.5 2.5 0 0 1 4 17.5V15"/><circle cx="12" cy="12" r="3"/></>);
export const FolderPlus = createIcon('FolderPlus', <><path d="M3.5 7A2.5 2.5 0 0 1 6 4.5h3.6l2 2.5H18a2.5 2.5 0 0 1 2.5 2.5V17a2.5 2.5 0 0 1-2.5 2.5H6A2.5 2.5 0 0 1 3.5 17Z"/><path d="M12 10.5v6"/><path d="M9 13.5h6"/></>);
export const FolderTree = createIcon('FolderTree', <><rect x="12" y="3.5" width="9" height="6" rx="1.5"/><rect x="12" y="14.5" width="9" height="6" rx="1.5"/><path d="M3.5 3.5v11a3 3 0 0 0 3 3H12"/><path d="M3.5 6.5a3 3 0 0 0 3 3H12"/></>);
export const Gamepad2 = createIcon('Gamepad2', <><path d="M6.5 7h11a4.5 4.5 0 0 1 4.4 5.4l-.8 4a3 3 0 0 1-5.1 1.4L14.5 16h-5L8 17.8a3 3 0 0 1-5.1-1.4l-.8-4A4.5 4.5 0 0 1 6.5 7Z"/><path d="M7.5 10v4"/><path d="M5.5 12h4"/><circle cx="15.5" cy="11" r="1" fill="currentColor" stroke="none"/><circle cx="17.7" cy="13.2" r="1" fill="currentColor" stroke="none"/></>);
export const Gem = createIcon('Gem', <><path d="M6.5 4h11L21 9l-9 11L3 9Z"/><path d="M3 9h18"/><path d="M9.5 4 8 9l4 11 4-11-1.5-5"/></>);
export const Gift = createIcon('Gift', <><rect x="3.5" y="8" width="17" height="4" rx="1.2"/><path d="M5 12v6.5A2 2 0 0 0 7 20.5h10a2 2 0 0 0 2-2V12"/><path d="M12 8v12.5"/><path d="M12 8C10.5 4 7 3.3 6.5 5.5 6.1 7.3 9 8 12 8Zm0 0c1.5-4 5-4.7 5.5-2.5.4 1.8-2.5 2.5-5.5 2.5Z"/></>);
export const GitBranch = createIcon('GitBranch', <><circle cx="6" cy="6" r="2.4"/><circle cx="6" cy="18" r="2.4"/><circle cx="18" cy="7" r="2.4"/><path d="M6 8.4v7.2"/><path d="M18 9.4a6 6 0 0 1-6 6H8.4"/></>);
export const Github = createIcon('Github', <><path d="M9 19.5c-4 1.3-4-2-5.5-2.5"/><path d="M15 21.5v-3.4a3 3 0 0 0-.8-2.3c2.8-.3 5.8-1.4 5.8-6.2a4.8 4.8 0 0 0-1.3-3.3 4.5 4.5 0 0 0-.1-3.3s-1-.3-3.4 1.3a11.7 11.7 0 0 0-6.2 0C7.4 2.9 6.4 3.2 6.4 3.2a4.5 4.5 0 0 0-.1 3.3A4.8 4.8 0 0 0 5 9.8c0 4.8 2.9 5.9 5.7 6.2a3 3 0 0 0-.8 2.2v3.4"/></>);
export const Globe = createIcon('Globe', <><circle cx="12" cy="12" r="9"/><path d="M3 12h18"/><path d="M12 3a13.5 13.5 0 0 1 0 18"/><path d="M12 3a13.5 13.5 0 0 0 0 18"/></>);
export const GraduationCap = createIcon('GraduationCap', <><path d="M2.5 9 12 4.5 21.5 9 12 13.5Z"/><path d="M6.5 11v4.5c0 1.5 2.5 3 5.5 3s5.5-1.5 5.5-3V11"/><path d="M21.5 9v5.5"/></>);
export const Grid = createIcon('Grid', <><rect x="3.5" y="3.5" width="17" height="17" rx="4"/><path d="M3.5 9.2h17"/><path d="M3.5 14.8h17"/><path d="M9.2 3.5v17"/><path d="M14.8 3.5v17"/></>);
export const GripVertical = createIcon('GripVertical', <><circle cx="9" cy="6" r="1.35" fill="currentColor" stroke="none"/><circle cx="15" cy="6" r="1.35" fill="currentColor" stroke="none"/><circle cx="9" cy="12" r="1.35" fill="currentColor" stroke="none"/><circle cx="15" cy="12" r="1.35" fill="currentColor" stroke="none"/><circle cx="9" cy="18" r="1.35" fill="currentColor" stroke="none"/><circle cx="15" cy="18" r="1.35" fill="currentColor" stroke="none"/></>);
export const Guitar = createIcon('Guitar', <><path d="M20.5 3.5 13 11"/><path d="M18.5 2.5l3 3"/><path d="M13.6 10.4a3.8 3.8 0 0 0-4.4-.6 3 3 0 0 1-2.1.4 4.2 4.2 0 0 0-3.8 6.4l1.6 1.6a4.2 4.2 0 0 0 6.4-3.8 3 3 0 0 1 .4-2.1 3.8 3.8 0 0 0-.6-4.4"/><circle cx="9" cy="15" r="1.1" fill="currentColor" stroke="none"/></>);
export const Hash = createIcon('Hash', <><path d="M9.8 3.5 7.8 20.5"/><path d="M16.2 3.5l-2 17"/><path d="M4.5 9h16"/><path d="M3.5 15h16"/></>);
export const Heading1 = createIcon('Heading1', <><path d="M4 5v14"/><path d="M12 5v14"/><path d="M4 12h8"/><path d="M16.5 10 19 8.5V19"/></>);
export const Heading2 = createIcon('Heading2', <><path d="M4 5v14"/><path d="M12 5v14"/><path d="M4 12h8"/><path d="M15.5 10.5a2.5 2.5 0 0 1 5 .3c0 1.7-5 4.5-5 8.2h5"/></>);
export const Heading3 = createIcon('Heading3', <><path d="M4 5v14"/><path d="M12 5v14"/><path d="M4 12h8"/><path d="M15.5 9h4.5l-2.6 3.3a2.9 2.9 0 1 1-2 5"/></>);
export const Headphones = createIcon('Headphones', <><path d="M3.5 18v-5.5a8.5 8.5 0 0 1 17 0V18"/><rect x="3.5" y="13.5" width="4.5" height="7" rx="1.8"/><rect x="16" y="13.5" width="4.5" height="7" rx="1.8"/></>);
export const Headset = createIcon('Headset', <><path d="M3.5 16v-3.5a8.5 8.5 0 0 1 17 0V16"/><path d="M20.5 16v1.5a3.5 3.5 0 0 1-3.5 3.5h-3.5"/><rect x="3.5" y="12" width="4.5" height="6.5" rx="1.8"/><rect x="16" y="12" width="4.5" height="6.5" rx="1.8"/></>);
export const Heart = createIcon('Heart', <><path d="M12 20s-8.5-5-8.5-10.8A4.7 4.7 0 0 1 8.2 4.5 4.9 4.9 0 0 1 12 6.4a4.9 4.9 0 0 1 3.8-1.9 4.7 4.7 0 0 1 4.7 4.7C20.5 15 12 20 12 20Z"/></>);
export const Hexagon = createIcon('Hexagon', <><path d="M12 2.8l8 4.6v9.2l-8 4.6-8-4.6V7.4Z"/></>);
export const Highlighter = createIcon('Highlighter', <><path d="M9 11l-5.5 5.5V20H7l5.5-5.5"/><path d="M8.8 10.8l5.2-5.2a2 2 0 0 1 2.8 0l1.6 1.6a2 2 0 0 1 0 2.8l-5.2 5.2Z"/><path d="M14 20.5h6"/></>);
export const History = createIcon('History', <><path d="M3.5 12a8.5 8.5 0 1 0 2.5-6L3.5 8.5"/><path d="M3.5 4v4.5H8"/><path d="M12 8v4l3 2"/></>);
export const House = createIcon('House', <><path d="M4 10.5 12 4l8 6.5V18a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 18Z"/><path d="M9.5 20.5v-5a2.5 2.5 0 0 1 5 0v5"/></>);
export const Image = createIcon('Image', <><rect x="3.5" y="4" width="17" height="16" rx="3.5"/><circle cx="9" cy="9.5" r="1.8"/><path d="M20.5 15.3l-4.4-4.4a1.6 1.6 0 0 0-2.3 0L5.2 19.5"/></>);
export const ImagePlus = createIcon('ImagePlus', <><path d="M13.5 4H7A3.5 3.5 0 0 0 3.5 7.5v9A3.5 3.5 0 0 0 7 20h10a3.5 3.5 0 0 0 3.5-3.5V12"/><path d="M18 3v6"/><path d="M15 6h6"/><path d="M20.5 16l-4.4-4.2a1.6 1.6 0 0 0-2.2 0L5.2 19.6"/><circle cx="9" cy="10" r="1.6"/></>);
export const Info = createIcon('Info', <><circle cx="12" cy="12" r="9"/><path d="M12 11v5.5"/><circle cx="12" cy="7.8" r="1.2" fill="currentColor" stroke="none"/></>);
export const Italic = createIcon('Italic', <><path d="M10 4.5h8"/><path d="M6 19.5h8"/><path d="M14.5 4.5l-5 15"/></>);
export const Kanban = createIcon('Kanban', <><rect x="3.5" y="3.5" width="17" height="17" rx="4"/><path d="M8 8v5"/><path d="M12 8v8"/><path d="M16 8v3"/></>);
export const KeyRound = createIcon('KeyRound', <><circle cx="15" cy="9" r="5.5"/><path d="M11 13l-8.5 8.5"/><path d="M6.5 17.5l2 2"/><circle cx="16.5" cy="7.5" r="1.2" fill="currentColor" stroke="none"/></>);
export const Layers = createIcon('Layers', <><path d="M12 3.5 21 8l-9 4.5L3 8Z"/><path d="M3 12.2l9 4.5 9-4.5"/><path d="M3 16.2l9 4.5 9-4.5"/></>);
export const LayoutTemplate = createIcon('LayoutTemplate', <><rect x="3.5" y="3.5" width="17" height="6" rx="2"/><rect x="3.5" y="13" width="8" height="7.5" rx="2"/><rect x="15" y="13" width="5.5" height="7.5" rx="2"/></>);
export const Lightbulb = createIcon('Lightbulb', <><path d="M9 18h6"/><path d="M10 21.5h4"/><path d="M12 2.5a6.5 6.5 0 0 0-4 11.6c.6.5 1 1.2 1 2V16h6v-.9c0-.8.4-1.5 1-2A6.5 6.5 0 0 0 12 2.5Z"/><path d="M9.6 7a2.8 2.8 0 0 1 2.1-1.5"/></>);
export const Link2 = createIcon('Link2', <><path d="M9 17H7a5 5 0 0 1 0-10h2"/><path d="M15 7h2a5 5 0 0 1 0 10h-2"/><path d="M8.5 12h7"/></>);
export const List = createIcon('List', <><path d="M9 6h11"/><path d="M9 12h11"/><path d="M9 18h11"/><circle cx="4.5" cy="6" r="1.15" fill="currentColor" stroke="none"/><circle cx="4.5" cy="12" r="1.15" fill="currentColor" stroke="none"/><circle cx="4.5" cy="18" r="1.15" fill="currentColor" stroke="none"/></>);
export const ListChecks = createIcon('ListChecks', <><path d="M11 6h9"/><path d="M11 12h9"/><path d="M11 18h9"/><path d="M3.5 6l1.5 1.5L8 4.5"/><path d="M3.5 12.5 5 14l3-3"/><path d="M4 18h3"/></>);
export const ListOrdered = createIcon('ListOrdered', <><path d="M10 6h10"/><path d="M10 12h10"/><path d="M10 18h10"/><path d="M4 5l1.5-1v5"/><path d="M3.5 15a1.5 1.5 0 0 1 3 .2c0 1-3 2.3-3 4.3h3"/></>);
export const ListTree = createIcon('ListTree', <><path d="M8.5 5h11.5"/><path d="M12.5 12H20"/><path d="M12.5 19H20"/><path d="M4 4v12a3 3 0 0 0 3 3h2"/><path d="M4 9a3 3 0 0 0 3 3h2"/></>);
export const Loader2 = createIcon('Loader2', <><path d="M20.5 12A8.5 8.5 0 1 1 12 3.5"/></>);
export const Lock = createIcon('Lock', <><rect x="4.5" y="10.5" width="15" height="10" rx="3"/><path d="M8 10.5v-3a4 4 0 0 1 8 0v3"/><circle cx="12" cy="15.5" r="1.2" fill="currentColor" stroke="none"/></>);
export const LogIn = createIcon('LogIn', <><path d="M14 4h3.5A2.5 2.5 0 0 1 20 6.5v11a2.5 2.5 0 0 1-2.5 2.5H14"/><path d="M3.5 12H14"/><path d="M10 8l4 4-4 4"/></>);
export const LogOut = createIcon('LogOut', <><path d="M10 20H6.5A2.5 2.5 0 0 1 4 17.5v-11A2.5 2.5 0 0 1 6.5 4H10"/><path d="M9.5 12h11"/><path d="M16.5 8l4 4-4 4"/></>);
export const Mail = createIcon('Mail', <><rect x="3" y="5" width="18" height="14" rx="3.5"/><path d="M3.5 7.5l7.3 5.2a2 2 0 0 0 2.4 0l7.3-5.2"/></>);
export const MailWarning = createIcon('MailWarning', <><path d="M21 11V8a3 3 0 0 0-3-3H6a3 3 0 0 0-3 3v8a3 3 0 0 0 3 3h9"/><path d="M3.5 7.5l7.3 5.2a2 2 0 0 0 2.4 0l7.3-5.2"/><path d="M19.5 14.5v3"/><circle cx="19.5" cy="20.3" r="1.1" fill="currentColor" stroke="none"/></>);
export const Map = createIcon('Map', <><path d="M9 4.5 3.5 6.5v13l5.5-2 6 2 5.5-2v-13l-5.5 2Z"/><path d="M9 4.5v13"/><path d="M15 6.5v13"/></>);
export const MapPin = createIcon('MapPin', <><path d="M19 10c0 5.5-7 11-7 11s-7-5.5-7-11a7 7 0 0 1 14 0Z"/><circle cx="12" cy="10" r="2.5"/></>);
export const Maximize = createIcon('Maximize', <><path d="M4 9V6.5A2.5 2.5 0 0 1 6.5 4H9"/><path d="M15 4h2.5A2.5 2.5 0 0 1 20 6.5V9"/><path d="M20 15v2.5a2.5 2.5 0 0 1-2.5 2.5H15"/><path d="M9 20H6.5A2.5 2.5 0 0 1 4 17.5V15"/></>);
export const Maximize2 = createIcon('Maximize2', <><path d="M14 4h6v6"/><path d="M20 4l-6.5 6.5"/><path d="M10 20H4v-6"/><path d="M4 20l6.5-6.5"/></>);
export const Megaphone = createIcon('Megaphone', <><path d="M3.5 10v4a1.5 1.5 0 0 0 1.5 1.5h2L16 20V4L7 8.5H5A1.5 1.5 0 0 0 3.5 10Z"/><path d="M7 15.5l1.3 4.2a1.5 1.5 0 0 0 2.9-.8L10.3 16"/><path d="M19.5 9.5a3.5 3.5 0 0 1 0 5"/></>);
export const Menu = createIcon('Menu', <><path d="M4 6.5h16"/><path d="M4 12h10.5"/><path d="M4 17.5h16"/></>);
export const MessageCircle = createIcon('MessageCircle', <><path d="M20.5 11.5a8.5 8 0 0 1-12.3 7.2L3.5 20l1.4-4a7.6 7.6 0 0 1-1.4-4.5 8.5 8 0 0 1 17 0Z"/></>);
export const MessageSquareWarning = createIcon('MessageSquareWarning', <><path d="M20.5 15a2 2 0 0 1-2 2H7.5l-4 3.5V5.5a2 2 0 0 1 2-2h13a2 2 0 0 1 2 2Z"/><path d="M12 7.5V11"/><circle cx="12" cy="13.8" r="1.1" fill="currentColor" stroke="none"/></>);
export const MessagesSquare = createIcon('MessagesSquare', <><path d="M14.5 9.5a2 2 0 0 1-2 2H7l-3.5 3V5a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2Z"/><path d="M18 9h1.5a2 2 0 0 1 2 2v10L18 18h-5.5a2 2 0 0 1-2-2v-1"/></>);
export const Minimize = createIcon('Minimize', <><path d="M9 4v3a2 2 0 0 1-2 2H4"/><path d="M20 9h-3a2 2 0 0 1-2-2V4"/><path d="M15 20v-3a2 2 0 0 1 2-2h3"/><path d="M4 15h3a2 2 0 0 1 2 2v3"/></>);
export const Minimize2 = createIcon('Minimize2', <><path d="M4 14h6v6"/><path d="M3.5 20.5 10 14"/><path d="M20 10h-6V4"/><path d="M20.5 3.5 14 10"/></>);
export const Minus = createIcon('Minus', <><path d="M5 12h14"/></>);
export const Moon = createIcon('Moon', <><path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5Z"/></>);
export const MoreHorizontal = createIcon('MoreHorizontal', <><circle cx="5.5" cy="12" r="1.5" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none"/><circle cx="18.5" cy="12" r="1.5" fill="currentColor" stroke="none"/></>);
export const Move = createIcon('Move', <><path d="M12 3v18"/><path d="M3 12h18"/><path d="M9.2 5.8 12 3l2.8 2.8"/><path d="M9.2 18.2 12 21l2.8-2.8"/><path d="M5.8 9.2 3 12l2.8 2.8"/><path d="M18.2 9.2 21 12l-2.8 2.8"/></>);
export const Music = createIcon('Music', <><path d="M9 18V5.5l11-2V16"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="17.5" cy="16" r="2.5"/></>);
export const Network = createIcon('Network', <><rect x="9" y="2.5" width="6" height="5" rx="1.5"/><rect x="2.5" y="16.5" width="6" height="5" rx="1.5"/><rect x="15.5" y="16.5" width="6" height="5" rx="1.5"/><path d="M12 7.5V12"/><path d="M5.5 16.5V14a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v2.5"/></>);
export const Newspaper = createIcon('Newspaper', <><path d="M4.5 20.5h14a2 2 0 0 0 2-2v-13a2 2 0 0 0-2-2h-9a2 2 0 0 0-2 2v13a2 2 0 0 1-2 2Zm0 0a2 2 0 0 1-2-2V10h2.5"/><path d="M11 8h6.5"/><path d="M11 12h6.5"/><path d="M11 16h4.5"/></>);
export const NotebookPen = createIcon('NotebookPen', <><path d="M13.5 3.5H7A2.5 2.5 0 0 0 4.5 6v12A2.5 2.5 0 0 0 7 20.5h10a2.5 2.5 0 0 0 2.5-2.5v-5"/><path d="M2.5 8h4"/><path d="M2.5 12h4"/><path d="M2.5 16h4"/><path d="M18.4 3.6a1.9 1.9 0 0 1 2.7 2.7l-6.3 6.3-3.3.8.8-3.3Z"/></>);
export const Orbit = createIcon('Orbit', <><circle cx="12" cy="12" r="2.6"/><path d="M4.6 16.2a8.5 8.5 0 0 0 14.5-1.5"/><path d="M19.4 7.8A8.5 8.5 0 0 0 4.9 9.3"/><circle cx="4.6" cy="16.4" r="1.6"/><circle cx="19.4" cy="7.6" r="1.6"/></>);
export const Palette = createIcon('Palette', <><path d="M12 3.5a8.5 8.5 0 0 0 0 17c1.2 0 1.9-.8 1.9-1.8 0-.6-.3-1-.6-1.4-.4-.4-.6-.9-.6-1.4 0-1 .8-1.9 1.9-1.9h2.3a3.6 3.6 0 0 0 3.6-3.6C20.5 6.9 16.7 3.5 12 3.5Z"/><circle cx="7.5" cy="11.5" r="1.15" fill="currentColor" stroke="none"/><circle cx="9.5" cy="7.6" r="1.15" fill="currentColor" stroke="none"/><circle cx="14.5" cy="7.6" r="1.15" fill="currentColor" stroke="none"/></>);
export const PanelLeftClose = createIcon('PanelLeftClose', <><rect x="3.5" y="3.5" width="17" height="17" rx="4"/><path d="M9 3.5v17"/><path d="M15.5 9.5 13 12l2.5 2.5"/></>);
export const PanelLeftOpen = createIcon('PanelLeftOpen', <><rect x="3.5" y="3.5" width="17" height="17" rx="4"/><path d="M9 3.5v17"/><path d="M13 9.5l2.5 2.5-2.5 2.5"/></>);
export const PanelRight = createIcon('PanelRight', <><rect x="3.5" y="3.5" width="17" height="17" rx="4"/><path d="M15 3.5v17"/></>);
export const PanelRightClose = createIcon('PanelRightClose', <><rect x="3.5" y="3.5" width="17" height="17" rx="4"/><path d="M15 3.5v17"/><path d="M8.5 9.5 11 12l-2.5 2.5"/></>);
export const PanelRightOpen = createIcon('PanelRightOpen', <><rect x="3.5" y="3.5" width="17" height="17" rx="4"/><path d="M15 3.5v17"/><path d="M11 9.5 8.5 12l2.5 2.5"/></>);
export const Paperclip = createIcon('Paperclip', <><path d="M20 11.5l-7.8 7.8a5 5 0 0 1-7.1-7.1l8-8a3.3 3.3 0 0 1 4.7 4.7l-7.9 7.9a1.7 1.7 0 0 1-2.4-2.4l7.1-7.1"/></>);
export const Pause = createIcon('Pause', <><rect x="6.2" y="5" width="4" height="14" rx="1.4"/><rect x="13.8" y="5" width="4" height="14" rx="1.4"/></>);
export const PenLine = createIcon('PenLine', <><path d="M15.6 4.2a2.2 2.2 0 0 1 3.1 3.1L7.6 18.4l-4 1.1 1.1-4Z"/><path d="M13.6 6.2l3.1 3.1"/><path d="M12.5 20h8"/></>);
export const PenSquare = createIcon('PenSquare', <><path d="M12 4H7a3.5 3.5 0 0 0-3.5 3.5v9A3.5 3.5 0 0 0 7 20h9a3.5 3.5 0 0 0 3.5-3.5V12"/><path d="M17.6 3.6a2 2 0 0 1 2.8 2.8L12 14.8l-3.6.8.8-3.6Z"/></>);
export const Pencil = createIcon('Pencil', <><path d="M15.6 4.2a2.2 2.2 0 0 1 3.1 3.1L7.6 18.4l-4 1.1 1.1-4Z"/><path d="M13.6 6.2l3.1 3.1"/></>);
export const PencilLine = createIcon('PencilLine', <><path d="M15.6 4.2a2.2 2.2 0 0 1 3.1 3.1L7.6 18.4l-4 1.1 1.1-4Z"/><path d="M13.6 6.2l3.1 3.1"/><path d="M12.5 20h8"/></>);
export const PictureInPicture2 = createIcon('PictureInPicture2', <><path d="M20.5 10V7a3 3 0 0 0-3-3h-11a3 3 0 0 0-3 3v8a3 3 0 0 0 3 3H10"/><rect x="13" y="13" width="8" height="7" rx="1.8"/></>);
export const PieChart = createIcon('PieChart', <><path d="M20.5 13.5A8.5 8.5 0 1 1 10.5 3.6"/><path d="M20.5 10.5A7.6 7.6 0 0 0 13.5 3.5v7Z"/></>);
export const Pin = createIcon('Pin', <><path d="M12 16v5.5"/><path d="M8.5 3.5h7"/><path d="M10 3.5v5.2L7 12.5V15h10v-2.5l-3-3.8V3.5"/></>);
export const Play = createIcon('Play', <><path d="M7.5 5.3v13.4a1.2 1.2 0 0 0 1.8 1l10.6-6.7a1.2 1.2 0 0 0 0-2L9.3 4.3a1.2 1.2 0 0 0-1.8 1Z"/></>);
export const Plus = createIcon('Plus', <><path d="M12 5v14"/><path d="M5 12h14"/></>);
export const QrCode = createIcon('QrCode', <><rect x="3.5" y="3.5" width="6.5" height="6.5" rx="1.5"/><rect x="14" y="3.5" width="6.5" height="6.5" rx="1.5"/><rect x="3.5" y="14" width="6.5" height="6.5" rx="1.5"/><rect x="14" y="14" width="3" height="3" rx="0.6"/><path d="M17 20.5h3.5V17"/><circle cx="20.3" cy="14.2" r="0.9" fill="currentColor" stroke="none"/><circle cx="14.2" cy="20.3" r="0.9" fill="currentColor" stroke="none"/></>);
export const Quote = createIcon('Quote', <><path d="M5 17.5c2.5-1.2 4-3.4 4-6.5V7.5A1.5 1.5 0 0 0 7.5 6h-2A1.5 1.5 0 0 0 4 7.5v2A1.5 1.5 0 0 0 5.5 11H9"/><path d="M14.5 17.5c2.5-1.2 4-3.4 4-6.5V7.5A1.5 1.5 0 0 0 17 6h-2a1.5 1.5 0 0 0-1.5 1.5v2A1.5 1.5 0 0 0 15 11h3.5"/></>);
export const Redo2 = createIcon('Redo2', <><path d="M15 14l5-5-5-5"/><path d="M20 9H9.5a5.5 5.5 0 0 0 0 11H13"/></>);
export const RefreshCw = createIcon('RefreshCw', <><path d="M20 11A8 8 0 0 0 5.7 6.4L4 8.2"/><path d="M4 4v4.2h4.2"/><path d="M4 13a8 8 0 0 0 14.3 4.6L20 15.8"/><path d="M20 20v-4.2h-4.2"/></>);
export const Repeat2 = createIcon('Repeat2', <><path d="M17 3l3.5 3.5L17 10"/><path d="M4 12v-1.5a4 4 0 0 1 4-4h12.5"/><path d="M7 21l-3.5-3.5L7 14"/><path d="M20 12v1.5a4 4 0 0 1-4 4H3.5"/></>);
export const Rocket = createIcon('Rocket', <><path d="M5 15.5c-1.5 1.3-2 4.5-2 4.5s3.2-.5 4.5-2a2.1 2.1 0 0 0-2.5-2.5Z"/><path d="M12 15 9 12c1.6-4.3 5.2-8.2 12-9 -.8 6.8-4.7 10.4-9 12Z"/><path d="M9 12H4.5S5.2 9 6.5 8c1.6-1.1 4.5-.5 4.5-.5"/><path d="M12 15v4.5s3-.7 4-2c1.1-1.6.5-4.5.5-4.5"/><circle cx="16" cy="8" r="1.5"/></>);
export const RotateCcw = createIcon('RotateCcw', <><path d="M4 12a8 8 0 1 0 2.4-5.7L4 8.6"/><path d="M4 4.2v4.4h4.4"/></>);
export const RotateCw = createIcon('RotateCw', <><path d="M20 12a8 8 0 1 1-2.4-5.7L20 8.6"/><path d="M20 4.2v4.4h-4.4"/></>);
export const Save = createIcon('Save', <><path d="M5.5 3.5h10.3a2 2 0 0 1 1.4.6l2.7 2.7a2 2 0 0 1 .6 1.4v10.3a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2v-13a2 2 0 0 1 2-2Z"/><path d="M7.5 3.5v4h7v-4"/><path d="M7 20.5v-6h10v6"/></>);
export const Scale = createIcon('Scale', <><path d="M12 3.5v16.5"/><path d="M7.5 20h9"/><path d="M4.5 7.5h15"/><path d="M1.8 14 4.5 7.5 7.2 14a2.8 2.8 0 0 1-5.4 0Z"/><path d="M16.8 14l2.7-6.5 2.7 6.5a2.8 2.8 0 0 1-5.4 0Z"/></>);
export const Scan = createIcon('Scan', <><path d="M4 9V6.5A2.5 2.5 0 0 1 6.5 4H9"/><path d="M15 4h2.5A2.5 2.5 0 0 1 20 6.5V9"/><path d="M20 15v2.5a2.5 2.5 0 0 1-2.5 2.5H15"/><path d="M9 20H6.5A2.5 2.5 0 0 1 4 17.5V15"/><path d="M7.5 12h9"/></>);
export const Search = createIcon('Search', <><circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.4 15.4 20.5 20.5"/><path d="M7.9 8.8a3 3 0 0 1 2.2-1.6"/></>);
export const Send = createIcon('Send', <><path d="M20.8 3.2 10.4 13.6"/><path d="M20.8 3.2 14.6 20.6a.6.6 0 0 1-1.1.1L10.4 13.6 3.3 10.5a.6.6 0 0 1 .1-1.1Z"/></>);
export const Server = createIcon('Server', <><rect x="3.5" y="3.5" width="17" height="7" rx="2.5"/><rect x="3.5" y="13.5" width="17" height="7" rx="2.5"/><circle cx="7.5" cy="7" r="1.15" fill="currentColor" stroke="none"/><circle cx="7.5" cy="17" r="1.15" fill="currentColor" stroke="none"/><path d="M11 7h5.5"/><path d="M11 17h5.5"/></>);
export const Settings = createIcon('Settings', <><path d="M12 2.8l1.7 2.2 2.7-.5.9 2.6 2.5 1.2-.7 2.7 1.4 2.4-2.1 1.8-.1 2.8-2.7.4L13.7 19l-1.7 2.2L10.3 19l-1.8-.6-2.7-.4-.1-2.8-2.1-1.8L5 11l-.7-2.7 2.5-1.2.9-2.6 2.7.5Z"/><circle cx="12" cy="12" r="3"/></>);
export const Settings2 = createIcon('Settings2', <><path d="M4 7.5h8.5"/><path d="M17.5 7.5H20"/><path d="M4 16.5h2.5"/><path d="M11.5 16.5H20"/><circle cx="15" cy="7.5" r="2.5"/><circle cx="9" cy="16.5" r="2.5"/></>);
export const Shapes = createIcon('Shapes', <><path d="M8 3.5 12.4 11H3.6Z"/><circle cx="17" cy="7.5" r="3.5"/><rect x="3.5" y="13.5" width="7" height="7" rx="2"/><rect x="13.5" y="13.5" width="7" height="7" rx="3.5"/></>);
export const Share2 = createIcon('Share2', <><circle cx="18" cy="5.5" r="2.6"/><circle cx="6" cy="12" r="2.6"/><circle cx="18" cy="18.5" r="2.6"/><path d="M8.3 10.7l7.4-4"/><path d="M8.3 13.3l7.4 4"/></>);
export const Shield = createIcon('Shield', <><path d="M12 21s-7.5-3-7.5-9.6V6.2L12 3.5l7.5 2.7v5.2C19.5 18 12 21 12 21Z"/></>);
export const ShieldAlert = createIcon('ShieldAlert', <><path d="M12 21s-7.5-3-7.5-9.6V6.2L12 3.5l7.5 2.7v5.2C19.5 18 12 21 12 21Z"/><path d="M12 8v4.5"/><circle cx="12" cy="15.5" r="1.1" fill="currentColor" stroke="none"/></>);
export const ShieldCheck = createIcon('ShieldCheck', <><path d="M12 21s-7.5-3-7.5-9.6V6.2L12 3.5l7.5 2.7v5.2C19.5 18 12 21 12 21Z"/><path d="M9 12l2 2 4-4"/></>);
export const SlidersHorizontal = createIcon('SlidersHorizontal', <><path d="M4 6h9"/><path d="M17 6h3"/><path d="M4 12h3"/><path d="M11 12h9"/><path d="M4 18h11"/><path d="M19 18h1"/><circle cx="15" cy="6" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="17" cy="18" r="2"/></>);
export const Smile = createIcon('Smile', <><circle cx="12" cy="12" r="9"/><path d="M8.5 14.5a4.5 4.5 0 0 0 7 0"/><circle cx="9" cy="9.5" r="1.1" fill="currentColor" stroke="none"/><circle cx="15" cy="9.5" r="1.1" fill="currentColor" stroke="none"/></>);
export const Snowflake = createIcon('Snowflake', <><path d="M12 3v18"/><path d="M4.2 7.5l15.6 9"/><path d="M19.8 7.5l-15.6 9"/><path d="M9.5 4.5 12 7l2.5-2.5"/><path d="M9.5 19.5 12 17l2.5 2.5"/><path d="M3.5 11l3.3-.9-.9-3.3"/><path d="M20.5 13l-3.3.9.9 3.3"/></>);
export const Sparkles = createIcon('Sparkles', <><path d="M10 3.5c.6 3.7 2.8 5.9 6.5 6.5-3.7.6-5.9 2.8-6.5 6.5-.6-3.7-2.8-5.9-6.5-6.5 3.7-.6 5.9-2.8 6.5-6.5Z"/><path d="M18 14.5c.3 1.7 1.3 2.7 3 3-1.7.3-2.7 1.3-3 3-.3-1.7-1.3-2.7-3-3 1.7-.3 2.7-1.3 3-3Z"/><circle cx="18.5" cy="5" r="1.1" fill="currentColor" stroke="none"/></>);
export const SpellCheck = createIcon('SpellCheck', <><path d="M3.5 15 7 5l3.5 10"/><path d="M4.7 11.5h4.6"/><path d="M12.5 16.5l3 3 5-5.5"/></>);
export const Star = createIcon('Star', <><path d="M12 3.2l2.6 5.4 5.9.8-4.3 4.1 1 5.9L12 16.6l-5.2 2.8 1-5.9-4.3-4.1 5.9-.8Z"/></>);
export const Strikethrough = createIcon('Strikethrough', <><path d="M16.5 7.5c-.6-1.8-2.4-3-4.7-3-2.8 0-4.6 1.5-4.6 3.6 0 1.6 1 2.6 3 3.4"/><path d="M4 12h16"/><path d="M8 16.5c.6 1.8 2.4 3 4.6 3 2.9 0 4.8-1.6 4.8-3.8 0-.9-.3-1.7-1-2.4"/></>);
export const Swords = createIcon('Swords', <><path d="M4 4l11 11"/><path d="M20 4 9 15"/><path d="M12.5 17.5l5-5"/><path d="M6.5 12.5l5 5"/><path d="M16.5 16.5 20 20"/><path d="M7.5 16.5 4 20"/><path d="M4 4h2.5"/><path d="M4 4v2.5"/><path d="M20 4h-2.5"/><path d="M20 4v2.5"/></>);
export const Table = createIcon('Table', <><rect x="3.5" y="4" width="17" height="16" rx="3"/><path d="M3.5 9.5h17"/><path d="M3.5 14.5h17"/><path d="M9.5 9.5V20"/></>);
export const Table2 = createIcon('Table2', <><rect x="3.5" y="4" width="17" height="16" rx="3"/><path d="M3.5 9.5h17"/><path d="M3.5 14.5h17"/><path d="M12 4v16"/></>);
export const Tag = createIcon('Tag', <><path d="M3.5 12.6V5A1.5 1.5 0 0 1 5 3.5h7.6a2 2 0 0 1 1.4.6l6.8 6.8a2 2 0 0 1 0 2.8l-6.6 6.6a2 2 0 0 1-2.8 0L4.1 14a2 2 0 0 1-.6-1.4Z"/><circle cx="8.5" cy="8.5" r="1.4" fill="currentColor" stroke="none"/></>);
export const Tags = createIcon('Tags', <><path d="M2.5 11.3V4.5a1 1 0 0 1 1-1h6.8a2 2 0 0 1 1.4.6l6.5 6.5a2 2 0 0 1 0 2.8l-5.8 5.8a2 2 0 0 1-2.8 0L3 12.7a2 2 0 0 1-.5-1.4Z"/><path d="M15.5 3.5l6 6a2 2 0 0 1 0 2.8l-6 6.2"/><circle cx="7" cy="8" r="1.2" fill="currentColor" stroke="none"/></>);
export const Target = createIcon('Target', <><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5.5"/><circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none"/></>);
export const Terminal = createIcon('Terminal', <><rect x="3" y="4" width="18" height="16" rx="3.5"/><path d="M7 9.5l3 2.5-3 2.5"/><path d="M12.5 15H17"/></>);
export const Trash2 = createIcon('Trash2', <><path d="M4 6.5h16"/><path d="M9.5 6.5V5A1.5 1.5 0 0 1 11 3.5h2A1.5 1.5 0 0 1 14.5 5v1.5"/><path d="M6 6.5l.9 12.3a2 2 0 0 0 2 1.7h6.2a2 2 0 0 0 2-1.7L18 6.5"/><path d="M10 10.5v6"/><path d="M14 10.5v6"/></>);
export const Trophy = createIcon('Trophy', <><path d="M7 4h10v5a5 5 0 0 1-10 0Z"/><path d="M7 6H4.5A3.5 3.5 0 0 0 7.5 10.5"/><path d="M17 6h2.5a3.5 3.5 0 0 1-3 4.5"/><path d="M12 14v3.5"/><path d="M8.5 20.5h7"/><path d="M10 17.5h4"/></>);
export const Type = createIcon('Type', <><path d="M5 7.5V5.5a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v2"/><path d="M12 4.5v15"/><path d="M9 19.5h6"/></>);
export const Underline = createIcon('Underline', <><path d="M7 4v7a5 5 0 0 0 10 0V4"/><path d="M5 20.5h14"/></>);
export const Undo2 = createIcon('Undo2', <><path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/></>);
export const User = createIcon('User', <><circle cx="12" cy="8" r="4"/><path d="M4.5 20.5a7.5 7.5 0 0 1 15 0"/></>);
export const UserCheck = createIcon('UserCheck', <><circle cx="9.5" cy="8" r="3.8"/><path d="M2.8 20a6.8 6.8 0 0 1 13.4 0"/><path d="M16 11l2 2 4-4"/></>);
export const UserCircle2 = createIcon('UserCircle2', <><circle cx="12" cy="12" r="9"/><circle cx="12" cy="10" r="3"/><path d="M6.5 18.3a6.5 6.5 0 0 1 11 0"/></>);
export const UserPlus = createIcon('UserPlus', <><circle cx="9.5" cy="8" r="3.8"/><path d="M2.8 20a6.8 6.8 0 0 1 13.4 0"/><path d="M19 8v6"/><path d="M16 11h6"/></>);
export const Users = createIcon('Users', <><circle cx="9" cy="8" r="3.8"/><path d="M2.3 20a6.7 6.7 0 0 1 13.4 0"/><path d="M15.5 4.4a3.8 3.8 0 0 1 0 7.2"/><path d="M18.5 13.6A6.8 6.8 0 0 1 21.8 20"/></>);
export const Volume1 = createIcon('Volume1', <><path d="M4.5 9.2h2.8L12 5.3v13.4l-4.7-3.9H4.5a1 1 0 0 1-1-1v-3.6a1 1 0 0 1 1-1Z"/><path d="M15.5 9a4.2 4.2 0 0 1 0 6"/></>);
export const Volume2 = createIcon('Volume2', <><path d="M4.5 9.2h2.8L12 5.3v13.4l-4.7-3.9H4.5a1 1 0 0 1-1-1v-3.6a1 1 0 0 1 1-1Z"/><path d="M15.5 9a4.2 4.2 0 0 1 0 6"/><path d="M18.4 6.2a8 8 0 0 1 0 11.6"/></>);
export const VolumeX = createIcon('VolumeX', <><path d="M4.5 9.2h2.8L12 5.3v13.4l-4.7-3.9H4.5a1 1 0 0 1-1-1v-3.6a1 1 0 0 1 1-1Z"/><path d="M16 9.5l5 5"/><path d="M21 9.5l-5 5"/></>);
export const Wand2 = createIcon('Wand2', <><path d="M4 20 15.5 8.5"/><path d="M13.8 6.8l3.4 3.4"/><path d="M18 2.5v3"/><path d="M21.5 6h-3"/><path d="M7 3.5v2"/><path d="M8 4.5H6"/><path d="M19.5 13v2"/><path d="M20.5 14h-2"/></>);
export const Wifi = createIcon('Wifi', <><path d="M2.5 8.8a14 14 0 0 1 19 0"/><path d="M5.5 12.2a9.5 9.5 0 0 1 13 0"/><path d="M8.7 15.6a5 5 0 0 1 6.6 0"/><circle cx="12" cy="19" r="1.25" fill="currentColor" stroke="none"/></>);
export const WifiOff = createIcon('WifiOff', <><path d="M2.5 8.8a14 14 0 0 1 4-2.5"/><path d="M10.5 5.4a14 14 0 0 1 11 3.4"/><path d="M5.5 12.2a9.5 9.5 0 0 1 4-2"/><path d="M15.8 10.9a9.5 9.5 0 0 1 2.7 1.3"/><path d="M8.7 15.6a5 5 0 0 1 6.6 0"/><path d="M3 3l18 18"/><circle cx="12" cy="19" r="1.25" fill="currentColor" stroke="none"/></>);
export const X = createIcon('X', <><path d="M6.5 6.5l11 11"/><path d="M17.5 6.5l-11 11"/></>);
export const XCircle = createIcon('XCircle', <><circle cx="12" cy="12" r="9"/><path d="M9.2 9.2l5.6 5.6"/><path d="M14.8 9.2l-5.6 5.6"/></>);
export const Zap = createIcon('Zap', <><path d="M13.5 2.5 4.5 13.5h7l-1 8 9-11h-7Z"/></>);
export const ZoomIn = createIcon('ZoomIn', <><circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.4 15.4 20.5 20.5"/><path d="M8 10.5h5"/><path d="M10.5 8v5"/></>);
export const ZoomOut = createIcon('ZoomOut', <><circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.4 15.4 20.5 20.5"/><path d="M8 10.5h5"/></>);
export const Home = House;
export const SquarePen = PenSquare;
export const UserRound = User;
