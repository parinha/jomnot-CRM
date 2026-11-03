'use client';

import type { ReactNode } from 'react';
import {
  CalendarBlank,
  CaretRight,
  ChartBar,
  Crown,
  FilePlus,
  HourglassMedium,
  Receipt,
  TrendDown,
  TrendUp,
  UserPlus,
  UsersThree,
  Wallet,
  WarningCircle,
  type Icon,
} from '@phosphor-icons/react';
import Link from 'next/link';
import { useInvoices } from '@/src/hooks/useInvoices';
import { useClients } from '@/src/hooks/useClients';
import { useCurrency, useAppPreferences } from '@/src/hooks/useAppPreferences';
import { calcSubtotal, calcEarned, calcBalance, taxConfigFromPrefs } from '@/src/lib/calculations';
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
  paid: '#00b14f',
  sent: '#3b82f6',
  partial: '#f59e0b',
  overdue: '#ef4444',
  draft: '#9aa1ab',
};

// ── Dashboard ─────────────────────────────────────────────────────────────────

export default function DashboardScreen() {
  const { data: invoices } = useInvoices();
  const { data: clients } = useClients();
  const { fmtAmount: fmt, fmtShort } = useCurrency();
  const prefs = useAppPreferences();
  const taxConfig = taxConfigFromPrefs(prefs);

  const thisYM = getYM(0);
  const lastYM = getYM(-1);

  const thisMonthName = ymFullLabel(thisYM);
  const lastMonthName = ymFullLabel(lastYM);

  // ── KPIs ───────────────────────────────────────────────────────────────────
  const thisMonthInvs = invoices.filter((i) => i.date.startsWith(thisYM));
  const thisMonthBilled = thisMonthInvs.reduce((s, i) => s + calcSubtotal(i), 0);
  const thisMonthEarned = thisMonthInvs.reduce((s, i) => s + calcEarned(i, taxConfig), 0);
  const lastMonthBilled = invoices
    .filter((i) => i.date.startsWith(lastYM))
    .reduce((s, i) => s + calcSubtotal(i), 0);

  const outstandingInvs = invoices.filter(
    (i) => i.status === 'sent' || i.status === 'partial' || i.status === 'overdue'
  );
  const outstanding = outstandingInvs.reduce((s, i) => s + calcBalance(i, taxConfig), 0);

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

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const collectedPct =
    thisMonthBilled > 0 ? Math.min(100, Math.round((thisMonthEarned / thisMonthBilled) * 100)) : 0;

  const bothAlerts = overdueInvs.length > 0 && unpaidInvs.length > 0;
  const alertSpan = bothAlerts ? 'md:col-span-6' : 'md:col-span-12';

  // Phones: single column. iPad and up: 12-column grid.
  return (
    <div className="flex flex-col gap-5 md:grid md:grid-cols-12 md:gap-6">
      {/* ── Green hero (continues the green header on phones; a banner on iPad+) ── */}
      <div className="-mx-4 -mt-4 bg-brand px-4 pt-2 pb-20 rounded-b-[28px] md:col-span-12 md:mx-0 md:mt-0 md:rounded-3xl md:px-8 md:pt-7 md:pb-24 relative overflow-hidden">
        <div
          aria-hidden
          className="hidden md:block absolute -right-16 -top-20 w-72 h-72 rounded-full bg-white/10"
        />
        <div
          aria-hidden
          className="hidden md:block absolute right-24 -bottom-24 w-56 h-56 rounded-full bg-white/[0.07]"
        />
        <p className="relative text-on-brand/80 text-sm">
          {new Date().toLocaleDateString('en-US', {
            weekday: 'long',
            month: 'long',
            day: 'numeric',
          })}
        </p>
        <h1 className="relative text-2xl md:text-3xl font-semibold text-on-brand mt-0.5">
          {greeting} 👋
        </h1>
      </div>

      {/* ── Balance card (overlaps the hero) ────────────────────────────── */}
      <div className="relative -mt-20 bg-surface rounded-3xl shadow-float p-5 md:col-span-7 lg:col-span-8 md:p-6 md:ml-4 lg:ml-6">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-medium text-muted flex items-center gap-1.5">
              <Wallet weight="duotone" className="w-4 h-4 text-brand-ink" aria-hidden />
              Outstanding
            </p>
            <p className="text-3xl font-semibold text-ink mt-1 truncate amt">{fmt(outstanding)}</p>
            <p className="text-xs text-muted mt-0.5">
              {outstandingInvs.length} invoice{outstandingInvs.length !== 1 ? 's' : ''} awaiting
              payment
            </p>
          </div>
          <Link
            href="/invoices"
            className="shrink-0 h-9 px-4 rounded-full bg-brand-soft text-brand-ink text-sm font-semibold flex items-center gap-1 hover:bg-brand/15 transition"
          >
            View
            <CaretRight weight="bold" className="w-3.5 h-3.5" aria-hidden />
          </Link>
        </div>

        <div className="mt-4 pt-4 border-t border-line grid grid-cols-2 gap-4">
          <div className="min-w-0">
            <p className="text-[11px] text-muted">Billed in {thisMonthName}</p>
            <p className="text-base font-semibold text-ink truncate amt">{fmt(thisMonthBilled)}</p>
            <p className="text-[11px] text-faint">
              {thisMonthInvs.length} invoice{thisMonthInvs.length !== 1 ? 's' : ''}
            </p>
          </div>
          <div className="min-w-0">
            <p className="text-[11px] text-muted">Collected in {thisMonthName}</p>
            <p className="text-base font-semibold text-brand-ink truncate amt">
              {fmt(thisMonthEarned)}
            </p>
            <div className="mt-1.5 h-1.5 rounded-full bg-subtle overflow-hidden">
              <div
                className="h-full rounded-full bg-brand transition-all"
                style={{ width: `${collectedPct}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* ── Shortcut tiles ──────────────────────────────────────────────── */}
      <div className="relative grid grid-cols-4 gap-2 md:col-span-5 lg:col-span-4 md:-mt-20 md:mr-4 lg:mr-6 md:grid-cols-2 md:content-center md:gap-3 md:bg-surface md:rounded-3xl md:shadow-float md:p-5">
        <ShortcutTile href="/invoices?new=1" label="New Invoice" icon={FilePlus} tone="green" />
        <ShortcutTile href="/clients?new=1" label="New Client" icon={UserPlus} tone="sky" />
        <ShortcutTile href="/invoices" label="Invoices" icon={Receipt} tone="amber" />
        <ShortcutTile href="/clients" label="Clients" icon={UsersThree} tone="violet" />
      </div>

      {/* ── Needs attention ─────────────────────────────────────────────── */}
      {overdueInvs.length > 0 && (
        <InvoiceAlertList
          className={alertSpan}
          title="Overdue"
          accent="red"
          icon={WarningCircle}
          items={overdueInvs}
          clients={clients}
          fmt={fmt}
        />
      )}
      {unpaidInvs.length > 0 && (
        <InvoiceAlertList
          className={alertSpan}
          title="Awaiting payment"
          accent="amber"
          icon={HourglassMedium}
          items={unpaidInvs}
          clients={clients}
          fmt={fmt}
        />
      )}

      {/* ── Revenue ─────────────────────────────────────────────────────── */}
      <RevenueChart
        className={invoices.length > 0 ? 'md:col-span-7 lg:col-span-8' : 'md:col-span-12'}
        data={revenueHistory}
        maxVal={maxRevenue}
        fmtShort={fmtShort}
        lastMonthName={lastMonthName}
        lastMonthBilled={fmt(lastMonthBilled)}
        momPct={momPct}
      />

      {/* ── Invoice status donut ────────────────────────────────────────── */}
      {invoices.length > 0 && (
        <StatusDonut
          className="md:col-span-5 lg:col-span-4"
          data={statusDist}
          total={invoices.length}
          totalValue={invoices.reduce((s, i) => s + calcSubtotal(i), 0)}
          fmt={fmt}
        />
      )}

      {/* ── Top clients ─────────────────────────────────────────────────── */}
      {topClients.length > 0 && (
        <section className="bg-surface rounded-2xl shadow-card p-4 md:p-5 md:col-span-12">
          <SectionTitle title="Top clients" sub="Last 3 months by billed amount" />
          <div className="flex flex-col gap-3.5 mt-3 md:grid md:grid-cols-2 md:gap-x-10 md:gap-y-4">
            {topClients.map(({ client, total, pct }, i) => (
              <div key={client!.id} className="flex items-center gap-3">
                <div className="relative w-10 h-10 rounded-full bg-brand-soft text-brand-ink flex items-center justify-center text-sm font-bold shrink-0">
                  {client!.name.charAt(0).toUpperCase()}
                  {i === 0 && (
                    <Crown
                      weight="duotone"
                      className="absolute -top-1.5 -right-1 w-4 h-4 text-amber-500"
                      aria-hidden
                    />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium text-ink truncate">{client!.name}</span>
                    <span className="text-sm font-semibold text-ink shrink-0 amt">
                      {fmt(total)}
                    </span>
                  </div>
                  <div className="mt-1.5 h-1.5 rounded-full bg-subtle overflow-hidden">
                    <div
                      className="h-full rounded-full bg-brand transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Empty state ─────────────────────────────────────────────────── */}
      {invoices.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 text-center md:col-span-12">
          <div className="w-20 h-20 rounded-full bg-brand-soft flex items-center justify-center mb-4">
            <ChartBar className="w-10 h-10 text-brand-ink" weight="duotone" aria-hidden />
          </div>
          <p className="text-base font-semibold text-ink">No data yet</p>
          <p className="text-sm text-muted mt-1">Create your first invoice to see your numbers.</p>
        </div>
      )}
    </div>
  );
}

// ── Section title ─────────────────────────────────────────────────────────────

function SectionTitle({ title, sub, right }: { title: string; sub?: string; right?: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div>
        <h3 className="text-base font-semibold text-ink">{title}</h3>
        {sub && <p className="text-xs text-muted mt-0.5">{sub}</p>}
      </div>
      {right}
    </div>
  );
}

// ── Shortcut tile (Grab-style service grid) ───────────────────────────────────

const TILE_TONES = {
  green: 'bg-brand-soft text-brand-ink',
  sky: 'bg-sky-50 text-sky-600',
  amber: 'bg-amber-50 text-amber-600',
  violet: 'bg-violet-50 text-violet-600',
} as const;

function ShortcutTile({
  href,
  label,
  icon: TileIcon,
  tone,
}: {
  href: string;
  label: string;
  icon: Icon;
  tone: keyof typeof TILE_TONES;
}) {
  return (
    <Link
      href={href}
      className="flex flex-col items-center gap-2 py-2 rounded-2xl active:scale-95 transition-transform"
    >
      <span
        className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-card ${TILE_TONES[tone]}`}
      >
        <TileIcon weight="duotone" className="w-7 h-7" aria-hidden />
      </span>
      <span className="text-xs font-medium text-ink-2 text-center leading-tight">{label}</span>
    </Link>
  );
}

// ── Revenue Bar Chart ─────────────────────────────────────────────────────────

function RevenueChart({
  className = '',
  data,
  maxVal,
  fmtShort,
  lastMonthName,
  lastMonthBilled,
  momPct,
}: {
  className?: string;
  data: { label: string; billed: number; earned: number }[];
  maxVal: number;
  fmtShort: (n: number) => string;
  lastMonthName: string;
  lastMonthBilled: string;
  momPct: number | null;
}) {
  const BAR_H = 112;
  const up = (momPct ?? 0) >= 0;
  return (
    <section className={`bg-surface rounded-2xl shadow-card p-4 md:p-5 ${className}`}>
      <SectionTitle
        title="Revenue"
        sub="Last 6 months"
        right={
          <div className="flex items-center gap-3 pt-1">
            <span className="flex items-center gap-1.5 text-[11px] text-muted">
              <span className="w-2.5 h-2.5 rounded-full bg-line-strong inline-block" />
              Billed
            </span>
            <span className="flex items-center gap-1.5 text-[11px] text-muted">
              <span className="w-2.5 h-2.5 rounded-full bg-brand inline-block" />
              Collected
            </span>
          </div>
        }
      />

      <div className="mt-3 flex items-center gap-2 rounded-xl bg-subtle px-3 py-2">
        <CalendarBlank weight="duotone" className="w-4 h-4 text-muted shrink-0" aria-hidden />
        <p className="text-xs text-muted flex-1 min-w-0 truncate">
          {lastMonthName}: <span className="font-semibold text-ink amt">{lastMonthBilled}</span>
        </p>
        {momPct !== null && (
          <span
            className={`flex items-center gap-0.5 text-xs font-semibold ${up ? 'text-brand-ink' : 'text-red-600'}`}
          >
            {up ? (
              <TrendUp weight="bold" className="w-3.5 h-3.5" aria-hidden />
            ) : (
              <TrendDown weight="bold" className="w-3.5 h-3.5" aria-hidden />
            )}
            {up ? '+' : ''}
            {momPct}% this month
          </span>
        )}
      </div>

      <div className="flex items-end gap-2 mt-4" style={{ height: BAR_H + 22 }}>
        {data.map((d, i) => {
          const bH = maxVal > 0 ? Math.round((d.billed / maxVal) * BAR_H) : 0;
          const eH = maxVal > 0 ? Math.round((d.earned / maxVal) * BAR_H) : 0;
          const isCurrentMonth = i === data.length - 1;
          return (
            <div key={i} className="flex-1 flex flex-col items-center gap-1.5">
              <div className="w-full flex items-end justify-center gap-1" style={{ height: BAR_H }}>
                <div
                  className={`w-full max-w-3 rounded-full transition-all ${isCurrentMonth ? 'bg-ink-2/30' : 'bg-line'}`}
                  style={{ height: bH }}
                />
                <div
                  className={`w-full max-w-3 rounded-full transition-all ${isCurrentMonth ? 'bg-brand' : 'bg-brand/45'}`}
                  style={{ height: eH }}
                />
              </div>
              <span
                className={`text-[11px] ${isCurrentMonth ? 'text-brand-ink font-semibold' : 'text-faint'}`}
              >
                {d.label}
              </span>
            </div>
          );
        })}
      </div>
      <p className="text-[11px] text-faint text-right mt-1">Peak {fmtShort(maxVal)}</p>
    </section>
  );
}

// ── Invoice Status Donut ──────────────────────────────────────────────────────

function StatusDonut({
  className = '',
  data,
  total,
  totalValue,
  fmt,
}: {
  className?: string;
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
    <section className={`bg-surface rounded-2xl shadow-card p-4 md:p-5 ${className}`}>
      <SectionTitle title="Invoice breakdown" sub="All invoices by status" />
      <div className="flex items-center gap-5 mt-3">
        {/* Donut */}
        <div className="shrink-0">
          <svg
            viewBox="0 0 100 100"
            className="w-32 h-32"
            role="img"
            aria-label="Invoices by status"
          >
            <circle cx={cx} cy={cy} r={r} fill="none" stroke="#f1f3f5" strokeWidth={13} />
            <g transform={`rotate(-90 ${cx} ${cy})`}>
              {segs.map((seg, i) => (
                <circle
                  key={i}
                  cx={cx}
                  cy={cy}
                  r={r}
                  fill="none"
                  stroke={STATUS_COLORS[seg.status as InvoiceStatus] ?? '#9aa1ab'}
                  strokeWidth={13}
                  strokeDasharray={`${seg.len} ${circ - seg.len}`}
                  strokeDashoffset={-seg.acc}
                  strokeLinecap="butt"
                />
              ))}
            </g>
            <text
              x={cx}
              y={cy - 2}
              textAnchor="middle"
              fill="#1a1d21"
              fontSize="18"
              fontWeight="600"
            >
              {total}
            </text>
            <text x={cx} y={cy + 11} textAnchor="middle" fill="#6b7280" fontSize="8">
              invoices
            </text>
          </svg>
        </div>

        {/* Legend */}
        <div className="flex-1 flex flex-col gap-2 min-w-0">
          {segs.map((seg) => (
            <div key={seg.status} className="flex items-center gap-2">
              <div
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{ backgroundColor: STATUS_COLORS[seg.status as InvoiceStatus] ?? '#9aa1ab' }}
              />
              <span className="text-sm text-ink-2 flex-1 truncate">{seg.label}</span>
              <span className="text-sm font-semibold text-ink shrink-0">{seg.count}</span>
            </div>
          ))}
          <div className="mt-1 pt-2 border-t border-line">
            <p className="text-[11px] text-muted mb-0.5">Total value</p>
            <p className="text-base font-semibold text-ink amt">{fmt(totalValue)}</p>
          </div>
        </div>
      </div>
    </section>
  );
}

