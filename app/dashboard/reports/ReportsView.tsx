'use client';

import { useState, useMemo } from 'react';
import { useStore, type Invoice, type InvoiceStatus } from '../AppStore';
import { STATUS_CONFIG, PROJECT_STATUS_CONFIG } from '@/app/_config/statusConfig';
import { fmtUSD as fmt, fmtShort } from '@/app/_lib/formatters';
import {
  calcEarned,
  calcBalance,
  calcInvoiceTotal,
  calcSubtotal,
} from '@/app/_services/invoiceService';

// ── Date helpers ───────────────────────────────────────────────────────────────

function toDateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
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
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return [toDateStr(start), toDateStr(end)];
}

function thisYearRange(): [string, string] {
  const y = new Date().getFullYear();
  return [`${y}-01-01`, `${y}-12-31`];
}

// ── Bucketing ─────────────────────────────────────────────────────────────────

type BucketMode = 'day' | 'week' | 'month';

function getBucketMode(start: string, end: string): BucketMode {
  const days = (new Date(end).getTime() - new Date(start).getTime()) / (1000 * 60 * 60 * 24);
  if (days <= 14) return 'day';
  if (days <= 90) return 'week';
  return 'month';
}

function invBucketKey(inv: Invoice, mode: BucketMode): string {
  const d = new Date(inv.date);
  if (mode === 'month') return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  if (mode === 'week') {
    const day = d.getDay();
    const monday = new Date(d);
    monday.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
    return monday.toISOString().slice(0, 10);
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
      const key = `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}`;
      const label = cur.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
      buckets.push({ key, label });
      cur.setMonth(cur.getMonth() + 1);
    }
  } else if (mode === 'week') {
    const day = s.getDay();
    const cur = new Date(s);
    cur.setDate(s.getDate() - (day === 0 ? 6 : day - 1));
    cur.setHours(0, 0, 0, 0);
    while (cur <= e) {
      const key = cur.toISOString().slice(0, 10);
      const label = cur.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      buckets.push({ key, label });
      cur.setDate(cur.getDate() + 7);
    }
  } else {
    const cur = new Date(s);
    while (cur <= e) {
      const key = cur.toISOString().slice(0, 10);
      const label = cur.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      buckets.push({ key, label });
      cur.setDate(cur.getDate() + 1);
    }
  }
  return buckets;
}

const BAR_COLORS = ['#FFC206', '#E5AE00', '#71717a', '#a1a1aa', '#d4d4d8'];

const QUICK_RANGES: { label: string; fn: () => [string, string] }[] = [
  { label: 'This Week', fn: thisWeekRange },
  { label: 'This Month', fn: thisMonthRange },
  { label: 'This Year', fn: thisYearRange },
];

// ── Component ─────────────────────────────────────────────────────────────────

