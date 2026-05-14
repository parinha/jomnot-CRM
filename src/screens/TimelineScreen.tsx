'use client';

import { useState, useMemo, useRef, useEffect, useCallback, useTransition } from 'react';
import Link from 'next/link';
import type { Project, ProjectStatus } from '@/src/types';
import { PROJECT_STATUS_CONFIG } from '@/src/config/statusConfig';
import { useProjects, useProjectMutations } from '@/src/hooks/useProjects';
import { TablePageSkeleton } from '@/src/components/PageSkeleton';
import ProgressPopover from '@/src/features/projects/components/ProgressPopover';
import { useAppPreferences } from '@/src/hooks/useAppPreferences';

// ── Layout constants ───────────────────────────────────────────────────────────
const DAY_W_MAP = { day: 48, week: 18, month: 7 } as const;
type ViewMode = keyof typeof DAY_W_MAP;

const LEFT_W = 224;
const LEFT_W_MOBILE = 110;
const ROW_H = 52;
const HDR1_H = 28;
const HDR2_H = 28;
const HDR_H = HDR1_H + HDR2_H;
const BAR_H = 26;
const MS_SIZE = 14;

// ── Status colors ──────────────────────────────────────────────────────────────
const STATUS_BAR: Record<ProjectStatus, { bg: string; text: string }> = {
  unconfirmed: { bg: 'bg-violet-600', text: 'text-violet-100' },
  confirmed: { bg: 'bg-sky-500', text: 'text-sky-950' },
  'on-hold': { bg: 'bg-zinc-600', text: 'text-zinc-200' },
  completed: { bg: 'bg-emerald-600', text: 'text-emerald-50' },
};
const LATE_BAR = { bg: 'bg-red-600', text: 'text-red-50' };

const STATUS_DOT: Record<ProjectStatus, string> = {
  unconfirmed: 'bg-violet-400',
  confirmed: 'bg-sky-400',
  'on-hold': 'bg-zinc-500',
  completed: 'bg-emerald-400',
};
const LATE_DOT = 'bg-red-500';

function getBarCfg(event: GanttEvent, today: Date): { bg: string; text: string } {
  if (event.status === 'completed') return STATUS_BAR.completed;
  if (event.end < today) return LATE_BAR;
  return STATUS_BAR[event.status] ?? STATUS_BAR.unconfirmed;
}
function getDotCls(event: GanttEvent, today: Date): string {
  if (event.status === 'completed') return STATUS_DOT.completed;
  if (event.end < today) return LATE_DOT;
  return STATUS_DOT[event.status] ?? STATUS_DOT.unconfirmed;
}

// ── Cambodian public holidays ──────────────────────────────────────────────────
const FIXED_HOLIDAYS: { month: number; day: number; name: string }[] = [
  { month: 1, day: 1, name: "New Year's Day" },
  { month: 1, day: 7, name: 'Victory Day' },
  { month: 3, day: 8, name: "Women's Day" },
  { month: 5, day: 1, name: 'Labour Day' },
  { month: 5, day: 14, name: "King's Birthday" },
  { month: 6, day: 1, name: "Children's Day" },
  { month: 6, day: 18, name: "Queen Mother's Birthday" },
  { month: 9, day: 24, name: 'Constitution Day' },
  { month: 10, day: 15, name: 'Commemoration Day' },
  { month: 10, day: 23, name: 'Paris Peace Day' },
  { month: 10, day: 29, name: 'Coronation Day' },
  { month: 11, day: 9, name: 'Independence Day' },
  { month: 11, day: 12, name: "King Father's Birthday" },
];

