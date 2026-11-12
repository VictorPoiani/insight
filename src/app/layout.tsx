import type { Metadata } from 'next';
import './globals.css';
import { LeftSidebar } from '@/components/layout/LeftSidebar';
import { RightSidebar } from '@/components/layout/RightSidebar';

export const metadata: Metadata = {
  title: 'Insighter — Victor Poiani',
  description: 'Microblog autoral de ideias, engenharia de software e projetos por Victor Poiani.',
};

// Script executado imediatamente antes da página renderizar para restaurar o tema salvo
const themeInitScript = `
  (function() {
    try {
      var saved = localStorage.getItem('insight-preferences');
      if (saved) {
        var prefs = JSON.parse(saved);
        if (prefs.theme === 'light' || prefs.theme === 'dark') {
          document.documentElement.setAttribute('data-theme', prefs.theme);
        }
        if (prefs.highContrast) {
          document.documentElement.setAttribute('data-contrast', 'high');
        } else {
          document.documentElement.removeAttribute('data-contrast');
        }
        if (prefs.fontSize) {
          document.documentElement.style.fontSize = prefs.fontSize + 'px';
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
        <div className="max-w-[1600px] mx-auto flex min-h-screen justify-center">
          {/* Coluna 1: Navegação Esquerda */}
          <LeftSidebar />

          {/* Coluna 2: Conteúdo Central */}
          <main className="flex-1 max-w-3xl min-h-screen border-x border-border">
            {children}
          </main>

          {/* Coluna 3: Painel Lateral Direito */}
          <RightSidebar />
        </div>
      </body>
    </html>
  );
}