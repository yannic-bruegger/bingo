import type { Metadata, Viewport } from 'next';

import { Notices } from '@/components/Notices';
import { ServiceWorker } from '@/components/ServiceWorker';
import './globals.css';

export const metadata: Metadata = {
  title: 'Bingo',
  description: 'Bingo mit Freunden — live, ohne Anmeldung.',
  applicationName: 'Bingo',
  appleWebApp: { capable: true, title: 'Bingo', statusBarStyle: 'default' },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#fafaf9' },
    { media: '(prefers-color-scheme: dark)', color: '#1a1a1d' },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de">
      <body className="antialiased">
        {children}
        <Notices />
        <ServiceWorker />
      </body>
    </html>
  );
}