const LUNAR_HOLIDAYS: Record<string, string> = {
  '2024-04-13': 'Khmer New Year',
  '2024-04-14': 'Khmer New Year',
  '2024-04-15': 'Khmer New Year',
  '2025-04-14': 'Khmer New Year',
  '2025-04-15': 'Khmer New Year',
  '2025-04-16': 'Khmer New Year',
  '2026-04-14': 'Khmer New Year',
  '2026-04-15': 'Khmer New Year',
  '2026-04-16': 'Khmer New Year',
  '2027-04-14': 'Khmer New Year',
  '2027-04-15': 'Khmer New Year',
  '2027-04-16': 'Khmer New Year',
  '2024-05-07': 'Royal Ploughing',
  '2025-05-07': 'Royal Ploughing',
  '2026-05-06': 'Royal Ploughing',
  '2027-05-05': 'Royal Ploughing',
  '2024-10-01': 'Pchum Ben',
  '2024-10-02': 'Pchum Ben',
  '2024-10-03': 'Pchum Ben',
  '2025-09-22': 'Pchum Ben',
  '2025-09-23': 'Pchum Ben',
  '2025-09-24': 'Pchum Ben',
  '2026-10-11': 'Pchum Ben',
  '2026-10-12': 'Pchum Ben',
  '2026-10-13': 'Pchum Ben',
  '2027-09-30': 'Pchum Ben',
  '2027-10-01': 'Pchum Ben',
  '2027-10-02': 'Pchum Ben',
  '2024-11-15': 'Water Festival',
  '2024-11-16': 'Water Festival',
  '2024-11-17': 'Water Festival',
  '2025-11-04': 'Water Festival',
  '2025-11-05': 'Water Festival',
  '2025-11-06': 'Water Festival',
  '2026-11-23': 'Water Festival',
  '2026-11-24': 'Water Festival',
  '2026-11-25': 'Water Festival',
  '2027-11-12': 'Water Festival',
  '2027-11-13': 'Water Festival',
  '2027-11-14': 'Water Festival',
};

function getHoliday(date: Date): string | null {
  const fixed = FIXED_HOLIDAYS.find(
    (h) => h.month === date.getMonth() + 1 && h.day === date.getDate()
  );
  if (fixed) return fixed.name;
  return LUNAR_HOLIDAYS[toInputDate(date)] ?? null;
}

// ── Date helpers ───────────────────────────────────────────────────────────────
const MONTHS_SHORT = [
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
const MONTHS_FULL = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

function midnight(d: Date): Date {
  const r = new Date(d);
  r.setHours(0, 0, 0, 0);
  return r;
}
function parseDate(s: string): Date {
  return midnight(new Date(s));
}
function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}
function diffDays(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}
function toInputDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

type GanttEvent = {
  id: string;
  name: string;
  status: ProjectStatus;
  start: Date;
  end: Date;
  isRange: boolean;
};

