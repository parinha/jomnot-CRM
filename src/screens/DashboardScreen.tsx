'use client';

import Link from 'next/link';
import { useInvoices } from '@/src/hooks/useInvoices';
import { useProjects } from '@/src/hooks/useProjects';
import { useClients } from '@/src/hooks/useClients';
import { useCurrency, useAppPreferences } from '@/src/hooks/useAppPreferences';
import { calcSubtotal, calcEarned, taxConfigFromPrefs } from '@/src/lib/calculations';
import { STATUS_CONFIG } from '@/src/config/statusConfig';
import type { Invoice, InvoiceStatus } from '@/src/types';

// ── Helpers ───────────────────────────────────────────────────────────────────

const MONTH_SHORT = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

function getYM(offset = 0): string {
  const d = new Date();
  const m = new Date(d.getFullYear(), d.getMonth() + offset, 1);
  return `${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, '0')}`;
}

function ymLabel(s: string): string {
  return MONTH_SHORT[(parseInt(s.split('-')[1], 10) - 1 + 12) % 12] ?? s;
}

function ymFullLabel(s: string): string {
  const [y, m] = s.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'long' });
}

const STATUS_COLORS: Record<InvoiceStatus, string> = {
  paid: '#10b981',
  sent: '#3b82f6',
  partial: '#f59e0b',
  overdue: '#ef4444',
  draft: '#6b7280',
};

// ── Dashboard ─────────────────────────────────────────────────────────────────

