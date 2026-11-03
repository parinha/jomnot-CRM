import type { Metadata, Viewport } from 'next';
import Script from 'next/script';
import { Toaster } from 'sonner';
import './globals.css';
import ServiceWorkerRegistrar from '@/src/components/ServiceWorkerRegistrar';
import { fontVariables } from './fonts';
import { BRAND_BOOT_SCRIPT, DEFAULT_BRAND_COLOR } from '@/src/lib/brand';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: DEFAULT_BRAND_COLOR,
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
    // suppressHydrationWarning: the brand boot script sets CSS variables on <html> before hydration
    <html lang="en" className={`${fontVariables} h-full antialiased`} suppressHydrationWarning>
      <body className="min-h-full flex flex-col">
        <Script
          id="brand-boot"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{ __html: BRAND_BOOT_SCRIPT }}
        />
        <ServiceWorkerRegistrar />
        {children}
        <Toaster theme="light" position="top-center" richColors />
      </body>
    </html>
  );
}
