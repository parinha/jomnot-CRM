# Studio

A personal freelance studio management app for video, photo, and event production work. Built with Next.js, Firebase, and deployed as a PWA.

## Features

- **Dashboard** — billed, collected and outstanding totals, recent invoices, and revenue summary
- **Clients** — client directory with contact info, VAT/TIN, and invoice history
- **Invoices** — create and manage invoices with line items, deposit %, WHT deduction, payment terms, and print-ready PDF view
- **Payments** — track deposit and final payment status across invoices
- **Reports** — revenue breakdown by client and period
- **Settings** — company profile, bank/payment info, Telegram bot config, and scope-of-work presets
- **Telegram integration** — send invoice PDFs to a Telegram chat via bot
- **PWA** — installable on mobile and desktop

## Tech Stack

- **Next.js 16** (App Router, React Server Components, Server Actions)
- **Firebase** — Firestore (database), Firebase Auth (authentication)
- **Tailwind CSS**
- **Feature-Sliced Architecture** — `src/features/[name]/{api,actions,components}`

## Project Structure

```
├── app/
│   ├── (print)/invoices/[id]/   # Print-only invoice page
│   ├── dashboard/
│   │   ├── layout.tsx           # Auth guard + shell (async RSC)
│   │   ├── page.tsx             # Dashboard overview
│   │   ├── clients/
│   │   ├── invoices/
│   │   ├── payments/
│   │   ├── reports/
│   │   └── settings/
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
    │   ├── dashboard/           # DashboardShell, DashboardView
    │   ├── invoices/            # api, actions, InvoicesView, InvoicePrint, calculations
    │   ├── payments/            # PaymentsView, QuickPayModal
    │   ├── reports/             # ReportsView
    │   └── settings/            # api, actions, SettingsView
    ├── lib/
    │   ├── auth.ts
    │   ├── firebase-client.ts
    │   ├── formatters.ts
    │   └── id.ts
    └── types/
        └── index.ts             # Client, Invoice, Settings types
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
