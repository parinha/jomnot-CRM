'use client';

import Link from 'next/link';
import {
  calcSubtotal,
  calcEarned,
  calcBalance,
  calcNet,
} from '@/src/features/invoices/lib/calculations';
import { fmtUSD, fmtShort, fmtDate } from '@/src/lib/formatters';
import { STATUS_CONFIG, PROJECT_STATUS_CONFIG } from '@/src/config/statusConfig';
import { useClients } from '@/src/hooks/useClients';
import { useInvoices } from '@/src/hooks/useInvoices';
import { useProjects } from '@/src/hooks/useProjects';
import { TablePageSkeleton } from '@/src/components/PageSkeleton';

function localDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function startOfMonth(): string {
  const d = new Date();
  return localDate(new Date(d.getFullYear(), d.getMonth(), 1));
}
function endOfMonth(): string {
  const d = new Date();
  return localDate(new Date(d.getFullYear(), d.getMonth() + 1, 0));
}
function monthLabel(): string {
  return new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}
function projectProgress(items: { status: string }[]): number {
  if (!items.length) return 0;
  return Math.round((items.filter((i) => i.status === 'done').length / items.length) * 100);
}

function StatCard({
  label,
  value,
  sub,
  accent,
  href,
  isAmount,
  isAmountSub,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: string;
  href?: string;
  isAmount?: boolean;
  isAmountSub?: boolean;
}) {
  const inner = (
    <div
      className={[
        'bg-white/[0.06] backdrop-blur-xl border border-white/[0.1] rounded-2xl p-5 flex flex-col gap-1',
        'hover:bg-white/[0.09] transition group',
        accent ? `border-l-4 ${accent}` : '',
      ].join(' ')}
    >
      <p className="text-[11px] font-semibold text-white/45 uppercase tracking-wider">{label}</p>
      <p className="text-2xl font-bold text-white leading-tight">
        {isAmount ? <span className="amt">{value}</span> : value}
      </p>
      {sub && (
        <p className="text-xs text-white/40 mt-0.5">
          {isAmountSub ? <span className="amt">{sub}</span> : sub}
        </p>
      )}
    </div>
  );
  return href ? <Link href={href}>{inner}</Link> : inner;
}

