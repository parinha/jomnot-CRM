'use client';

import { useState, useMemo } from 'react';
import type { Invoice, InvoiceStatus, Client, Project } from '@/src/types';
import { STATUS_CONFIG, PROJECT_STATUS_CONFIG } from '@/src/config/statusConfig';
import { fmtUSD as fmt, fmtShort } from '@/src/lib/formatters';
import {
  calcEarned,
  calcBalance,
  calcInvoiceTotal,
  calcSubtotal,
  calcNet,
  WHT_RATE,
} from '@/src/features/invoices/lib/calculations';

interface Props {
  invoices: Invoice[];
  clients: Client[];
  projects: Project[];
}

// ── Date helpers ───────────────────────────────────────────────────────────────

function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function thisWeekRange(): [string, string] {
  const now = new Date();
  const day = now.getDay();
  const monday = new Date(now);
  monday.setDate(now.getDate() - (day === 0 ? 6 : day - 1));
  monday.setHours(0, 0, 0, 0);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return [toDateStr(monday), toDateStr(sunday)];
}
function thisMonthRange(): [string, string] {
  const now = new Date();
  return [
    toDateStr(new Date(now.getFullYear(), now.getMonth(), 1)),
    toDateStr(new Date(now.getFullYear(), now.getMonth() + 1, 0)),
  ];
}
function thisYearRange(): [string, string] {
  const y = new Date().getFullYear();
  return [`${y}-01-01`, `${y}-12-31`];
}

type BucketMode = 'day' | 'week' | 'month';
function getBucketMode(start: string, end: string): BucketMode {
  const days = (new Date(end).getTime() - new Date(start).getTime()) / 86400000;
  return days <= 14 ? 'day' : days <= 90 ? 'week' : 'month';
}
function invBucketKey(inv: Invoice, mode: BucketMode): string {
  const d = new Date(inv.date);
  if (mode === 'month') return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  if (mode === 'week') {
    const day = d.getDay();
    const mon = new Date(d);
    mon.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
    return toDateStr(mon);
  }
  return inv.date.slice(0, 10);
}
function generateBuckets(
  start: string,
  end: string,
  mode: BucketMode
): { key: string; label: string }[] {
  const buckets: { key: string; label: string }[] = [];
  const s = new Date(start);
  const e = new Date(end);
  if (mode === 'month') {
    const cur = new Date(s.getFullYear(), s.getMonth(), 1);
    while (cur <= e) {
      buckets.push({
        key: `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}`,
        label: cur.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
      });
      cur.setMonth(cur.getMonth() + 1);
    }
  } else if (mode === 'week') {
    const day = s.getDay();
    const cur = new Date(s);
    cur.setDate(s.getDate() - (day === 0 ? 6 : day - 1));
    cur.setHours(0, 0, 0, 0);
    while (cur <= e) {
      buckets.push({
        key: toDateStr(cur),
        label: cur.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      });
      cur.setDate(cur.getDate() + 7);
    }
  } else {
    const cur = new Date(s);
    while (cur <= e) {
      buckets.push({
        key: toDateStr(cur),
        label: cur.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      });
      cur.setDate(cur.getDate() + 1);
    }
  }
  return buckets;
}

const BAR_COLORS = ['#FFC206', '#E5AE00', '#71717a', '#a1a1aa', '#d4d4d8'];
const QUICK_RANGES = [
  { label: 'This Week', fn: thisWeekRange },
  { label: 'This Month', fn: thisMonthRange },
  { label: 'This Year', fn: thisYearRange },
];

// ── Component ─────────────────────────────────────────────────────────────────

