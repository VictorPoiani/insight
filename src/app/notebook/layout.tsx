import type { Metadata } from 'next';
import { Literata } from 'next/font/google';

const literata = Literata({
  subsets: ['latin'],
  variable: '--nb-literata',
  display: 'swap',
  preload: false,
  style: ['normal', 'italic'],
});

export const metadata: Metadata = {
  title: 'My Notebook — Insight*',
  description: 'Espaço livre de criação: notas conectadas, modelos e modo escritor de livros.',
  robots: { index: false, follow: false },
};

export default function NotebookLayout({ children }: { children: React.ReactNode }) {
  return <div className={literata.variable}>{children}</div>;
}
