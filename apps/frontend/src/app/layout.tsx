import type { Metadata, Viewport } from 'next';
import { Inter, Noto_Sans_Thai, Orbitron } from 'next/font/google';
import type { ReactNode } from 'react';
import './globals.css';

const display = Orbitron({ subsets: ['latin'], variable: '--font-display', display: 'swap' });
const body = Inter({ subsets: ['latin'], variable: '--font-body', display: 'swap' });
const thai = Noto_Sans_Thai({ subsets: ['thai'], variable: '--font-thai', display: 'swap' });

export const metadata: Metadata = {
  title: 'Anime Bid Battle',
  description: 'Bid on anime characters, guess their strength, build the strongest team.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#0a0a14',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable} ${thai.variable}`}>
      <body>
        <main className="shell">{children}</main>
      </body>
    </html>
  );
}
