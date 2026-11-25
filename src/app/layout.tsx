import { MentionAutocomplete } from '@/components/mentions/MentionAutocomplete';
import { GlobalShortcuts } from '@/components/layout/GlobalShortcuts';
import type { Metadata, Viewport } from 'next';
// @ts-ignore
import './globals.css';
import { NAME_FONT_VARIABLES } from '@/components/nitro/nameFonts';
import { AppShell } from '../components/layout/AppShell';
import { ReleaseNotesModal } from '@/components/layout/ReleaseNotesModal';

export const metadata: Metadata = {
  title: 'Insight — Plataforma Comunitária de Ideias & Projetos',
  description: 'Microblog autoral e comunitário de ideias, engenharia de software e projetos.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

const themeInitScript = `
  (function() {
    try {
      var nt = localStorage.getItem('insight-nitro-theme');
      if (nt) {
        var t = JSON.parse(nt);
        if (t && /^theme-[a-z-]+$/.test(t.id)) {
          document.documentElement.setAttribute('data-nitro-theme', t.id);
          document.documentElement.dataset.ntMode = t.mode === 'light' ? 'light' : 'dark';
          document.documentElement.setAttribute('data-theme', document.documentElement.dataset.ntMode);
        }
      }
    } catch (e) {}
    try {
      var saved = localStorage.getItem('insight-preferences');
      if (saved) {
        var prefs = JSON.parse(saved);
        var root = document.documentElement;

        if (prefs.theme) {
          root.setAttribute('data-theme', root.dataset.ntMode || prefs.theme);
        }
        if (prefs.highContrast) {
          root.setAttribute('data-contrast', 'high');
        } else {
          root.removeAttribute('data-contrast');
        }
        if (prefs.fontSize) {
          var isMobile = window.innerWidth < 768;
          var effectiveSize = isMobile
            ? Math.max(14, Math.min(18, prefs.fontSize - 3))
            : prefs.fontSize;
          root.style.fontSize = effectiveSize + 'px';
        }
        if (prefs.accentColor && !localStorage.getItem('insight-nitro-theme')) {
          root.style.setProperty('--accent', prefs.accentColor);
          root.style.setProperty('--accent-hover', prefs.accentColor);
        }
        if (prefs.readingMode) {
          root.setAttribute('data-reading', 'comfortable');
        } else {
          root.removeAttribute('data-reading');
        }
        if (prefs.readingFont) {
          root.setAttribute('data-reading-font', prefs.readingFont);
        }
        if (prefs.reduceMotion) {
          root.setAttribute('data-reduce-motion', 'true');
        }
        var warm = typeof prefs.warmFilter === 'number' ? prefs.warmFilter : 0;
        if (prefs.nightLight) {
          var toMin = function (v, d) { var m = /^(\\d{1,2}):(\\d{2})$/.exec(v || d); return (Number(m[1]) * 60 + Number(m[2])) % 1440; };
          var st = toMin(prefs.nightStart, '21:00'), en = toMin(prefs.nightEnd, '06:00');
          var nw = new Date(), cur = nw.getHours() * 60 + nw.getMinutes();
          var on = st === en ? true : st < en ? (cur >= st && cur < en) : (cur >= st || cur < en);
          if (on) warm = Math.max(warm, typeof prefs.nightStrength === 'number' ? prefs.nightStrength : 25);
        }
        root.style.setProperty('--warm-overlay-opacity', (Math.min(40, warm) / 100).toFixed(2));
      }
    } catch (e) {}
  })();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" data-theme="dark" className={NAME_FONT_VARIABLES} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="bg-background text-primary antialiased selection:bg-accent selection:text-background transition-colors duration-200">
        {/* Camada de Filtro Quente / Proteção Ocular Noturna */}
        <div
          aria-hidden="true"
          style={{
            opacity: 'var(--warm-overlay-opacity, 0)',
            backgroundColor: '#ff9d3b',
            mixBlendMode: 'multiply',
          }}
          className="pointer-events-none fixed inset-0 z-[9999] transition-opacity duration-300"
        />

        <ReleaseNotesModal />
        <GlobalShortcuts />
        <MentionAutocomplete />

        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}