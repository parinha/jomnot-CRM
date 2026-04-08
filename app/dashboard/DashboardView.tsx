'use client';

import Link from 'next/link';
import { useStore } from './AppStore';
import { calcSubtotal, calcEarned, calcBalance, calcNet } from '@/app/_services/invoiceService';
import { fmtUSD, fmtShort } from '@/app/_lib/formatters';
import { STATUS_CONFIG, PROJECT_STATUS_CONFIG } from '@/app/_config/statusConfig';

// ── Helpers ────────────────────────────────────────────────────────────────────

function startOfMonth(): string {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
}

function endOfMonth(): string {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().slice(0, 10);
}

function monthLabel(): string {
  return new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

function projectProgress(items: { status: string }[]): number {
  if (!items.length) return 0;
  return Math.round((items.filter((i) => i.status === 'done').length / items.length) * 100);
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  sub,
  accent,
  href,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: string; // Tailwind bg class for left border
  href?: string;
}) {
  const inner = (
    <div
      className={[
        'bg-white rounded-xl border border-zinc-200 p-5 flex flex-col gap-1 hover:shadow-sm transition',
        accent ? `border-l-4 ${accent}` : '',
      ].join(' ')}
    >
      <p className="text-xs font-medium text-zinc-400 uppercase tracking-wider">{label}</p>
      <p className="text-2xl font-bold text-zinc-900 leading-tight">{value}</p>
      {sub && <p className="text-xs text-zinc-400 mt-0.5">{sub}</p>}
    </div>
  );
  return href ? <Link href={href}>{inner}</Link> : inner;
}

// ── Main ───────────────────────────────────────────────────────────────────────

