// ── Financial ─────────────────────────────────────────────────────────────────
export const WHT_RATE = 0.15

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
  'Video content',
  'Photo album (5–10 photos)',
  'Joining event — shoutout photo/video',
  'Short reel with music',
  'Story',
]

// ── localStorage keys (single source of truth) ────────────────────────────────
export const STORAGE_KEYS = {
  clients:        'app_clients',
  invoices:       'app_invoices',
  projects:       'app_projects',
  scopes:         'app_scopes',
  companyProfile: 'company_profile',
  paymentInfo:    'payment_info',
  tableCliCol:    'tbl_cli_col',
  tableCliDir:    'tbl_cli_dir',
  tableCliPage:   'tbl_cli_page',
  tableInvCol:    'tbl_inv_col',
  tableInvDir:    'tbl_inv_dir',
  tableInvPage:   'tbl_inv_page',
} as const
