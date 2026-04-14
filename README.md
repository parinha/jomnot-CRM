# Studio

A personal freelance studio management app for video, photo, and event production work. Built with Next.js, Firebase, and deployed as a PWA.

## Features

- **Dashboard** — overview of active projects, recent invoices, and revenue summary
- **Projects** — full project lifecycle from unconfirmed → confirmed → on-hold → completed, with 5-phase production tracking (filming, rough cut, draft, master, delivered), per-project task items, Kanban board, and timeline view
- **Clients** — client directory with contact info, VAT/TIN, invoice history, and project history
- **Invoices** — create and manage invoices with line items, deposit %, WHT deduction, payment terms, and print-ready PDF view
- **Payments** — track deposit and final payment status across invoices
- **Reports** — revenue breakdown by client, project, and period
- **Settings** — company profile, bank/payment info, Telegram notification config, and scope-of-work presets
- **Telegram integration** — push project updates to a Telegram chat via bot
- **PWA** — installable on mobile and desktop

## Tech Stack

- **Next.js 16** (App Router, React Server Components, Server Actions)
- **Firebase** — Firestore (database), Firebase Auth (authentication)
- **Firebase Admin SDK** — server-side data access via service account
- **Tailwind CSS**
- **Feature-Sliced Architecture** — `src/features/[name]/{api,actions,components}`

## Project Structure

```
├── app/
│   ├── (print)/invoices/[id]/   # Print-only invoice page
│   ├── api/telegram-project-update/
│   ├── dashboard/
│   │   ├── layout.tsx           # Auth guard + shell (async RSC)
│   │   ├── page.tsx             # Dashboard overview
│   │   ├── clients/
│   │   ├── invoices/
│   │   ├── kanban/
│   │   ├── payments/
│   │   ├── projects/
│   │   ├── reports/
│   │   ├── settings/
│   │   └── timeline/
│   ├── login/
│   └── layout.tsx
│
└── src/
    ├── components/              # Shared UI primitives
    │   ├── ConfirmDeleteModal.tsx
    │   ├── FormField.tsx
    │   ├── ModalShell.tsx
    │   ├── Pagination.tsx
    │   ├── SearchInput.tsx
    │   └── SortTh.tsx
    ├── config/
    │   ├── constants.ts
    │   └── statusConfig.ts
    ├── features/
    │   ├── auth/                # AuthProvider, AuthGuard
    │   ├── clients/             # api, actions, ClientsView
    │   ├── dashboard/           # DashboardShell, DashboardView, Telegram button
    │   ├── invoices/            # api, actions, InvoicesView, InvoicePrint, calculations
    │   ├── payments/            # PaymentsView, QuickPayModal
    │   ├── projects/            # api, actions, ProjectsView, KanbanView, TimelineView, ProjectDetailModal
    │   ├── reports/             # ReportsView
    │   └── settings/            # api, actions, SettingsView
    ├── lib/
    │   ├── auth.ts
    │   ├── firebase-admin.ts    # Lazy-proxy Admin SDK (defers init to first use)
    │   ├── firebase-client.ts
    │   ├── formatters.ts
    │   └── id.ts
    └── types/
        └── index.ts             # Client, Invoice, Project, Settings types
```

## Environment Variables

Create a `.env.local` file in the project root:

```env
# Firebase client-side (public)
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=

# Firebase Admin SDK (server-side only)
# Paste the service account JSON as a single compact line (no newlines)
# Firebase Console → Project Settings → Service accounts → Generate new private key
# Minify: python3 -c "import sys,json; print(json.dumps(json.load(sys.stdin)))" < serviceAccount.json
FIREBASE_SERVICE_ACCOUNT={"type":"service_account","project_id":"..."}
```

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Build

```bash
npm run build
npm start
```