// ── Time axis header ───────────────────────────────────────────────────────────
function TimeAxis({
  renderStart,
  totalDays,
  dayW,
  today,
  mode,
  showHolidays,
  getHolidayFn,
}: {
  renderStart: Date;
  totalDays: number;
  dayW: number;
  today: Date;
  mode: ViewMode;
  showHolidays: boolean;
  getHolidayFn: (date: Date) => string | null;
}) {
  const [tooltip, setTooltip] = useState<{ name: string; x: number; day: number } | null>(null);

  const monthGroups: { label: string; startDay: number; spanDays: number }[] = [];
  let cur = new Date(renderStart);
  let idx = 0;
  while (idx < totalDays) {
    const groupStart = idx;
    const m = cur.getMonth();
    const y = cur.getFullYear();
    while (idx < totalDays && cur.getMonth() === m) {
      cur = addDays(cur, 1);
      idx++;
    }
    monthGroups.push({
      label: `${MONTHS_FULL[m]} ${y}`,
      startDay: groupStart,
      spanDays: idx - groupStart,
    });
  }

  const subMarkers: { label: string; day: number; isHoliday: boolean; holidayName: string }[] = [];
  if (mode === 'day') {
    for (let i = 0; i < totalDays; i++) {
      const dt = addDays(renderStart, i);
      const hol = showHolidays ? getHolidayFn(dt) : null;
      subMarkers.push({
        label: String(dt.getDate()),
        day: i,
        isHoliday: !!hol,
        holidayName: hol ?? '',
      });
    }
  } else if (mode === 'week') {
    for (let i = 0; i < totalDays; i++) {
      const dt = addDays(renderStart, i);
      if (dt.getDay() === 1 || i === 0) {
        const hol = showHolidays ? getHolidayFn(dt) : null;
        subMarkers.push({
          label: `${dt.getDate()} ${MONTHS_SHORT[dt.getMonth()]}`,
          day: i,
          isHoliday: !!hol,
          holidayName: hol ?? '',
        });
      }
    }
  }

  const todayIdx = diffDays(renderStart, today);

  return (
    <>
      {/* Row 1 — months */}
      <div className="absolute inset-x-0 top-0 flex" style={{ height: HDR1_H }}>
        {monthGroups.map((g, i) => (
          <div
            key={i}
            style={{ width: g.spanDays * dayW, minWidth: 0 }}
            className="shrink-0 flex items-center border-r border-white/[0.08] px-2 overflow-hidden"
          >
            <span className="text-xs font-semibold text-white/55 truncate">{g.label}</span>
          </div>
        ))}
      </div>

      {/* Row 2 — day / week / month markers */}
      <div
        className="absolute inset-x-0 border-t border-white/[0.06]"
        style={{ top: HDR1_H, height: HDR2_H }}
      >
        {mode === 'month'
          ? monthGroups.map((g, i) => {
              const hasHoliday =
                showHolidays &&
                (() => {
                  for (let d = 0; d < g.spanDays; d++) {
                    if (getHolidayFn(addDays(renderStart, g.startDay + d))) return true;
                  }
                  return false;
                })();
              return (
                <div
                  key={i}
                  style={{
                    position: 'absolute',
                    left: g.startDay * dayW,
                    width: g.spanDays * dayW,
                    height: HDR2_H,
                  }}
                  className="flex items-center justify-center border-r border-white/[0.06]"
                >
                  <span
                    className={`text-[10px] font-medium ${hasHoliday ? 'text-red-400' : 'text-white/35'}`}
                  >
                    {MONTHS_SHORT[new Date(addDays(renderStart, g.startDay)).getMonth()]}
                  </span>
                </div>
              );
            })
          : subMarkers.map((m, i) => (
              <div
                key={i}
                style={{
                  position: 'absolute',
                  left: m.day * dayW,
                  width: mode === 'day' ? dayW : 7 * dayW,
                  height: HDR2_H,
                }}
                className="flex flex-col items-start justify-center px-1"
              >
                <span
                  className={`text-[10px] whitespace-nowrap font-medium leading-tight ${m.isHoliday ? 'text-red-400' : 'text-white/35'}`}
                >
                  {m.label}
                </span>
                {m.isHoliday && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setTooltip(
                        tooltip?.day === m.day
                          ? null
                          : { name: m.holidayName, x: m.day * dayW, day: m.day }
                      );
                    }}
                    className="block w-1.5 h-1.5 rounded-full bg-red-500 mt-0.5 hover:bg-red-400 transition"
                  />
                )}
              </div>
            ))}

        {/* Holiday tooltip */}
        {tooltip && (
          <div
            style={{
              position: 'absolute',
              left: tooltip.x + dayW / 2,
              top: HDR2_H + 4,
              transform: 'translateX(-50%)',
              zIndex: 50,
            }}
            className="bg-zinc-900 border border-red-500/40 text-red-300 text-[11px] font-medium px-2.5 py-1.5 rounded-lg shadow-xl whitespace-nowrap pointer-events-none"
          >
            🎉 {tooltip.name}
          </div>
        )}

        {/* Today marker in header */}
        {todayIdx >= 0 && todayIdx < totalDays && (
          <div
            style={{
              position: 'absolute',
              left: todayIdx * dayW + dayW / 2 - 1,
              top: 2,
              bottom: 2,
              width: 2,
            }}
            className="bg-[#FFC206]/70 rounded-full"
          />
        )}
      </div>
    </>
  );
}