export default function DashboardScreen() {
  const { data: invoices } = useInvoices();
  const { data: projects } = useProjects();
  const { data: clients } = useClients();
  const { fmtAmount: fmt, fmtShort } = useCurrency();
  const prefs = useAppPreferences();
  const taxConfig = taxConfigFromPrefs(prefs);

  const todayStr = (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  })();

  const thisYM = getYM(0);
  const lastYM = getYM(-1);
  const nextYM = getYM(1);

  const thisMonthName = ymFullLabel(thisYM);
  const lastMonthName = ymFullLabel(lastYM);
  const nextMonthName = ymFullLabel(nextYM);

  // ── KPIs ───────────────────────────────────────────────────────────────────
  const thisMonthInvs = invoices.filter((i) => i.date.startsWith(thisYM));
  const thisMonthBilled = thisMonthInvs.reduce((s, i) => s + calcSubtotal(i), 0);
  const thisMonthEarned = thisMonthInvs.reduce((s, i) => s + calcEarned(i, taxConfig), 0);
  const thisMonthProjCount = new Set(
    thisMonthInvs.flatMap((inv) =>
      projects.filter((p) => p.invoiceIds.includes(inv.id)).map((p) => p.id)
    )
  ).size;

  const lastMonthBilled = invoices
    .filter((i) => i.date.startsWith(lastYM))
    .reduce((s, i) => s + calcSubtotal(i), 0);

  const nextMonthProjs = projects.filter((p) => p.confirmedMonth === nextYM);
  const nextMonthPipeline = nextMonthProjs.reduce((s, p) => s + (p.budget ?? 0), 0);

  const momPct =
    lastMonthBilled > 0
      ? Math.round(((thisMonthBilled - lastMonthBilled) / lastMonthBilled) * 100)
      : null;

  // ── Revenue history (last 6 months) ───────────────────────────────────────
  const revenueHistory = Array.from({ length: 6 }, (_, i) => {
    const ymStr = getYM(i - 5);
    const invs = invoices.filter((inv) => inv.date.startsWith(ymStr));
    return {
      label: ymLabel(ymStr),
      billed: invs.reduce((s, inv) => s + calcSubtotal(inv), 0),
      earned: invs.reduce((s, inv) => s + calcEarned(inv, taxConfig), 0),
    };
  });
  const maxRevenue = Math.max(...revenueHistory.map((d) => Math.max(d.billed, d.earned)), 1);

  // ── Invoice status donut ───────────────────────────────────────────────────
  const statuses: InvoiceStatus[] = ['paid', 'sent', 'partial', 'overdue', 'draft'];
  const statusDist = statuses
    .map((s) => ({
      status: s,
      count: invoices.filter((i) => (i.status ?? 'draft') === s).length,
      amount: invoices
        .filter((i) => (i.status ?? 'draft') === s)
        .reduce((sum, i) => sum + calcSubtotal(i), 0),
      label: STATUS_CONFIG[s].label,
    }))
    .filter((d) => d.count > 0);

  // ── Alerts ─────────────────────────────────────────────────────────────────
  const overdueInvs = invoices
    .filter((i) => i.status === 'overdue')
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 5);

  const unpaidInvs = invoices
    .filter((i) => i.status === 'sent')
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 5);

  const lateProjects = projects
    .filter((p) => p.status !== 'completed' && p.deliverDate && p.deliverDate < todayStr)
    .sort((a, b) => (a.deliverDate ?? '').localeCompare(b.deliverDate ?? ''))
    .slice(0, 5);

  // ── Top clients (last 3 months) ────────────────────────────────────────────
  const last3YMs = [getYM(-2), getYM(-1), getYM(0)];
  const clientTotals: Record<string, number> = {};
  for (const inv of invoices) {
    if (!last3YMs.some((m) => inv.date.startsWith(m))) continue;
    clientTotals[inv.clientId] = (clientTotals[inv.clientId] ?? 0) + calcSubtotal(inv);
  }
  const clientMax = Math.max(...Object.values(clientTotals), 1);
  const topClients = Object.entries(clientTotals)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([clientId, total]) => ({
      client: clients.find((c) => c.id === clientId),
      total,
      pct: Math.round((total / clientMax) * 100),
    }))
    .filter((d) => d.client);

  return (
    <div className="px-4 pt-5 pb-28 flex flex-col gap-5">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Dashboard</h1>
        <p className="text-sm text-white/40 mt-0.5">
          {new Date().toLocaleDateString('en-US', {
            weekday: 'long',
            month: 'long',
            day: 'numeric',
          })}
        </p>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-2 gap-3">
        <KPICard
          label={thisMonthName}
          sub="Billed"
          value={fmt(thisMonthBilled)}
          note={`${thisMonthProjCount} project${thisMonthProjCount !== 1 ? 's' : ''}`}
          accent="amber"
          iconD="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
        />
        <KPICard
          label="Collected"
          sub={thisMonthName}
          value={fmt(thisMonthEarned)}
          note={
            thisMonthBilled > 0
              ? `${Math.round((thisMonthEarned / thisMonthBilled) * 100)}% of billed`
              : 'No invoices yet'
          }
          accent="green"
          iconD="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
        />
        <KPICard
          label={lastMonthName}
          sub="Billed"
          value={fmt(lastMonthBilled)}
          note={momPct !== null ? `${momPct >= 0 ? '+' : ''}${momPct}% vs this month` : 'No data'}
          accent="sky"
          iconD="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
        />
        <KPICard
          label={nextMonthName}
          sub="Pipeline"
          value={fmt(nextMonthPipeline)}
          note={`${nextMonthProjs.length} project${nextMonthProjs.length !== 1 ? 's' : ''} confirmed`}
          accent="purple"
          iconD="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V7z"
        />
      </div>

      {/* Revenue Chart */}
      <RevenueChart data={revenueHistory} maxVal={maxRevenue} fmtShort={fmtShort} />

      {/* Invoice Status Donut */}
      {invoices.length > 0 && (
        <StatusDonut
          data={statusDist}
          total={invoices.length}
          totalValue={invoices.reduce((s, i) => s + calcSubtotal(i), 0)}
          fmt={fmt}
        />
      )}

      {/* Overdue Invoices */}
      {overdueInvs.length > 0 && (
        <InvoiceAlertList
          title="Overdue Invoices"
          accent="red"
          iconD="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
          items={overdueInvs}
          clients={clients}
          fmt={fmt}
        />
      )}

      {/* Awaiting Payment */}
      {unpaidInvs.length > 0 && (
        <InvoiceAlertList
          title="Awaiting Payment"
          accent="amber"
          iconD="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
          items={unpaidInvs}
          clients={clients}
          fmt={fmt}
        />
      )}

      {/* Late Projects */}
      {lateProjects.length > 0 && (
        <div className="bg-rose-500/10 border border-rose-500/20 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <svg
              className="w-4 h-4 text-rose-400 shrink-0"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <h3 className="text-sm font-semibold text-rose-300">Late Projects</h3>
            <span className="ml-auto text-xs font-bold px-1.5 py-0.5 rounded-full bg-white/10 text-white/40">
              {lateProjects.length}
            </span>
          </div>
          <div className="flex flex-col divide-y divide-white/[0.05]">
            {lateProjects.map((p) => {
              const client = clients.find((c) => c.id === p.clientId);
              const daysLate = p.deliverDate
                ? Math.floor(
                    (new Date(todayStr).getTime() - new Date(p.deliverDate).getTime()) / 86400000
                  )
                : 0;
              return (
                <Link
                  href="/projects"
                  key={p.id}
                  className="flex items-center justify-between py-2.5 first:pt-0 last:pb-0"
                >
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-white truncate">{p.name}</p>
                    <p className="text-[10px] text-white/40">{client?.name ?? '—'}</p>
                  </div>
                  <span className="text-[10px] font-bold text-rose-400 shrink-0 ml-3">
                    {daysLate}d late
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* Top Clients */}
      {topClients.length > 0 && (
        <div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl p-4">
          <h3 className="text-sm font-semibold text-white mb-1">Top Clients</h3>
          <p className="text-[10px] text-white/30 mb-4">Last 3 months by billed amount</p>
          <div className="flex flex-col gap-3">
            {topClients.map(({ client, total, pct }, i) => (
              <div key={client!.id} className="flex flex-col gap-1">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-[10px] font-bold text-white/30 w-4 shrink-0">
                      {i + 1}
                    </span>
                    <div className="w-6 h-6 rounded-lg bg-[#FFC206]/20 text-[#FFC206] flex items-center justify-center text-[10px] font-bold shrink-0">
                      {client!.name.charAt(0).toUpperCase()}
                    </div>
                    <span className="text-xs font-medium text-white truncate">{client!.name}</span>
                  </div>
                  <span className="text-xs font-bold text-white shrink-0 ml-2 amt">
                    {fmt(total)}
                  </span>
                </div>
                <div className="ml-6 h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                  <div
                    className="h-full rounded-full bg-[#FFC206]/60 transition-all"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {invoices.length === 0 && projects.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-white/30">
          <svg
            className="w-12 h-12 mb-3 text-white/10"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
            />
          </svg>
          <p className="text-sm">No data yet. Create your first invoice or project.</p>
        </div>
      )}
    </div>
  );
}

// ── KPI Card ──────────────────────────────────────────────────────────────────

function KPICard({
  label,
  sub,
  value,
  note,
  accent,
  iconD,
}: {
  label: string;
  sub: string;
  value: string;
  note: string;
  accent: 'amber' | 'green' | 'sky' | 'purple';
  iconD: string;
}) {
  const A = {
    amber: {
      bg: 'bg-amber-500/10',
      border: 'border-amber-500/20',
      icon: 'text-amber-400',
      lbl: 'text-amber-300/80',
    },
    green: {
      bg: 'bg-emerald-500/10',
      border: 'border-emerald-500/20',
      icon: 'text-emerald-400',
      lbl: 'text-emerald-300/80',
    },
    sky: {
      bg: 'bg-sky-500/10',
      border: 'border-sky-500/20',
      icon: 'text-sky-400',
      lbl: 'text-sky-300/80',
    },
    purple: {
      bg: 'bg-violet-500/10',
      border: 'border-violet-500/20',
      icon: 'text-violet-400',
      lbl: 'text-violet-300/80',
    },
  }[accent];

  return (
    <div className={`rounded-2xl p-4 border ${A.bg} ${A.border}`}>
      <div className="flex items-start justify-between mb-2">
        <div>
          <p className={`text-[10px] font-bold uppercase tracking-wider ${A.lbl}`}>{label}</p>
          <p className="text-[10px] text-white/30">{sub}</p>
        </div>
        <svg
          className={`w-4 h-4 ${A.icon} shrink-0`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.75}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d={iconD} />
        </svg>
      </div>
      <p className="text-lg font-bold text-white leading-tight truncate amt">{value}</p>
      <p className="text-[10px] text-white/40 mt-1 truncate">{note}</p>
    </div>
  );
}

// ── Revenue Bar Chart ─────────────────────────────────────────────────────────

function RevenueChart({
  data,
  maxVal,
  fmtShort,
}: {
  data: { label: string; billed: number; earned: number }[];
  maxVal: number;
  fmtShort: (n: number) => string;
}) {
  const BAR_H = 96;
  return (
    <div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-white">Revenue — Last 6 Months</h3>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1 text-[10px] text-white/40">
            <span className="w-2.5 h-2 rounded-sm bg-[#FFC206]/60 inline-block" />
            Billed
          </span>
          <span className="flex items-center gap-1 text-[10px] text-white/40">
            <span className="w-2.5 h-2 rounded-sm bg-emerald-500/60 inline-block" />
            Earned
          </span>
        </div>
      </div>
      <div className="flex items-end gap-1.5" style={{ height: BAR_H + 20 }}>
        {data.map((d, i) => {
          const bH = maxVal > 0 ? Math.round((d.billed / maxVal) * BAR_H) : 0;
          const eH = maxVal > 0 ? Math.round((d.earned / maxVal) * BAR_H) : 0;
          const isCurrentMonth = i === data.length - 1;
          return (
            <div key={i} className="flex-1 flex flex-col items-center gap-1">
              <div className="w-full flex items-end gap-0.5" style={{ height: BAR_H }}>
                <div
                  className={`flex-1 rounded-t transition-all ${isCurrentMonth ? 'bg-[#FFC206]/80' : 'bg-[#FFC206]/40'}`}
                  style={{ height: bH > 0 ? bH : 0 }}
                />
                <div
                  className={`flex-1 rounded-t transition-all ${isCurrentMonth ? 'bg-emerald-400/80' : 'bg-emerald-500/40'}`}
                  style={{ height: eH > 0 ? eH : 0 }}
                />
              </div>
              <span
                className={`text-[9px] ${isCurrentMonth ? 'text-white/70 font-semibold' : 'text-white/30'}`}
              >
                {d.label}
              </span>
            </div>
          );
        })}
      </div>
      <div className="flex justify-between mt-2">
        <span className="text-[9px] text-white/20">$0</span>
        <span className="text-[9px] text-white/20">{fmtShort(maxVal)}</span>
      </div>
    </div>
  );
}

// ── Invoice Status Donut ──────────────────────────────────────────────────────

function StatusDonut({
  data,
  total,
  totalValue,
  fmt,
}: {
  data: { status: string; count: number; amount: number; label: string }[];
  total: number;
  totalValue: number;
  fmt: (n: number) => string;
}) {
  const r = 36,
    cx = 50,
    cy = 50;
  const circ = 2 * Math.PI * r;
  const GAP = data.length > 1 ? 2.5 : 0;

  const segs = data.reduce<
    { status: string; count: number; amount: number; label: string; len: number; acc: number }[]
  >((out, d) => {
    const prevAcc =
      out.length > 0 ? out[out.length - 1].acc + (out[out.length - 1].count / total) * circ : 0;
    const fullArc = (d.count / total) * circ;
    const len = Math.max(0, fullArc - GAP);
    return [...out, { ...d, len, acc: prevAcc }];
  }, []);

  return (
    <div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl p-4">
      <h3 className="text-sm font-semibold text-white mb-4">Invoice Breakdown</h3>
      <div className="flex items-center gap-5">
        {/* Donut */}
        <div className="shrink-0">
          <svg viewBox="0 0 100 100" className="w-32 h-32">
            <circle
              cx={cx}
              cy={cy}
              r={r}
              fill="none"
              stroke="rgba(255,255,255,0.05)"
              strokeWidth={13}
            />
            <g transform={`rotate(-90 ${cx} ${cy})`}>
              {segs.map((seg, i) => (
                <circle
                  key={i}
                  cx={cx}
                  cy={cy}
                  r={r}
                  fill="none"
                  stroke={STATUS_COLORS[seg.status as InvoiceStatus] ?? '#6b7280'}
                  strokeWidth={13}
                  strokeDasharray={`${seg.len} ${circ - seg.len}`}
                  strokeDashoffset={-seg.acc}
                  strokeLinecap="butt"
                />
              ))}
            </g>
            <text
              x={cx}
              y={cy - 4}
              textAnchor="middle"
              fill="white"
              fontSize="16"
              fontWeight="bold"
            >
              {total}
            </text>
            <text x={cx} y={cy + 9} textAnchor="middle" fill="rgba(255,255,255,0.4)" fontSize="7">
              invoices
            </text>
          </svg>
        </div>

        {/* Legend */}
        <div className="flex-1 flex flex-col gap-2 min-w-0">
          {segs.map((seg) => (
            <div key={seg.status} className="flex items-center gap-2">
              <div
                className="w-2 h-2 rounded-full shrink-0"
                style={{ backgroundColor: STATUS_COLORS[seg.status as InvoiceStatus] ?? '#6b7280' }}
              />
              <span className="text-xs text-white/60 flex-1 truncate">{seg.label}</span>
              <span className="text-xs font-bold text-white shrink-0">{seg.count}</span>
            </div>
          ))}
          <div className="mt-1 pt-2 border-t border-white/[0.07]">
            <p className="text-[10px] text-white/30 mb-0.5">Total value</p>
            <p className="text-sm font-bold text-white amt">{fmt(totalValue)}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Invoice Alert List ────────────────────────────────────────────────────────

function InvoiceAlertList({
  title,
  accent,
  iconD,
  items,
  clients,
  fmt,
}: {
  title: string;
  accent: 'red' | 'amber';
  iconD: string;
  items: Invoice[];
  clients: ReturnType<typeof useClients>['data'];
  fmt: (n: number) => string;
}) {
  const A = {
    red: {
      bg: 'bg-red-500/10',
      border: 'border-red-500/20',
      icon: 'text-red-400',
      title: 'text-red-300',
    },
    amber: {
      bg: 'bg-amber-500/10',
      border: 'border-amber-500/20',
      icon: 'text-amber-400',
      title: 'text-amber-300',
    },
  }[accent];

  return (
    <div className={`rounded-2xl p-4 border ${A.bg} ${A.border}`}>
      <div className="flex items-center gap-2 mb-3">
        <svg
          className={`w-4 h-4 ${A.icon} shrink-0`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d={iconD} />
        </svg>
        <h3 className={`text-sm font-semibold ${A.title}`}>{title}</h3>
        <span className="ml-auto text-xs font-bold px-1.5 py-0.5 rounded-full bg-white/10 text-white/40">
          {items.length}
        </span>
      </div>
      <div className="flex flex-col divide-y divide-white/[0.05]">
        {items.map((inv) => {
          const client = clients.find((c) => c.id === inv.clientId);
          return (
            <Link
              href="/invoices"
              key={inv.id}
              className="flex items-center justify-between py-2.5 first:pt-0 last:pb-0 active:opacity-70 transition-opacity"
            >
              <div className="min-w-0">
                <p className="text-xs font-semibold text-white">{inv.number}</p>
                <p className="text-[10px] text-white/40">
                  {client?.name ?? '—'} · {inv.date}
                </p>
              </div>
              <span className="text-xs font-bold text-white shrink-0 ml-3 amt">
                {fmt(calcSubtotal(inv))}
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
