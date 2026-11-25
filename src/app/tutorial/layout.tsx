import type { Metadata } from 'next';
import { Literata } from 'next/font/google';

const literata = Literata({
  subsets: ['latin'],
  variable: '--tut-serif',
  display: 'swap',
  style: ['normal', 'italic'],
});

export const metadata: Metadata = {
  title: 'Manual do Insight* — tutorial',
  description: 'Tudo o que dá para fazer no Insight: editor em blocos, tópicos, menções, atalhos, notificações, Nitro e mais.',
};

export default function TutorialLayout({ children }: { children: React.ReactNode }) {
  return <div className={literata.variable}>{children}</div>;
}