// ── Column grid + holiday tints ────────────────────────────────────────────────
function GridLines({
  renderStart,
  totalDays,
  dayW,
  today,
  mode,
  showHolidays,
  getHolidayFn,
}: {
  renderStart: Date;
  totalDays: number;
  dayW: number;
  today: Date;
  mode: ViewMode;
  showHolidays: boolean;
  getHolidayFn: (date: Date) => string | null;
}) {
  const todayIdx = diffDays(renderStart, today);

  return (
    <>
      {Array.from({ length: totalDays }).map((_, i) => {
        const dt = addDays(renderStart, i);
        const dow = dt.getDay();
        const hol = showHolidays ? getHolidayFn(dt) : null;
        const isWE = mode === 'day' && (dow === 0 || dow === 6);

        if (!isWE && !hol) return null;
        return (
          <div
            key={i}
            style={{ position: 'absolute', left: i * dayW, top: 0, bottom: 0, width: dayW }}
            className={hol ? 'bg-red-500/[0.07]' : 'bg-white/[0.02]'}
          />
        );
      })}

      {todayIdx >= 0 && todayIdx < totalDays && (
        <div
          style={{ position: 'absolute', left: todayIdx * dayW, top: 0, bottom: 0, width: dayW }}
          className="bg-[#FFC206]/[0.05]"
        />
      )}

      {Array.from({ length: totalDays }).map((_, i) => {
        const dt = addDays(renderStart, i);
        const isStrong =
          mode === 'day'
            ? dt.getDay() === 1
            : mode === 'week'
              ? dt.getDay() === 1
              : dt.getDate() === 1;
        if (!isStrong && mode !== 'day') return null;
        if (mode === 'day' && i % 1 !== 0) return null;
        return (
          <div
            key={i}
            style={{ position: 'absolute', left: i * dayW, top: 0, bottom: 0, width: 1 }}
            className={isStrong ? 'bg-white/[0.07]' : 'bg-white/[0.02]'}
          />
        );
      })}

      {todayIdx >= 0 && todayIdx < totalDays && (
        <div
          style={{
            position: 'absolute',
            left: todayIdx * dayW + dayW / 2 - 1,
            top: 0,
            bottom: 0,
            width: 2,
          }}
          className="bg-[#FFC206]/50"
        />
      )}
    </>
  );
}

// ── Project bar / milestone ────────────────────────────────────────────────────
function ProjectBar({
  event,
  renderStart,
  dayW,
  today,
  onSelect,
}: {
  event: GanttEvent;
  renderStart: Date;
  dayW: number;
  today: Date;
  onSelect: (e: React.MouseEvent, event: GanttEvent) => void;
}) {
  const cfg = getBarCfg(event, today);

  if (!event.isRange) {
    const x = diffDays(renderStart, event.start) * dayW + dayW / 2;
    return (
      <button
        title={event.name}
        data-progress-trigger
        onClick={(e) => onSelect(e, event)}
        style={{
          position: 'absolute',
          left: x - MS_SIZE / 2,
          top: (ROW_H - MS_SIZE) / 2,
          width: MS_SIZE,
          height: MS_SIZE,
          transform: 'rotate(45deg)',
        }}
        className={`${cfg.bg} hover:opacity-80 transition cursor-pointer rounded-sm shadow-md`}
      />
    );
  }

  const startIdx = diffDays(renderStart, event.start);
  const endIdx = diffDays(renderStart, event.end);
  const left = startIdx * dayW + 2;
  const width = Math.max((endIdx - startIdx + 1) * dayW - 4, dayW - 4);

  return (
    <button
      title={event.name}
      data-progress-trigger
      onClick={(e) => onSelect(e, event)}
      style={{ position: 'absolute', left, top: (ROW_H - BAR_H) / 2, width, height: BAR_H }}
      className={`${cfg.bg} ${cfg.text} rounded-full flex items-center px-3 overflow-hidden hover:opacity-80 transition cursor-pointer shadow-md`}
    >
      <span className="text-[11px] font-semibold truncate leading-none">{event.name}</span>
    </button>
  );
}

