import type { Metadata, Viewport } from 'next';
import { Fredoka, Geist_Mono } from 'next/font/google';
import localFont from 'next/font/local';
import { Toaster } from 'sonner';
import './globals.css';
import ServiceWorkerRegistrar from '@/src/components/ServiceWorkerRegistrar';

// English UI font
const fredoka = Fredoka({
  variable: '--font-fredoka',
  subsets: ['latin', 'latin-ext'],
});

// Khmer UI font — Fredoka has no Khmer glyphs, so Khmer text falls through to this.
// Self-hosted Khmer subset of Google Sans (OFL, variable 400–700) instead of
// next/font/google: Turbopack has no fallback metrics for Google Sans and warns on every build.
const googleSans = localFont({
  src: './fonts/GoogleSans-Khmer.woff2',
  variable: '--font-google-sans',
  weight: '400 700',
  display: 'swap',
  adjustFontFallback: false,
  declarations: [{ prop: 'unicode-range', value: 'U+1780-17FF, U+19E0-19FF, U+200C-200D, U+25CC' }],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#00b14f',
};

export const metadata: Metadata = {
  title: 'EasyInvoices24',
  description:
    'EasyInvoices24 is a fast, simple invoicing and billing app designed specifically for the modern content creator.',
  applicationName: 'EasyInvoices24',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'EasyInvoices24',
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: [
      { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
    ],
    apple: '/apple-touch-icon.png',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${fredoka.variable} ${googleSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <ServiceWorkerRegistrar />
        {children}
        <Toaster theme="light" position="top-center" richColors />
      </body>
    </html>
  );
}
