import type { Metadata, Viewport } from 'next';
// @ts-ignore
import './globals.css';
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
      var saved = localStorage.getItem('insight-preferences');
      if (saved) {
        var prefs = JSON.parse(saved);
        var root = document.documentElement;

        if (prefs.theme) {
          root.setAttribute('data-theme', prefs.theme);
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
        if (prefs.accentColor) {
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
        if (typeof prefs.warmFilter === 'number' && prefs.warmFilter > 0) {
          root.style.setProperty('--warm-overlay-opacity', (prefs.warmFilter / 100).toFixed(2));
        } else {
          root.style.setProperty('--warm-overlay-opacity', '0');
        }
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
    <html lang="pt-BR" data-theme="dark" suppressHydrationWarning>
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

        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}