// ── Detail sheet ───────────────────────────────────────────────────────────────
function DetailSheet({ event, onClose }: { event: GanttEvent; onClose: () => void }) {
  const fmt = (d: Date) =>
    d.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm bg-[#111] border border-white/15 rounded-2xl p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex flex-col gap-2">
            <p className="text-white font-semibold text-base">{event.name}</p>
            <span
              className={`self-start text-xs px-2.5 py-0.5 rounded-full font-medium ${PROJECT_STATUS_CONFIG[event.status]?.cls ?? ''}`}
            >
              {PROJECT_STATUS_CONFIG[event.status]?.label ?? event.status}
            </span>
          </div>
          <button
            onClick={onClose}
            className="text-white/40 hover:text-white transition shrink-0 mt-0.5"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="space-y-3">
          {event.isRange ? (
            <>
              <InfoRow label="Film date" value={fmt(event.start)} />
              <InfoRow label="Deliver date" value={fmt(event.end)} />
              <div className="pt-2 border-t border-white/[0.08]">
                <InfoRow label="Duration" value={`${diffDays(event.start, event.end) + 1} days`} />
              </div>
            </>
          ) : (
            <InfoRow label="Date" value={fmt(event.start)} />
          )}
        </div>

        <Link
          href="/dashboard/projects"
          className="mt-5 flex items-center justify-center gap-1.5 w-full h-9 rounded-xl bg-white/[0.06] border border-white/10 text-xs font-medium text-white/55 hover:text-white hover:bg-white/10 transition"
        >
          Open in Projects
          <svg
            className="w-3.5 h-3.5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </Link>
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-sm text-white/40">{label}</span>
      <span className="text-sm text-white/80 text-right">{value}</span>
    </div>
  );
}

// ── Toggle button ──────────────────────────────────────────────────────────────
function Toggle({
  checked,
  onChange,
  label,
  activeClass = 'border-[#FFC206]/40 bg-[#FFC206]/10 text-[#FFC206]',
}: {
  checked: boolean;
  onChange: () => void;
  label: string;
  activeClass?: string;
}) {
  return (
    <button
      onClick={onChange}
      className={[
        'flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-semibold transition',
        checked ? activeClass : 'border-white/15 text-white/40 hover:text-white',
      ].join(' ')}
    >
      <span
        className={[
          'w-3.5 h-3.5 rounded-sm border flex items-center justify-center transition',
          checked ? 'bg-current border-current opacity-100' : 'border-white/30',
        ].join(' ')}
      >
        {checked && (
          <svg
            className="w-2.5 h-2.5 text-current"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={3}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        )}
      </span>
      {label}
    </button>
  );
}

