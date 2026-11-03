import { Fredoka, Geist_Mono } from 'next/font/google';
import localFont from 'next/font/local';

// English UI font
export const fredoka = Fredoka({
  variable: '--font-fredoka',
  subsets: ['latin', 'latin-ext'],
});

// Khmer UI font — Fredoka has no Khmer glyphs, so Khmer text falls through to this.
// Self-hosted Khmer subset of Google Sans (OFL, variable 400–700) instead of
// next/font/google: Turbopack has no fallback metrics for Google Sans and warns on every build.
export const googleSans = localFont({
  src: './fonts/GoogleSans-Khmer.woff2',
  variable: '--font-google-sans',
  weight: '400 700',
  display: 'swap',
  adjustFontFallback: false,
  declarations: [{ prop: 'unicode-range', value: 'U+1780-17FF, U+19E0-19FF, U+200C-200D, U+25CC' }],
});

export const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

/** Font CSS variables for the <html> element (root layout and global-error). */
export const fontVariables = `${fredoka.variable} ${googleSans.variable} ${geistMono.variable}`;
