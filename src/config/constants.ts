// ── Project phases ────────────────────────────────────────────────────────────
import type { ProjectPhases } from '@/src/types';

export const PHASES: { key: keyof ProjectPhases; label: string }[] = [
  { key: 'filming', label: 'Filming' },
  { key: 'roughCut', label: 'Rough Cut' },
  { key: 'draft', label: 'Draft/VO' },
  { key: 'master', label: 'Master' },
  { key: 'delivered', label: 'Done' },
];

// ── Invoice ───────────────────────────────────────────────────────────────────
export const PAYMENT_TERMS = ['Due on receipt', 'Net 15', 'Net 30', 'Net 45', 'Net 60'] as const;

// ── App defaults ──────────────────────────────────────────────────────────────
export const PAGE_SIZE = 10;

export const DEFAULT_SCOPES = [
  'Video x1',
  'Photo album (5–10 photos)',
  'Join Event x1',
  'Short Reel Music x1',
  'Story x1',
  'Poster x1',
  'Pre-Announcement Teaser x1',
];

// ── Telegram template ─────────────────────────────────────────────────────────

export interface TelegramSectionConfig {
  emoji: string;
  label: string;
  enabled: boolean;
}

export interface TelegramTimeline {
  overdue: string; // days < 0 or === 0
  urgent: string; // ≤ 3d left
  soon: string; // ≤ 10d left
  ok: string; // > 10d left
  noDate: string; // no deliver date
}

export interface TelegramTemplate {
  headerEmoji: string;
  headerTitle: string;
  timeline: TelegramTimeline;
}

export const DEFAULT_TELEGRAM_TEMPLATE: TelegramTemplate = {
  headerEmoji: '📊',
  headerTitle: 'PROJECT UPDATE',
  timeline: {
    overdue: '🔴',
    urgent: '🟠',
    soon: '🟡',
    ok: '🟢',
    noDate: '▸',
  },
};

// ── localStorage keys for UI preferences ──────────────────────────────────────
export const STORAGE_KEYS = {
  tableCliCol: 'tbl_cli_col',
  tableCliDir: 'tbl_cli_dir',
  tableCliPage: 'tbl_cli_page',
  tableInvCol: 'tbl_inv_col',
  tableInvDir: 'tbl_inv_dir',
  tableInvPage: 'tbl_inv_page',
} as const;
