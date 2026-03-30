// ── Invoice ───────────────────────────────────────────────────────────────────
export const PAYMENT_TERMS = [
  'Due on receipt',
  'Net 15',
  'Net 30',
  'Net 45',
  'Net 60',
] as const

// ── App defaults ──────────────────────────────────────────────────────────────
export const PAGE_SIZE = 10

export const DEFAULT_SCOPES = [
  'Video x1',
  'Photo album (5–10 photos)',
  'Join Event x1',
  'Short Reel Music x1',
  'Story x1',
  'Poster x1',
  'Pre-Announcement Teaser x1',
]

// ── localStorage keys for UI preferences ──────────────────────────────────────
export const STORAGE_KEYS = {
  tableCliCol:  'tbl_cli_col',
  tableCliDir:  'tbl_cli_dir',
  tableCliPage: 'tbl_cli_page',
  tableInvCol:  'tbl_inv_col',
  tableInvDir:  'tbl_inv_dir',
  tableInvPage: 'tbl_inv_page',
} as const