export default function DashboardView() {
  const { data: clients, isLoading } = useClients();
  const { data: invoices } = useInvoices();
  const { data: projects } = useProjects();

  if (isLoading) return <TablePageSkeleton rows={6} />;
  const som = startOfMonth();
  const eom = endOfMonth();

  const thisMonth = invoices.filter((inv) => inv.date >= som && inv.date <= eom);
  const invoicedThisMonth = thisMonth.reduce((s, inv) => s + calcSubtotal(inv), 0);
  const earnedThisMonth = thisMonth.reduce((s, inv) => s + calcEarned(inv), 0);
  const overdueInvoices = invoices.filter((inv) => inv.status === 'overdue');
  const overdueAmount = overdueInvoices.reduce((s, inv) => s + calcBalance(inv), 0);
  const outstanding = invoices
    .filter((inv) => inv.status === 'sent' || inv.status === 'partial' || inv.status === 'overdue')
    .reduce((s, inv) => s + calcBalance(inv), 0);
  const totalEarned = invoices.reduce((s, inv) => s + calcEarned(inv), 0);
  const activeProjects = projects.filter((p) => p.status === 'confirmed');
  const completedProjects = projects.filter((p) => p.status === 'completed');
  const recentInvoices = [...invoices].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 6);
  const statusCounts: Record<string, number> = {};
  for (const inv of invoices) statusCounts[inv.status] = (statusCounts[inv.status] ?? 0) + 1;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Overview</h1>
        <p className="text-sm text-white/45 mt-0.5">{monthLabel()}</p>
      </div>

      {overdueInvoices.length > 0 && (
        <Link
          href="/dashboard/invoices"
          className="flex items-center gap-3 bg-red-500/15 border border-red-500/25 rounded-2xl px-5 py-4 hover:bg-red-500/20 transition backdrop-blur-sm"
        >
          <div className="w-9 h-9 rounded-xl bg-red-500/20 flex items-center justify-center shrink-0">
            <svg
              className="w-5 h-5 text-red-400"
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
          </div>
          <div className="flex-1 min-w-0">
            <span className="text-sm font-bold text-red-300">
              {overdueInvoices.length} late invoice{overdueInvoices.length > 1 ? 's' : ''}
            </span>
            <span className="text-sm text-red-400/70 ml-2">
              — <span className="amt">{fmtUSD(overdueAmount)}</span> outstanding
            </span>
          </div>
          <svg
            className="w-4 h-4 text-red-400/60 shrink-0"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </Link>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          label="Invoiced this month"
          value={fmtShort(invoicedThisMonth)}
          sub={`${thisMonth.length} invoice${thisMonth.length !== 1 ? 's' : ''}`}
          accent="border-l-amber-400"
          href="/dashboard/invoices"
          isAmount
        />
        <StatCard
          label="Earned this month"
          value={fmtShort(earnedThisMonth)}
          sub="Cash received"
          accent="border-l-green-400"
          href="/dashboard/invoices"
          isAmount
        />
        <StatCard
          label="Outstanding"
          value={fmtShort(outstanding)}
          sub="Awaiting payment"
          accent="border-l-blue-400"
          href="/dashboard/payments"
          isAmount
        />
        <StatCard
          label="Total earned"
          value={fmtShort(totalEarned)}
          sub="All time"
          href="/dashboard/reports"
          isAmount
        />
      </div>

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
          label="Late"
          value={String(overdueInvoices.length)}
          sub={overdueInvoices.length > 0 ? fmtUSD(overdueAmount) : 'All clear'}
          accent={overdueInvoices.length > 0 ? 'border-l-red-400' : undefined}
          href="/dashboard/invoices"
          isAmountSub={overdueInvoices.length > 0}
        />
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="bg-white/[0.05] backdrop-blur-xl border border-white/[0.09] rounded-2xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.07]">
            <h2 className="text-sm font-semibold text-white">Recent Invoices</h2>
            <Link
              href="/dashboard/invoices"
              className="text-xs text-[#FFC206] hover:text-amber-300 font-semibold transition"
            >
              View all
            </Link>
          </div>
          <div className="divide-y divide-white/[0.05]">
            {recentInvoices.length === 0 && (
              <p className="px-5 py-8 text-sm text-white/35 text-center">No invoices yet</p>
            )}
            {recentInvoices.map((inv) => {
              const client = clients.find((c) => c.id === inv.clientId);
              const sc = STATUS_CONFIG[inv.status];
              return (
                <div
                  key={inv.id}
                  className="flex items-center gap-3 px-5 py-3.5 hover:bg-white/[0.04] transition"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-white">{inv.number}</span>
                      <span
                        className={`px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${sc.cls}`}
                      >
                        {sc.label}
                      </span>
                    </div>
                    <p className="text-xs text-white/40 truncate mt-0.5">
                      {client?.name ?? '—'} · {fmtDate(inv.date)}
                    </p>
                  </div>
                  <span className="text-sm font-bold text-white shrink-0 amt">
                    {fmtUSD(calcNet(inv))}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-white/[0.05] backdrop-blur-xl border border-white/[0.09] rounded-2xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.07]">
            <h2 className="text-sm font-semibold text-white">Active Projects</h2>
            <Link
              href="/dashboard/projects"
              className="text-xs text-[#FFC206] hover:text-amber-300 font-semibold transition"
            >
              View all
            </Link>
          </div>
          <div className="divide-y divide-white/[0.05]">
            {activeProjects.length === 0 && (
              <p className="px-5 py-8 text-sm text-white/35 text-center">No active projects</p>
            )}
            {activeProjects.slice(0, 6).map((proj) => {
              const client = clients.find((c) => c.id === proj.clientId);
              const pct = projectProgress(proj.items);
              const sc = PROJECT_STATUS_CONFIG[proj.status];
              const done = proj.items.filter((i) => i.status === 'done').length;
              return (
                <div key={proj.id} className="px-5 py-3.5 hover:bg-white/[0.04] transition">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-sm font-semibold text-white flex-1 truncate min-w-0">
                      {proj.name}
                    </span>
                    <span
                      className={`px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${sc.cls} shrink-0`}
                    >
                      {sc.label}
                    </span>
                  </div>
                  <p className="text-xs text-white/40 mb-2">
                    {client?.name ?? '—'} · {done}/{proj.items.length} tasks
                  </p>
                  <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#FFC206] rounded-full transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <p className="text-[10px] text-white/35 mt-1">{pct}% complete</p>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="bg-white/[0.05] backdrop-blur-xl border border-white/[0.09] rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-white/[0.07]">
          <h2 className="text-sm font-semibold text-white">Invoice Status Breakdown</h2>
        </div>
        <div className="grid grid-cols-3 sm:grid-cols-5 divide-x divide-y sm:divide-y-0 divide-white/[0.07]">
          {(['draft', 'sent', 'partial', 'paid', 'overdue'] as const).map((status) => {
            const sc = STATUS_CONFIG[status];
            const count = statusCounts[status] ?? 0;
            const amount = invoices
              .filter((inv) => inv.status === status)
              .reduce((s, inv) => s + calcSubtotal(inv), 0);
            return (
              <div
                key={status}
                className="px-5 py-4 flex flex-col gap-1 hover:bg-white/[0.04] transition"
              >
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-semibold self-start ${sc.cls}`}
                >
                  {sc.label}
                </span>
                <p className="text-2xl font-bold text-white">{count}</p>
                <p className="text-xs text-white/40 amt">{fmtShort(amount)}</p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