export default function ReportsView({ invoices, clients, projects }: Props) {
  const [[startDate, endDate], setRange] = useState<[string, string]>(() => thisMonthRange());
  const [clientFilter, setClientFilter] = useState('all');

  const base = useMemo(() => {
    const byClient =
      clientFilter === 'all' ? invoices : invoices.filter((inv) => inv.clientId === clientFilter);
    return byClient.filter((inv) => inv.date >= startDate && inv.date <= endDate);
  }, [invoices, clientFilter, startDate, endDate]);

  const totalReceived = base.reduce((s, inv) => s + calcEarned(inv), 0);
  const totalInvoiced = base.reduce((s, inv) => s + calcInvoiceTotal(inv), 0);
  const totalWHT = base
    .filter((inv) => inv.withWHT)
    .reduce((s, inv) => s + calcSubtotal(inv) * WHT_RATE, 0);
  const totalNet = base.reduce((s, inv) => s + calcNet(inv), 0);
  const outstanding = base
    .filter((inv) => ['sent', 'overdue', 'partial'].includes(inv.status ?? 'draft'))
    .reduce((s, inv) => s + calcBalance(inv), 0);
  const overdueCount = base.filter((inv) => (inv.status ?? 'draft') === 'overdue').length;

  const bucketMode = getBucketMode(startDate, endDate);
  const buckets = generateBuckets(startDate, endDate, bucketMode);
  const bucketData = buckets.map((b) => {
    const matched = base.filter((inv) => invBucketKey(inv, bucketMode) === b.key);
    return {
      ...b,
      revenue: matched.reduce((s, inv) => s + calcInvoiceTotal(inv), 0),
      count: matched.length,
    };
  });
  const maxRevenue = Math.max(...bucketData.map((b) => b.revenue), 1);

  const clientData = clients
    .map((c) => {
      const byClient = base.filter((inv) => inv.clientId === c.id);
      return {
        id: c.id,
        name: c.name,
        revenue: byClient.reduce((s, inv) => s + calcInvoiceTotal(inv), 0),
        count: byClient.length,
      };
    })
    .filter((c) => c.revenue > 0)
    .sort((a, b) => b.revenue - a.revenue);
  const maxClientRevenue = Math.max(...clientData.map((c) => c.revenue), 1);

  const statusData = (['paid', 'partial', 'sent', 'overdue', 'draft'] as InvoiceStatus[]).map(
    (s) => {
      const matched = base.filter((inv) => (inv.status ?? 'draft') === s);
      return {
        status: s,
        count: matched.length,
        revenue: matched.reduce((sum, inv) => sum + calcInvoiceTotal(inv), 0),
      };
    }
  );

  const scopeMap = new Map<string, { qty: number }>();
  base.forEach((inv) =>
    inv.items.forEach((it) => {
      const lines = it.description
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean);
      const scopeLines = lines.length > 1 ? lines.slice(1) : lines;
      scopeLines.forEach((line) => {
        const prev = scopeMap.get(line) ?? { qty: 0 };
        scopeMap.set(line, { qty: prev.qty + it.qty });
      });
    })
  );
  const topScopes = Array.from(scopeMap.entries())
    .map(([desc, v]) => ({ desc, ...v }))
    .sort((a, b) => b.qty - a.qty)
    .slice(0, 8);
  const maxScopeQty = Math.max(...topScopes.map((s) => s.qty), 1);

  const filteredProjects = useMemo(
    () => (clientFilter === 'all' ? projects : projects.filter((p) => p.clientId === clientFilter)),
    [projects, clientFilter]
  );
  const projectRows = useMemo(
    () =>
      filteredProjects
        .map((p) => {
          const client = clients.find((c) => c.id === p.clientId);
          const linkedInvs = p.invoiceIds
            .map((id) => invoices.find((i) => i.id === id))
            .filter(Boolean) as typeof invoices;
          const revenue = linkedInvs.reduce((s, inv) => s + calcSubtotal(inv), 0);
          const revenueNet = linkedInvs.reduce((s, inv) => s + calcNet(inv), 0);
          const hasWHT = linkedInvs.some((inv) => inv.withWHT);
          const doneCount = p.items.filter((it) => it.status === 'done').length;
          const totalItems = p.items.length;
          const pct = totalItems > 0 ? Math.round((doneCount / totalItems) * 100) : 0;
          return {
            project: p,
            client,
            linkedInvs,
            revenue,
            revenueNet,
            hasWHT,
            doneCount,
            totalItems,
            pct,
          };
        })
        .sort((a, b) => {
          const order: Record<string, number> = {
            draft: 0,
            confirmed: 1,
            'in-progress': 2,
            'on-hold': 3,
            completed: 4,
          };
          const diff = (order[a.project.status] ?? 99) - (order[b.project.status] ?? 99);
          return diff !== 0 ? diff : b.revenue - a.revenue;
        }),
    [filteredProjects, clients, invoices]
  );

  const projectStatusCounts = (['unconfirmed', 'confirmed', 'on-hold', 'completed'] as const).map(
    (s) => ({
      status: s,
      count: filteredProjects.filter((p) => p.status === s).length,
    })
  );

  const glassCard = 'bg-white/[0.05] backdrop-blur-xl border border-white/[0.09] rounded-2xl';

  return (
    <div className="flex flex-col gap-6 pb-4">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Reports</h1>
          <p className="text-sm text-white/45 mt-0.5">Revenue and invoice analytics</p>
        </div>
        <select
          value={clientFilter}
          onChange={(e) => setClientFilter(e.target.value)}
          className="h-11 rounded-xl border border-white/15 bg-white/10 px-4 text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#FFC206] transition backdrop-blur-sm"
        >
          <option value="all" className="bg-zinc-900">
            All clients
          </option>
          {clients.map((c) => (
            <option key={c.id} value={c.id} className="bg-zinc-900">
              {c.name}
            </option>
          ))}
        </select>
      </div>

      {/* Date range */}
      <div className={`${glassCard} p-4 flex flex-wrap items-center gap-3`}>
        <div className="flex gap-2 flex-wrap">
          {QUICK_RANGES.map(({ label, fn }) => {
            const [s, e] = fn();
            const active = s === startDate && e === endDate;
            return (
              <button
                key={label}
                onClick={() => setRange([s, e])}
                className={`h-11 px-4 rounded-xl text-xs font-semibold border transition whitespace-nowrap ${active ? 'bg-[#FFC206] text-zinc-900 border-[#FFC206]' : 'bg-white/[0.08] text-white border-white/20 hover:bg-white/[0.14]'}`}
              >
                {label}
              </button>
            );
          })}
        </div>
        <div className="hidden sm:block h-5 w-px bg-white/15" />
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-semibold text-white/45">From</span>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setRange([e.target.value, endDate])}
            className="h-10 rounded-xl border border-white/15 bg-white/10 px-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#FFC206] transition"
          />
          <span className="text-xs font-semibold text-white/45">To</span>
          <input
            type="date"
            value={endDate}
            min={startDate}
            onChange={(e) => setRange([startDate, e.target.value])}
            className="h-10 rounded-xl border border-white/15 bg-white/10 px-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#FFC206] transition"
          />
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Received"
          value={fmt(totalReceived)}
          sub={`of ${fmt(totalNet)} net invoiced`}
          accent="green"
        />
        <StatCard
          label="Outstanding"
          value={fmt(outstanding)}
          sub={`${overdueCount} late · incl. partial balance`}
          accent={overdueCount > 0 ? 'red' : undefined}
        />
        <StatCard
          label="Total invoiced"
          value={fmt(totalInvoiced)}
          sub={`${base.length} invoice${base.length !== 1 ? 's' : ''}`}
        />
        {totalWHT > 0 && (
          <StatCard
            label="Total WHT"
            value={fmt(totalWHT)}
            sub={`net ${fmt(totalNet)}`}
            accent="orange"
          />
        )}
      </div>

      {/* Revenue over time */}
      <div className={`${glassCard} p-5`}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-white">Revenue over time</h2>
          <span className="text-xs text-white/40">
            {bucketMode === 'day' ? 'Daily' : bucketMode === 'week' ? 'Weekly' : 'Monthly'}
          </span>
        </div>
        {base.length === 0 ? (
          <div className="h-48 flex items-center justify-center text-white/35 text-sm">
            No invoices in this period
          </div>
        ) : (
          <div className="overflow-x-auto">
            <div className="flex items-end gap-1.5 h-48 min-w-[320px]">
              {bucketData.map((b) => {
                const pct = (b.revenue / maxRevenue) * 100;
                return (
                  <div
                    key={b.key}
                    className="flex-1 flex flex-col items-center gap-1 group min-w-0"
                  >
                    <div className="w-full flex flex-col justify-end" style={{ height: '168px' }}>
                      {b.revenue > 0 ? (
                        <div className="w-full flex flex-col items-center justify-end">
                          <span className="text-xs text-white/50 mb-1 opacity-0 group-hover:opacity-100 transition whitespace-nowrap amt">
                            {fmtShort(b.revenue)}
                          </span>
                          <div
                            className="w-full bg-[#FFC206] rounded-t-md group-hover:bg-amber-400 transition-colors"
                            style={{ height: `${Math.max(pct, 2)}%`, maxHeight: '140px' }}
                          />
                        </div>
                      ) : (
                        <div className="w-full h-0.5 bg-white/10 rounded self-end" />
                      )}
                    </div>
                    <span className="text-xs text-white/35 truncate w-full text-center">
                      {b.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Client + Status breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className={`${glassCard} p-5`}>
          <h2 className="text-sm font-semibold text-white mb-4">Revenue by client</h2>
          {clientData.length === 0 ? (
            <p className="text-sm text-white/35 py-6 text-center">No data</p>
          ) : (
            <div className="flex flex-col gap-3">
              {clientData.map((c, i) => (
                <div key={c.id}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-sm text-white/75 truncate max-w-[60%]">{c.name}</span>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs text-white/35">{c.count} inv</span>
                      <span className="text-sm font-semibold text-white amt">{fmt(c.revenue)}</span>
                    </div>
                  </div>
                  <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${(c.revenue / maxClientRevenue) * 100}%`,
                        backgroundColor: BAR_COLORS[i % BAR_COLORS.length],
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className={`${glassCard} p-5`}>
          <h2 className="text-sm font-semibold text-white mb-4">Invoice status</h2>
          <div className="flex flex-col gap-3">
            {statusData.map(({ status, count, revenue }) => {
              const meta = STATUS_CONFIG[status];
              const pct = base.length > 0 ? (count / base.length) * 100 : 0;
              return (
                <div key={status}>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${meta.bg} ${meta.color}`}
                      >
                        {meta.label}
                      </span>
                      <span className="text-xs text-white/35">
                        {count} invoice{count !== 1 ? 's' : ''}
                      </span>
                    </div>
                    <span className="text-sm font-semibold text-white amt">{fmt(revenue)}</span>
                  </div>
                  <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${meta.bar}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Top scopes */}
      {topScopes.length > 0 && (
        <div className={`${glassCard} p-5`}>
          <h2 className="text-sm font-semibold text-white mb-4">Top scopes of work</h2>
          <div className="flex flex-col gap-3">
            {topScopes.map((s, i) => (
              <div key={i} className="flex items-center gap-3">
                <span className="text-xs text-white/30 w-5 text-right shrink-0">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-white/75 truncate">{s.desc}</span>
                    <span className="text-sm font-semibold text-white shrink-0 ml-3">{s.qty}x</span>
                  </div>
                  <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-white/30 rounded-full"
                      style={{ width: `${(s.qty / maxScopeQty) * 100}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Project Report */}
      {filteredProjects.length > 0 && (
        <>
          <div className="flex items-center gap-3 mt-2">
            <h2 className="text-base font-bold text-white">Projects</h2>
            <div className="flex-1 h-px bg-white/10" />
          </div>

          <div className="grid grid-cols-5 gap-4">
            {projectStatusCounts.map(({ status, count }) => {
              const cfg = PROJECT_STATUS_CONFIG[status];
              return (
                <div key={status} className={`${glassCard} p-4`}>
                  <div
                    className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold mb-2 ${cfg.cls}`}
                  >
                    {cfg.label}
                  </div>
                  <p className="text-2xl font-bold text-white">{count}</p>
                  <p className="text-xs text-white/40 mt-0.5">project{count !== 1 ? 's' : ''}</p>
                </div>
              );
            })}
          </div>

          <div className={`${glassCard} overflow-hidden`}>
            <div className="px-5 py-4 border-b border-white/[0.07]">
              <h3 className="text-sm font-semibold text-white">Project overview</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/[0.08] bg-white/[0.04]">
                    <th className="text-left px-4 py-3 text-xs font-medium text-white/45">
                      Project
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-white/45 hidden sm:table-cell">
                      Client
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-white/45">
                      Status
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-white/45 w-40">
                      Progress
                    </th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-white/45">
                      Invoiced
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {projectRows.map(
                    ({
                      project,
                      client,
                      linkedInvs,
                      revenue,
                      revenueNet,
                      hasWHT,
                      doneCount,
                      totalItems,
                      pct,
                    }) => {
                      const cfg = PROJECT_STATUS_CONFIG[project.status];
                      return (
                        <tr
                          key={project.id}
                          className="border-b border-white/[0.05] last:border-0 hover:bg-white/[0.04] transition"
                        >
                          <td className="px-4 py-3 font-semibold text-white max-w-[160px] truncate">
                            {project.name}
                          </td>
                          <td className="px-4 py-3 text-white/55 hidden sm:table-cell max-w-[120px] truncate">
                            {client?.name ?? '—'}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`px-2 py-0.5 rounded-full text-xs font-semibold ${cfg.cls}`}
                            >
                              {cfg.label}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            {totalItems > 0 ? (
                              <div className="flex items-center gap-2">
                                <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
                                  <div
                                    className={`h-full rounded-full ${pct === 100 ? 'bg-green-400' : 'bg-[#FFC206]'}`}
                                    style={{ width: `${pct}%` }}
                                  />
                                </div>
                                <span className="text-xs text-white/40 shrink-0 w-14 text-right">
                                  {doneCount}/{totalItems} · {pct}%
                                </span>
                              </div>
                            ) : (
                              <span className="text-xs text-white/30">No items</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right whitespace-nowrap">
                            <span className="font-semibold text-white amt">{fmt(revenue)}</span>
                            {linkedInvs.length > 0 && (
                              <span className="text-xs text-white/35 ml-1.5">
                                {linkedInvs.length} inv
                              </span>
                            )}
                            {hasWHT && (
                              <div className="flex flex-col items-end gap-0.5 mt-0.5">
                                <span className="text-xs text-orange-400/80">
                                  −<span className="amt">{fmt(revenue - revenueNet)}</span> WHT
                                </span>
                                <span className="text-xs font-medium text-white/70">
                                  <span className="amt">{fmt(revenueNet)}</span> net
                                </span>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    }
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: 'green' | 'red' | 'orange';
}) {
  const accentCls =
    accent === 'green'
      ? 'border-l-green-400'
      : accent === 'red'
        ? 'border-l-red-400'
        : accent === 'orange'
          ? 'border-l-orange-400'
          : '';
  const subColor =
    accent === 'green'
      ? 'text-green-400'
      : accent === 'red'
        ? 'text-red-400'
        : accent === 'orange'
          ? 'text-orange-400'
          : 'text-white/40';
  return (
    <div
      className={`bg-white/[0.06] backdrop-blur-xl border border-white/[0.1] rounded-2xl p-5 ${accentCls ? `border-l-4 ${accentCls}` : ''}`}
    >
      <p className="text-xs font-semibold text-white/45 uppercase tracking-wider mb-1">{label}</p>
      <p className="text-2xl font-bold text-white leading-tight amt">{value}</p>
      {sub && <p className={`text-xs mt-1 ${subColor} amt`}>{sub}</p>}
    </div>
  );
}
