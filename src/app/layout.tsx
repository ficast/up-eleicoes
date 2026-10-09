import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Barlow, Barlow_Condensed } from 'next/font/google';
import 'maplibre-gl/dist/maplibre-gl.css';
import './globals.css';

const barlow = Barlow({ subsets: ['latin'], weight: ['300', '400', '500', '600'], variable: '--font-barlow' });
const barlowCond = Barlow_Condensed({ subsets: ['latin'], weight: ['600', '700', '800'], style: ['normal', 'italic'], variable: '--font-barlow-condensed' });

export const metadata: Metadata = {
  title: 'UP na Guerra Eleitoral — 2020 a 2026',
  description: 'Mapa e comparativo dos votos da Unidade Popular (80) nas eleições de 2020 a 2026, no Brasil e no exterior.',
  icons: { icon: '/brand/up-logo-black.svg' },
  openGraph: { title: 'UP na Guerra Eleitoral — 2020 a 2026', description: 'Onde a Unidade Popular cresceu e onde precisa crescer.', locale: 'pt_BR', type: 'website' },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR" className={`${barlow.variable} ${barlowCond.variable}`}>
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  );
}