// ── Main view ──────────────────────────────────────────────────────────────────
export default function TimelineScreen() {
  const { data: projects, isLoading } = useProjects();
  const { upsert } = useProjectMutations();
  const [, startTransition] = useTransition();
  const prefs = useAppPreferences();

  const getHolidayFn = useCallback(
    (date: Date): string | null => {
      if (prefs.holidays.length > 0) {
        const iso = toInputDate(date);
        const found = prefs.holidays.find((h) => h.date === iso);
        return found?.name ?? null;
      }
      return getHoliday(date);
    },
    [prefs.holidays]
  );

  const today = useMemo(() => midnight(new Date()), []);

  const [mode, setMode] = useState<ViewMode>('week');
  const [showCompleted, setShowCompleted] = useState(true);
  const [showHolidays, setShowHolidays] = useState(true);
  const [rangeOpen, setRangeOpen] = useState(false);
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [selected, setSelected] = useState<GanttEvent | null>(null);
  const [popover, setPopover] = useState<{ project: Project } | null>(null);

  function openPopover(e: React.MouseEvent, eventId: string) {
    e.stopPropagation();
    const proj = projects.find((p) => p.id === eventId);
    if (!proj) return;
    setPopover({ project: proj });
  }

  function toggleItem(itemId: string) {
    if (!popover) return;
    const proj = popover.project;
    const updated: Project = {
      ...proj,
      items: proj.items.map((it) =>
        it.id === itemId ? { ...it, status: it.status === 'done' ? 'todo' : 'done' } : it
      ),
    };
    setPopover((p) => (p ? { ...p, project: updated } : null));
    startTransition(async () => {
      await upsert(updated);
    });
  }

  const scrollRef = useRef<HTMLDivElement>(null);
  const dayW = DAY_W_MAP[mode];

  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 640);
    check();
    window.addEventListener('resize', check, { passive: true });
    return () => window.removeEventListener('resize', check);
  }, []);
  const leftW = isMobile ? LEFT_W_MOBILE : LEFT_W;

  const allEvents = useMemo(
    (): GanttEvent[] =>
      projects
        .filter((p) => p.filmingDate || p.deliverDate)
        .map((p) => {
          const isRange = !!p.filmingDate && !!p.deliverDate;
          let start: Date, end: Date;
          if (isRange) {
            start = parseDate(p.filmingDate!);
            end = parseDate(p.deliverDate!);
            if (start > end) [start, end] = [end, start];
          } else {
            start = end = parseDate((p.filmingDate ?? p.deliverDate)!);
          }
          return { id: p.id, name: p.name, status: p.status, start, end, isRange };
        })
        .sort((a, b) => a.start.getTime() - b.start.getTime()),
    [projects]
  );

  const events = useMemo(
    () => (showCompleted ? allEvents : allEvents.filter((e) => e.status !== 'completed')),
    [allEvents, showCompleted]
  );

  const { renderStart, renderEnd } = useMemo(() => {
    if (customStart && customEnd) {
      return { renderStart: parseDate(customStart), renderEnd: parseDate(customEnd) };
    }
    const buffer = mode === 'day' ? 14 : mode === 'week' ? 28 : 60;
    const dates = [...allEvents.map((e) => e.start), ...allEvents.map((e) => e.end), today];
    const minT = Math.min(...dates.map((d) => d.getTime()));
    const maxT = Math.max(...dates.map((d) => d.getTime()));
    return {
      renderStart: addDays(new Date(minT), -buffer),
      renderEnd: addDays(new Date(maxT), buffer),
    };
  }, [allEvents, today, mode, customStart, customEnd]);

  const totalDays = diffDays(renderStart, renderEnd) + 1;
  const totalWidth = totalDays * dayW;
  const todayX = diffDays(renderStart, today) * dayW;

  const scrollToToday = useCallback(() => {
    if (!scrollRef.current) return;
    const visibleW = scrollRef.current.clientWidth - leftW;
    scrollRef.current.scrollLeft = Math.max(0, todayX - visibleW / 2 + dayW / 2);
  }, [todayX, dayW, leftW]);

  useEffect(() => {
    setTimeout(scrollToToday, 0);
  }, [mode, customStart, customEnd, scrollToToday]);

  if (isLoading) return <TablePageSkeleton rows={6} />;

  const isEmpty = events.length === 0;

  return (
    <div className="flex flex-col h-full min-h-0 pb-20 md:pb-0">
      {/* ── Controls ────────────────────────────────────────────────────────── */}
      <div className="shrink-0 border-b border-white/[0.06]">
        {/* Row 1: title + view mode + today + date range */}
        <div className="flex items-center gap-2 px-4 py-3">
          <h1 className="text-base font-bold text-white shrink-0">Timeline</h1>

          {/* View mode */}
          <div className="flex items-center rounded-xl border border-white/15 overflow-hidden">
            {(['day', 'week', 'month'] as ViewMode[]).map((m) => (
              <button
                key={m}
                onClick={() => {
                  setMode(m);
                  setCustomStart('');
                  setCustomEnd('');
                }}
                className={[
                  'px-2.5 py-1.5 text-xs font-semibold transition',
                  mode === m
                    ? 'bg-[#FFC206] text-black'
                    : 'text-white/50 hover:text-white hover:bg-white/[0.06]',
                ].join(' ')}
              >
                <span className="sm:hidden capitalize">{m[0]}</span>
                <span className="hidden sm:inline capitalize">{m}</span>
              </button>
            ))}
          </div>

          {/* Today */}
          <button
            onClick={scrollToToday}
            className="px-2.5 py-1.5 rounded-xl border border-white/15 text-xs font-semibold text-white/50 hover:text-white transition shrink-0"
          >
            Today
          </button>

          {/* Date range picker */}
          <div className="relative">
            <button
              onClick={() => setRangeOpen((o) => !o)}
              className={[
                'flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs font-semibold transition',
                customStart && customEnd
                  ? 'border-[#FFC206]/40 bg-[#FFC206]/10 text-[#FFC206]'
                  : 'border-white/15 text-white/50 hover:text-white',
              ].join(' ')}
            >
              <svg
                className="w-3.5 h-3.5 shrink-0"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
              <span className="hidden sm:inline">
                {customStart && customEnd ? `${customStart} → ${customEnd}` : 'Date range'}
              </span>
              {customStart && customEnd && (
                <span className="sm:hidden text-[10px]">
                  {customStart.slice(5)} → {customEnd.slice(5)}
                </span>
              )}
            </button>

            {rangeOpen && (
              <div className="absolute top-full left-0 mt-1 z-30 bg-zinc-900 border border-white/15 rounded-2xl p-4 shadow-2xl w-64">
                <p className="text-xs font-semibold text-white/40 mb-3 uppercase tracking-wide">
                  Custom range
                </p>
                <div className="space-y-2">
                  <div>
                    <label className="text-xs text-white/40 block mb-1">From</label>
                    <input
                      type="date"
                      value={customStart}
                      onChange={(e) => setCustomStart(e.target.value)}
                      className="w-full h-9 rounded-xl border border-white/15 bg-white/5 px-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#FFC206]/50"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-white/40 block mb-1">To</label>
                    <input
                      type="date"
                      value={customEnd}
                      min={customStart}
                      onChange={(e) => setCustomEnd(e.target.value)}
                      className="w-full h-9 rounded-xl border border-white/15 bg-white/5 px-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#FFC206]/50"
                    />
                  </div>
                </div>
                <div className="flex gap-2 mt-3">
                  <button
                    onClick={() => {
                      setCustomStart('');
                      setCustomEnd('');
                      setRangeOpen(false);
                    }}
                    className="flex-1 h-8 rounded-xl border border-white/15 text-xs text-white/50 hover:text-white transition"
                  >
                    Clear
                  </button>
                  <button
                    onClick={() => setRangeOpen(false)}
                    className="flex-1 h-8 rounded-xl bg-[#FFC206] text-black text-xs font-semibold hover:bg-[#FFC206]/90 transition"
                  >
                    Apply
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Toggles — desktop only in this row */}
          <div className="hidden sm:flex items-center gap-2 ml-auto">
            <Toggle
              checked={showHolidays}
              onChange={() => setShowHolidays((v) => !v)}
              label="Cambodian Holiday"
              activeClass="border-red-500/40 bg-red-500/10 text-red-400"
            />
            <Toggle
              checked={showCompleted}
              onChange={() => setShowCompleted((v) => !v)}
              label="Show completed"
              activeClass="border-emerald-500/40 bg-emerald-500/10 text-emerald-400"
            />
          </div>
        </div>

        {/* Row 2: toggles — mobile only */}
        <div className="sm:hidden flex items-center gap-2 px-4 pb-2.5">
          <Toggle
            checked={showHolidays}
            onChange={() => setShowHolidays((v) => !v)}
            label="Holidays"
            activeClass="border-red-500/40 bg-red-500/10 text-red-400"
          />
          <Toggle
            checked={showCompleted}
            onChange={() => setShowCompleted((v) => !v)}
            label="Completed"
            activeClass="border-emerald-500/40 bg-emerald-500/10 text-emerald-400"
          />
        </div>
      </div>

      {/* ── Gantt chart ─────────────────────────────────────────────────────── */}
      {isEmpty ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 text-white/30 p-8">
          <svg
            className="w-12 h-12 opacity-40"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
          <p className="text-sm font-medium">No projects with dates</p>
          <Link href="/dashboard/projects" className="text-xs text-[#FFC206] hover:underline">
            Add dates to projects →
          </Link>
        </div>
      ) : (
        <div
          ref={scrollRef}
          className="flex-1 overflow-auto"
          style={{ minHeight: 0 }}
          onClick={() => setRangeOpen(false)}
        >
          <div style={{ minWidth: leftW + totalWidth }}>
            {/* Sticky header */}
            <div
              className="sticky top-0 z-20 flex border-b border-white/[0.08] bg-[#0a0a0a]"
              style={{ height: HDR_H }}
            >
              <div
                className="sticky left-0 z-30 shrink-0 flex items-end pb-2 px-2 sm:px-4 border-r border-white/[0.08] bg-[#0a0a0a]"
                style={{ width: leftW }}
              >
                <span className="hidden sm:inline text-xs font-semibold text-white/30 uppercase tracking-wide">
                  Project
                </span>
              </div>
              <div className="relative" style={{ width: totalWidth, minWidth: totalWidth }}>
                <TimeAxis
                  renderStart={renderStart}
                  totalDays={totalDays}
                  dayW={dayW}
                  today={today}
                  mode={mode}
                  showHolidays={showHolidays}
                  getHolidayFn={getHolidayFn}
                />
              </div>
            </div>

            {/* Project rows */}
            {events.map((event) => (
              <div
                key={event.id}
                className="flex border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors"
                style={{ height: ROW_H }}
              >
                <button
                  data-progress-trigger
                  onClick={(e) => openPopover(e, event.id)}
                  className="sticky left-0 z-10 shrink-0 flex items-center gap-1.5 sm:gap-2.5 px-2 sm:px-4 border-r border-white/[0.06] bg-[#0a0a0a] hover:bg-white/[0.04] transition text-left"
                  style={{ width: leftW }}
                >
                  <span className={`w-2 h-2 rounded-full shrink-0 ${getDotCls(event, today)}`} />
                  <span className="text-xs sm:text-sm text-white/75 truncate font-medium">
                    {event.name}
                  </span>
                </button>

                <div className="relative" style={{ width: totalWidth, minWidth: totalWidth }}>
                  <GridLines
                    renderStart={renderStart}
                    totalDays={totalDays}
                    dayW={dayW}
                    today={today}
                    mode={mode}
                    showHolidays={showHolidays}
                    getHolidayFn={getHolidayFn}
                  />
                  <ProjectBar
                    event={event}
                    renderStart={renderStart}
                    dayW={dayW}
                    today={today}
                    onSelect={(e, ev) => openPopover(e, ev.id)}
                  />
                </div>
              </div>
            ))}

            <div style={{ height: 40 }} />
          </div>
        </div>
      )}

      {/* ── Legend ──────────────────────────────────────────────────────────── */}
      <div className="hidden sm:flex shrink-0 flex-wrap items-center gap-x-4 gap-y-1.5 px-4 py-2.5 border-t border-white/[0.06]">
        <div className="flex items-center gap-1.5">
          <span className={`w-2.5 h-2.5 rounded-full ${LATE_DOT}`} />
          <span className="text-[11px] text-red-400">Late</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className={`w-2.5 h-2.5 rounded-full ${STATUS_DOT.confirmed}`} />
          <span className="text-[11px] text-white/35">In Progress</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className={`w-2.5 h-2.5 rounded-full ${STATUS_DOT.completed}`} />
          <span className="text-[11px] text-white/35">Completed</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className={`w-2.5 h-2.5 rounded-full ${STATUS_DOT.unconfirmed}`} />
          <span className="text-[11px] text-white/35">Upcoming / Unconfirmed</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className={`w-2.5 h-2.5 rounded-full ${STATUS_DOT['on-hold']}`} />
          <span className="text-[11px] text-white/35">On Hold</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm rotate-45 bg-white/30 inline-block" />
          <span className="text-[11px] text-white/35">Single date</span>
        </div>
        {showHolidays && (
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
            <span className="text-[11px] text-red-400">Cambodian Holiday</span>
          </div>
        )}
        <div className="flex items-center gap-1.5 ml-auto">
          <span className="w-3 h-0.5 bg-[#FFC206]/60 inline-block" />
          <span className="text-[11px] text-white/35">Today</span>
        </div>
      </div>

      {popover && (
        <ProgressPopover
          project={popover.project}
          onClose={() => setPopover(null)}
          onToggleItem={toggleItem}
        />
      )}
    </div>
  );
}
