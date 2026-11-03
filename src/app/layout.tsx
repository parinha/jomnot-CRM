import type { Metadata, Viewport } from 'next';
import { Toaster } from 'sonner';
import './globals.css';
import ServiceWorkerRegistrar from '@/src/components/ServiceWorkerRegistrar';
import { fontVariables } from './fonts';

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
    <html lang="en" className={`${fontVariables} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <ServiceWorkerRegistrar />
        {children}
        <Toaster theme="light" position="top-center" richColors />
      </body>
    </html>
  );
}
