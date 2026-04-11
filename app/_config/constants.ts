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
  sections: {
    delivered: TelegramSectionConfig;
    unconfirmed: TelegramSectionConfig;
    awaitFilming: TelegramSectionConfig;
    awaitRoughCut: TelegramSectionConfig;
    awaitDraft: TelegramSectionConfig;
    awaitMaster: TelegramSectionConfig;
    awaitDeliver: TelegramSectionConfig;
  };
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
  sections: {
    delivered: { emoji: '✅', label: 'Delivered this month', enabled: true },
    unconfirmed: { emoji: '⬜', label: 'Wait Project Confirm', enabled: true },
    awaitFilming: { emoji: '🎬', label: 'Await Filming', enabled: true },
    awaitRoughCut: { emoji: '✂️', label: 'Await Rough Cut', enabled: true },
    awaitDraft: { emoji: '📝', label: 'Await Draft/VO', enabled: true },
    awaitMaster: { emoji: '🎯', label: 'Await Master', enabled: true },
    awaitDeliver: { emoji: '🏁', label: 'Await Mark as Completed', enabled: true },
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