export default function ReportsView() {
  const { clients, invoices, projects } = useStore();

  const [[startDate, endDate], setRange] = useState<[string, string]>(() => thisMonthRange());
  const [clientFilter, setClientFilter] = useState('all');

  const base = useMemo(() => {
    const byClient =
      clientFilter === 'all' ? invoices : invoices.filter((inv) => inv.clientId === clientFilter);
    return byClient.filter((inv) => inv.date >= startDate && inv.date <= endDate);
  }, [invoices, clientFilter, startDate, endDate]);

  // Summary
  const totalReceived = base.reduce((s, inv) => s + calcEarned(inv), 0);
  const totalInvoiced = base.reduce((s, inv) => s + calcInvoiceTotal(inv), 0);
  const outstanding = base
    .filter((inv) => ['sent', 'overdue', 'partial'].includes(inv.status ?? 'draft'))
    .reduce((s, inv) => s + calcBalance(inv), 0);
  const overdueCount = base.filter((inv) => (inv.status ?? 'draft') === 'overdue').length;

  // Bar chart
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

  // Client breakdown
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

  // Status breakdown
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

  // Top scopes of work
  const scopeMap = new Map<string, { revenue: number; count: number }>();
  base.forEach((inv) => {
    inv.items.forEach((it) => {
      const key = it.description.trim();
      if (!key) return;
      const prev = scopeMap.get(key) ?? { revenue: 0, count: 0 };
      scopeMap.set(key, { revenue: prev.revenue + it.qty * it.unitPrice, count: prev.count + 1 });
    });
  });
  const topScopes = Array.from(scopeMap.entries())
    .map(([desc, v]) => ({ desc, ...v }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 8);
  const maxScopeRevenue = Math.max(...topScopes.map((s) => s.revenue), 1);

  // Project report
  const filteredProjects = useMemo(() => {
    return clientFilter === 'all' ? projects : projects.filter((p) => p.clientId === clientFilter);
  }, [projects, clientFilter]);

  const projectRows = useMemo(() => {
    return filteredProjects
      .map((p) => {
        const client = clients.find((c) => c.id === p.clientId);
        const linkedInvs = p.invoiceIds
          .map((id) => invoices.find((i) => i.id === id))
          .filter(Boolean) as typeof invoices;
        const revenue = linkedInvs.reduce((s, inv) => s + calcSubtotal(inv), 0);
        const doneCount = p.items.filter((it) => it.status === 'done').length;
        const totalItems = p.items.length;
        const pct = totalItems > 0 ? Math.round((doneCount / totalItems) * 100) : 0;
        return { project: p, client, linkedInvs, revenue, doneCount, totalItems, pct };
      })
      .sort((a, b) => {
        // active first, then completed, then on-hold; within group sort by revenue desc
        const order = { active: 0, completed: 1, 'on-hold': 2 };
        const diff = order[a.project.status] - order[b.project.status];
        return diff !== 0 ? diff : b.revenue - a.revenue;
      });
  }, [filteredProjects, clients, invoices]);

  const projectStatuses = ['active', 'completed', 'on-hold'] as const;
  const projectStatusCounts = projectStatuses.map((s) => ({
    status: s,
    count: filteredProjects.filter((p) => p.status === s).length,
  }));

  return (
    <div className="flex flex-col gap-6 pb-4">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900">Reports</h1>
          <p className="text-sm text-zinc-500 mt-0.5">Revenue and invoice analytics</p>
        </div>
        <select
          value={clientFilter}
          onChange={(e) => setClientFilter(e.target.value)}
          className="h-9 rounded-lg border border-zinc-200 px-3 text-sm text-zinc-700 bg-white focus:outline-none focus:ring-2 focus:ring-brand transition"
        >
          <option value="all">All clients</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      {/* Date range controls */}
      <div className="bg-white rounded-xl border border-zinc-200 p-4 flex flex-wrap items-center gap-3">
        <div className="flex gap-1.5 flex-wrap">
          {QUICK_RANGES.map(({ label, fn }) => {
            const [s, e] = fn();
            const active = s === startDate && e === endDate;
            return (
              <button
                key={label}
                onClick={() => setRange([s, e])}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${active ? 'bg-brand text-zinc-900' : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'}`}
              >
                {label}
              </button>
            );
          })}
        </div>
        <div className="hidden sm:block h-5 w-px bg-zinc-200" />
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-medium text-zinc-500">From</span>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setRange([e.target.value, endDate])}
            className="h-9 rounded-lg border border-zinc-200 px-3 text-sm text-zinc-700 bg-white focus:outline-none focus:ring-2 focus:ring-brand transition"
          />
          <span className="text-xs font-medium text-zinc-500">To</span>
          <input
            type="date"
            value={endDate}
            min={startDate}
            onChange={(e) => setRange([startDate, e.target.value])}
            className="h-9 rounded-lg border border-zinc-200 px-3 text-sm text-zinc-700 bg-white focus:outline-none focus:ring-2 focus:ring-brand transition"
          />
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard
          label="Received"
          value={fmt(totalReceived)}
          sub={`of ${fmt(totalInvoiced)} invoiced`}
          accent="green"
        />
        <StatCard
          label="Outstanding"
          value={fmt(outstanding)}
          sub={`${overdueCount} overdue · incl. partial balance`}
          accent={overdueCount > 0 ? 'red' : undefined}
        />
        <StatCard
          label="Total invoiced"
          value={fmt(totalInvoiced)}
          sub={`${base.length} invoice${base.length !== 1 ? 's' : ''}`}
        />
      </div>

      {/* Revenue over time */}
      <div className="bg-white rounded-xl border border-zinc-200 p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-zinc-900">Revenue over time</h2>
          <span className="text-xs text-zinc-400">
            {bucketMode === 'day' ? 'Daily' : bucketMode === 'week' ? 'Weekly' : 'Monthly'}
          </span>
        </div>
        {base.length === 0 ? (
          <div className="h-48 flex items-center justify-center text-zinc-400 text-sm">
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
                          <span className="text-xs text-zinc-500 mb-1 opacity-0 group-hover:opacity-100 transition whitespace-nowrap">
                            {fmtShort(b.revenue)}
                          </span>
                          <div
                            className="w-full bg-brand rounded-t-md group-hover:bg-brand-hover transition-colors"
                            style={{ height: `${Math.max(pct, 2)}%`, maxHeight: '140px' }}
                          />
                        </div>
                      ) : (
                        <div className="w-full h-0.5 bg-zinc-100 rounded self-end" />
                      )}
                    </div>
                    <span className="text-xs text-zinc-400 truncate w-full text-center">
                      {b.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Client + Status */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-zinc-200 p-5">
          <h2 className="text-sm font-semibold text-zinc-900 mb-4">Revenue by client</h2>
          {clientData.length === 0 ? (
            <p className="text-sm text-zinc-400 py-6 text-center">No data</p>
          ) : (
            <div className="flex flex-col gap-3">
              {clientData.map((c, i) => (
                <div key={c.id}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-zinc-700 truncate max-w-[60%]">{c.name}</span>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs text-zinc-400">{c.count} inv</span>
                      <span className="text-sm font-medium text-zinc-900">{fmt(c.revenue)}</span>
                    </div>
                  </div>
                  <div className="h-2 bg-zinc-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full"
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

        <div className="bg-white rounded-xl border border-zinc-200 p-5">
          <h2 className="text-sm font-semibold text-zinc-900 mb-4">Invoice status</h2>
          <div className="flex flex-col gap-3">
            {statusData.map(({ status, count, revenue }) => {
              const meta = STATUS_CONFIG[status];
              const pct = base.length > 0 ? (count / base.length) * 100 : 0;
              return (
                <div key={status}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-xs font-medium px-2 py-0.5 rounded-full border ${meta.bg} ${meta.color}`}
                      >
                        {meta.label}
                      </span>
                      <span className="text-xs text-zinc-400">
                        {count} invoice{count !== 1 ? 's' : ''}
                      </span>
                    </div>
                    <span className="text-sm font-medium text-zinc-900">{fmt(revenue)}</span>
                  </div>
                  <div className="h-2 bg-zinc-100 rounded-full overflow-hidden">
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

      {/* Top scopes of work */}
      {topScopes.length > 0 && (
        <div className="bg-white rounded-xl border border-zinc-200 p-5">
          <h2 className="text-sm font-semibold text-zinc-900 mb-4">Top scopes of work</h2>
          <div className="flex flex-col gap-2.5">
            {topScopes.map((s, i) => (
              <div key={i} className="flex items-center gap-3">
                <span className="text-xs text-zinc-400 w-5 text-right shrink-0">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-zinc-700 truncate">{s.desc}</span>
                    <span className="text-sm font-medium text-zinc-900 shrink-0 ml-3">
                      {fmt(s.revenue)}
                    </span>
                  </div>
                  <div className="h-1.5 bg-zinc-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-zinc-400 rounded-full"
                      style={{ width: `${(s.revenue / maxScopeRevenue) * 100}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Project Report ──────────────────────────────────────────────────────── */}
      {filteredProjects.length > 0 && (
        <>
          {/* Section header */}
          <div className="flex items-center gap-3 mt-2">
            <h2 className="text-base font-semibold text-zinc-900">Projects</h2>
            <div className="flex-1 h-px bg-zinc-200" />
          </div>

          {/* Project status summary cards */}
          <div className="grid grid-cols-3 gap-4">
            {projectStatusCounts.map(({ status, count }) => {
              const cfg = PROJECT_STATUS_CONFIG[status];
              return (
                <div key={status} className="bg-white rounded-xl border border-zinc-200 p-4">
                  <div
                    className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium mb-2 ${cfg.cls}`}
                  >
                    {cfg.label}
                  </div>
                  <p className="text-2xl font-bold text-zinc-900">{count}</p>
                  <p className="text-xs text-zinc-400 mt-0.5">project{count !== 1 ? 's' : ''}</p>
                </div>
              );
            })}
          </div>

          {/* Projects table */}
          <div className="bg-white rounded-xl border border-zinc-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-zinc-100">
              <h3 className="text-sm font-semibold text-zinc-900">Project overview</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-100 bg-zinc-50">
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-zinc-500">
                      Project
                    </th>
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-zinc-500 hidden sm:table-cell">
                      Client
                    </th>
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-zinc-500">
                      Status
                    </th>
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-zinc-500 w-40">
                      Progress
                    </th>
                    <th className="text-right px-4 py-2.5 text-xs font-medium text-zinc-500">
                      Invoiced
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {projectRows.map(
                    ({ project, client, linkedInvs, revenue, doneCount, totalItems, pct }) => {
                      const cfg = PROJECT_STATUS_CONFIG[project.status];
                      return (
                        <tr
                          key={project.id}
                          className="border-b border-zinc-100 last:border-0 hover:bg-zinc-50/60 transition"
                        >
                          <td className="px-4 py-3 font-medium text-zinc-900 max-w-[160px] truncate">
                            {project.name}
                          </td>
                          <td className="px-4 py-3 text-zinc-500 hidden sm:table-cell max-w-[120px] truncate">
                            {client?.name ?? '—'}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`px-2 py-0.5 rounded-full text-xs font-medium ${cfg.cls}`}
                            >
                              {cfg.label}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            {totalItems > 0 ? (
                              <div className="flex items-center gap-2">
                                <div className="flex-1 h-1.5 bg-zinc-100 rounded-full overflow-hidden">
                                  <div
                                    className={`h-full rounded-full ${pct === 100 ? 'bg-green-500' : 'bg-brand'}`}
                                    style={{ width: `${pct}%` }}
                                  />
                                </div>
                                <span className="text-xs text-zinc-500 shrink-0 w-12 text-right">
                                  {doneCount}/{totalItems} · {pct}%
                                </span>
                              </div>
                            ) : (
                              <span className="text-xs text-zinc-400">No items</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <span className="font-medium text-zinc-900">{fmt(revenue)}</span>
                            {linkedInvs.length > 0 && (
                              <span className="text-xs text-zinc-400 ml-1.5">
                                {linkedInvs.length} inv
                              </span>
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
  accent?: 'green' | 'red';
}) {
  const subColor =
    accent === 'green' ? 'text-green-600' : accent === 'red' ? 'text-red-500' : 'text-zinc-400';
  return (
    <div className="bg-white rounded-xl border border-zinc-200 p-4">
      <p className="text-xs font-medium text-zinc-500 mb-1">{label}</p>
      <p className="text-xl font-bold text-zinc-900 leading-tight">{value}</p>
      {sub && <p className={`text-xs mt-1 ${subColor}`}>{sub}</p>}
    </div>
  );
}