// ── Invoice Alert List ────────────────────────────────────────────────────────

function InvoiceAlertList({
  className = '',
  title,
  accent,
  icon: AlertIcon,
  items,
  clients,
  fmt,
}: {
  className?: string;
  title: string;
  accent: 'red' | 'amber';
  icon: Icon;
  items: Invoice[];
  clients: ReturnType<typeof useClients>['data'];
  fmt: (n: number) => string;
}) {
  const A = {
    red: { chip: 'bg-red-50 text-red-600', count: 'bg-red-50 text-red-600' },
    amber: { chip: 'bg-amber-50 text-amber-600', count: 'bg-amber-50 text-amber-700' },
  }[accent];

  return (
    <section className={`bg-surface rounded-2xl shadow-card p-4 md:p-5 ${className}`}>
      <div className="flex items-center gap-2.5">
        <span className={`w-9 h-9 rounded-full flex items-center justify-center ${A.chip}`}>
          <AlertIcon weight="duotone" className="w-5 h-5" aria-hidden />
        </span>
        <h3 className="text-base font-semibold text-ink">{title}</h3>
        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${A.count}`}>
          {items.length}
        </span>
        <Link
          href="/invoices"
          className="ml-auto text-sm font-semibold text-brand-ink flex items-center gap-0.5"
        >
          See all
          <CaretRight weight="bold" className="w-3.5 h-3.5" aria-hidden />
        </Link>
      </div>
      <div className="flex flex-col divide-y divide-line mt-2">
        {items.map((inv) => {
          const client = clients.find((c) => c.id === inv.clientId);
          return (
            <Link
              href="/invoices"
              key={inv.id}
              className="flex items-center gap-3 py-3 last:pb-0 active:opacity-70 transition-opacity"
            >
              <div className="w-10 h-10 rounded-full bg-subtle flex items-center justify-center shrink-0">
                <Receipt weight="duotone" className="w-5 h-5 text-muted" aria-hidden />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-ink">{inv.number}</p>
                <p className="text-xs text-muted truncate">
                  {client?.name ?? '—'} · {inv.date}
                </p>
              </div>
              <span className="text-sm font-semibold text-ink shrink-0 amt">
                {fmt(calcSubtotal(inv))}
              </span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