export default function DashboardView() {
  const { clients, invoices, projects, loading } = useStore();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48 text-zinc-400 text-sm">Loading…</div>
    );
  }

  const som = startOfMonth();
  const eom = endOfMonth();

  // ── This-month invoices ──────────────────────────────────────────────────────
  const thisMonth = invoices.filter((inv) => inv.date >= som && inv.date <= eom);
  const invoicedThisMonth = thisMonth.reduce((s, inv) => s + calcSubtotal(inv), 0);
  const earnedThisMonth = thisMonth.reduce((s, inv) => s + calcEarned(inv), 0);

  // ── Overdue ──────────────────────────────────────────────────────────────────
  const overdueInvoices = invoices.filter((inv) => inv.status === 'overdue');
  const overdueAmount = overdueInvoices.reduce((s, inv) => s + calcBalance(inv), 0);

  // ── Outstanding (all unpaid) ─────────────────────────────────────────────────
  const outstanding = invoices
    .filter((inv) => inv.status === 'sent' || inv.status === 'partial' || inv.status === 'overdue')
    .reduce((s, inv) => s + calcBalance(inv), 0);

  // ── All-time earned ──────────────────────────────────────────────────────────
  const totalEarned = invoices.reduce((s, inv) => s + calcEarned(inv), 0);

  // ── Projects ─────────────────────────────────────────────────────────────────
  const activeProjects = projects.filter((p) => p.status === 'active');
  const completedProjects = projects.filter((p) => p.status === 'completed');

  // ── Recent invoices (last 5, sorted by date desc) ────────────────────────────
  const recentInvoices = [...invoices].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 6);

  // ── Invoice status breakdown ─────────────────────────────────────────────────
  const statusCounts: Record<string, number> = {};
  for (const inv of invoices) {
    statusCounts[inv.status] = (statusCounts[inv.status] ?? 0) + 1;
  }

  return (
    <div className="flex flex-col gap-6 max-w-6xl">
      {/* ── Header ── */}
      <div>
        <h1 className="text-xl font-bold text-zinc-900">Overview</h1>
        <p className="text-sm text-zinc-400 mt-0.5">{monthLabel()}</p>
      </div>

      {/* ── Overdue alert ── */}
      {overdueInvoices.length > 0 && (
        <Link
          href="/dashboard/invoices"
          className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-xl px-5 py-3.5 hover:bg-red-100 transition"
        >
          <svg
            className="w-5 h-5 text-red-500 shrink-0"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
            />
          </svg>
          <div className="flex-1 min-w-0">
            <span className="text-sm font-semibold text-red-700">
              {overdueInvoices.length} overdue invoice{overdueInvoices.length > 1 ? 's' : ''}
            </span>
            <span className="text-sm text-red-500 ml-2">— {fmtUSD(overdueAmount)} outstanding</span>
          </div>
          <svg
            className="w-4 h-4 text-red-400 shrink-0"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </Link>
      )}

      {/* ── Stat cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          label="Invoiced this month"
          value={fmtShort(invoicedThisMonth)}
          sub={`${thisMonth.length} invoice${thisMonth.length !== 1 ? 's' : ''}`}
          accent="border-l-amber-400"
          href="/dashboard/invoices"
        />
        <StatCard
          label="Earned this month"
          value={fmtShort(earnedThisMonth)}
          sub="Cash received"
          accent="border-l-green-400"
          href="/dashboard/invoices"
        />
        <StatCard
          label="Outstanding"
          value={fmtShort(outstanding)}
          sub="Awaiting payment"
          accent="border-l-blue-400"
          href="/dashboard/payments"
        />
        <StatCard
          label="Total earned"
          value={fmtShort(totalEarned)}
          sub="All time"
          href="/dashboard/reports"
        />
      </div>

      {/* ── Second row: clients + projects ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          label="Clients"
          value={String(clients.length)}
          sub="Total"
          href="/dashboard/clients"
        />
        <StatCard
          label="Active projects"
          value={String(activeProjects.length)}
          sub={`${completedProjects.length} completed`}
          href="/dashboard/projects"
        />
        <StatCard
          label="Total invoices"
          value={String(invoices.length)}
          sub={`${statusCounts['draft'] ?? 0} draft`}
          href="/dashboard/invoices"
        />
        <StatCard
          label="Overdue"
          value={String(overdueInvoices.length)}
          sub={overdueInvoices.length > 0 ? fmtUSD(overdueAmount) : 'All clear'}
          accent={overdueInvoices.length > 0 ? 'border-l-red-400' : undefined}
          href="/dashboard/invoices"
        />
      </div>

      {/* ── Bottom: Recent invoices + Active projects ── */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Recent invoices */}
        <div className="bg-white rounded-xl border border-zinc-200 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-100">
            <h2 className="text-sm font-semibold text-zinc-800">Recent Invoices</h2>
            <Link
              href="/dashboard/invoices"
              className="text-xs text-amber-600 hover:text-amber-700 font-medium"
            >
              View all
            </Link>
          </div>
          <div className="divide-y divide-zinc-50">
            {recentInvoices.length === 0 && (
              <p className="px-5 py-8 text-sm text-zinc-400 text-center">No invoices yet</p>
            )}
            {recentInvoices.map((inv) => {
              const client = clients.find((c) => c.id === inv.clientId);
              const sc = STATUS_CONFIG[inv.status];
              const net = calcNet(inv);
              return (
                <div key={inv.id} className="flex items-center gap-3 px-5 py-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-zinc-800">{inv.number}</span>
                      <span
                        className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium ${sc.cls}`}
                      >
                        {sc.label}
                      </span>
                    </div>
                    <p className="text-xs text-zinc-400 truncate mt-0.5">
                      {client?.name ?? '—'} · {inv.date}
                    </p>
                  </div>
                  <span className="text-sm font-semibold text-zinc-800 shrink-0">
                    {fmtUSD(net)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Active projects */}
        <div className="bg-white rounded-xl border border-zinc-200 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-100">
            <h2 className="text-sm font-semibold text-zinc-800">Active Projects</h2>
            <Link
              href="/dashboard/projects"
              className="text-xs text-amber-600 hover:text-amber-700 font-medium"
            >
              View all
            </Link>
          </div>
          <div className="divide-y divide-zinc-50">
            {activeProjects.length === 0 && (
              <p className="px-5 py-8 text-sm text-zinc-400 text-center">No active projects</p>
            )}
            {activeProjects.slice(0, 6).map((proj) => {
              const client = clients.find((c) => c.id === proj.clientId);
              const pct = projectProgress(proj.items);
              const sc = PROJECT_STATUS_CONFIG[proj.status];
              const done = proj.items.filter((i) => i.status === 'done').length;
              return (
                <div key={proj.id} className="px-5 py-3">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-sm font-medium text-zinc-800 flex-1 truncate min-w-0">
                      {proj.name}
                    </span>
                    <span
                      className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium ${sc.cls} shrink-0`}
                    >
                      {sc.label}
                    </span>
                  </div>
                  <p className="text-xs text-zinc-400 mb-2">
                    {client?.name ?? '—'} · {done}/{proj.items.length} tasks
                  </p>
                  <div className="h-1.5 bg-zinc-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-amber-400 rounded-full transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <p className="text-[10px] text-zinc-400 mt-1">{pct}% complete</p>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Invoice status breakdown ── */}
      <div className="bg-white rounded-xl border border-zinc-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-zinc-100">
          <h2 className="text-sm font-semibold text-zinc-800">Invoice Status Breakdown</h2>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-5 divide-x divide-y sm:divide-y-0 divide-zinc-100">
          {(['draft', 'sent', 'partial', 'paid', 'overdue'] as const).map((status) => {
            const sc = STATUS_CONFIG[status];
            const count = statusCounts[status] ?? 0;
            const amount = invoices
              .filter((inv) => inv.status === status)
              .reduce((s, inv) => s + calcSubtotal(inv), 0);
            return (
              <div key={status} className="px-5 py-4 flex flex-col gap-1">
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-medium self-start ${sc.cls}`}
                >
                  {sc.label}
                </span>
                <p className="text-xl font-bold text-zinc-900">{count}</p>
                <p className="text-xs text-zinc-400">{fmtShort(amount)}</p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
