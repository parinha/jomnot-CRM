/**
 * Brand color helpers. One hex color from Settings drives the app UI (CSS variables)
 * and the PDF accent (table headers, highlights) on invoices, quotations and receipts.
 */

export const DEFAULT_BRAND_COLOR = '#F2C14E';

export const BRAND_PRESETS: { name: string; hex: string }[] = [
  { name: 'Sunflower', hex: '#F2C14E' },
  { name: 'Gold', hex: '#FFC206' },
  { name: 'Mustard', hex: '#E0A82E' },
  { name: 'Green', hex: '#00B14F' },
  { name: 'Teal', hex: '#0F9D8A' },
  { name: 'Blue', hex: '#2563EB' },
  { name: 'Coral', hex: '#EF6A5B' },
  { name: 'Graphite', hex: '#1F2937' },
];

const DARK_TEXT = '#1a1d21';
const STORAGE_KEY = 'ei24_brand_vars';

export function normalizeHex(input: string | undefined | null): string {
  const v = (input ?? '').trim();
  if (/^#[0-9a-f]{6}$/i.test(v)) return v.toUpperCase();
  if (/^#[0-9a-f]{3}$/i.test(v)) {
    return (
      '#' +
      v
        .slice(1)
        .split('')
        .map((c) => c + c)
        .join('')
    ).toUpperCase();
  }
  return DEFAULT_BRAND_COLOR;
}

function toRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function toHex([r, g, b]: [number, number, number]): string {
  return '#' + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');
}

/** Mix `hex` toward `target` by `amount` (0–1). */
function mix(hex: string, target: string, amount: number): string {
  const a = toRgb(hex);
  const b = toRgb(target);
  return toHex([0, 1, 2].map((i) => a[i] + (b[i] - a[i]) * amount) as [number, number, number]);
}

function luminance(hex: string): number {
  const [r, g, b] = toRgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
}

export interface BrandPalette {
  brand: string;
  hover: string;
  dark: string;
  soft: string;
  /** Brand-tinted text that stays readable on white. */
  ink: string;
  /** Text/icon color to put on top of a brand fill. */
  onBrand: string;
}

export function brandPalette(input?: string | null): BrandPalette {
  const brand = normalizeHex(input);
  const onBrand = contrast(brand, DARK_TEXT) >= contrast(brand, '#ffffff') ? DARK_TEXT : '#ffffff';
  let ink = brand;
  for (let t = 0.1; contrast(ink, '#ffffff') < 4.8 && t <= 0.9; t += 0.05) {
    ink = mix(brand, '#000000', t);
  }
  return {
    brand,
    hover: mix(brand, '#000000', 0.06),
    dark: mix(brand, '#000000', 0.13),
    soft: mix(brand, '#ffffff', 0.86),
    ink,
    onBrand,
  };
}

function cssVars(p: BrandPalette): Record<string, string> {
  return {
    '--brand': p.brand,
    '--brand-hover': p.hover,
    '--brand-dark': p.dark,
    '--brand-soft': p.soft,
    '--brand-ink': p.ink,
    '--on-brand': p.onBrand,
  };
}

/** Applies the palette to the page and remembers it so the next load starts in the right color. */
export function applyBrand(input?: string | null) {
  if (typeof document === 'undefined') return;
  const vars = cssVars(brandPalette(input));
  const root = document.documentElement;
  Object.entries(vars).forEach(([k, v]) => root.style.setProperty(k, v));
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', vars['--brand']);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(vars));
  } catch {}
}

/** Inline <head> script: re-applies the last saved palette before first paint (no color flash). */
export const BRAND_BOOT_SCRIPT = `try{var v=JSON.parse(localStorage.getItem('${STORAGE_KEY}')||'null');if(v){for(var k in v)document.documentElement.style.setProperty(k,v[k]);}}catch(e){}`;
